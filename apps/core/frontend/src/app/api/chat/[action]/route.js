import { NextResponse } from "next/server";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import pool from "../../../../lib/db.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
let schemaReady;

function getUser(request) {
  try {
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token || !JWT_SECRET) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch (_) {
    return null;
  }
}

async function ensureChatSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`
      ALTER TABLE chat_messages
        ADD COLUMN IF NOT EXISTS attachment_url TEXT,
        ADD COLUMN IF NOT EXISTS attachment_name TEXT,
        ADD COLUMN IF NOT EXISTS attachment_type TEXT,
        ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
    `).then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS chat_typing (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL
      )
    `)).catch(err => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

async function uploadFile(request) {
  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind") || "file";
  if (!file || typeof file === "string") {
    return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ success: false, error: "Chat files must be 10 MB or smaller." }, { status: 413 });
  }

  const bytes = await file.arrayBuffer();
  const mime = file.type || "application/octet-stream";
  const cloud = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const key = (process.env.CLOUDINARY_API_KEY || "").trim();
  const secret = (process.env.CLOUDINARY_API_SECRET || "").trim();

  if (cloud && key && secret) {
    const timestamp = Math.round(Date.now() / 1000).toString();
    const folder = "dunazoe_chat";
    const signature = crypto.createHash("sha1")
      .update(`folder=${folder}&timestamp=${timestamp}${secret}`)
      .digest("hex");
    const upload = new FormData();
    upload.append("file", new Blob([bytes], { type: mime }), file.name || "chat-file");
    upload.append("api_key", key);
    upload.append("timestamp", timestamp);
    upload.append("folder", folder);
    upload.append("signature", signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, { method: "POST", body: upload });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.secure_url) {
      return NextResponse.json({ success: false, error: data.error?.message || "File storage upload failed." }, { status: 502 });
    }
    return NextResponse.json({
      success: true, url: data.secure_url, name: file.name, type: mime, kind,
    });
  }

  // Small local fallback keeps chat usable in development without pretending
  // the file is durable production storage.
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: "File storage is not configured; local chat fallback supports files up to 2 MB." }, { status: 503 });
  }
  const url = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  return NextResponse.json({ success: true, url, name: file.name, type: mime, kind, local: true });
}

export async function GET(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  const { action } = await params;
  try {
    await ensureChatSchema();
    if (action === "conversations") {
      const result = await pool.query(`
        SELECT
          CASE WHEN m.sender_id=$1 THEN m.receiver_id ELSE m.sender_id END AS other_user_id,
          u.name AS other_user_name,
           (array_agg(CASE WHEN m.deleted_at IS NULL THEN COALESCE(m.message, '') ELSE '[Message deleted]' END ORDER BY m.created_at DESC))[1] AS last_message,
          MAX(m.created_at) AS last_message_at,
          COUNT(*) FILTER (WHERE m.receiver_id=$1 AND m.is_read=FALSE)::int AS unread
        FROM chat_messages m
        JOIN users u ON u.id = CASE WHEN m.sender_id=$1 THEN m.receiver_id ELSE m.sender_id END
        WHERE m.sender_id=$1 OR m.receiver_id=$1
        GROUP BY other_user_id, u.name
        ORDER BY last_message_at DESC
      `, [user.id]);
      return NextResponse.json({ success: true, conversations: result.rows });
    }
    if (action === "messages") {
      const receiver = Number(new URL(request.url).searchParams.get("with"));
      if (!Number.isInteger(receiver)) return NextResponse.json({ success: false, error: "Conversation recipient is required." }, { status: 400 });
      await pool.query("UPDATE chat_messages SET is_read=TRUE WHERE sender_id=$1 AND receiver_id=$2 AND is_read=FALSE", [receiver, user.id]);
      const result = await pool.query(`
           SELECT id, sender_id, receiver_id, order_id, message, msg_type, is_read,
                attachment_url, attachment_name, attachment_type, reply_to_id, deleted_at, created_at
        FROM chat_messages
        WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)
        ORDER BY created_at ASC LIMIT 100
      `, [user.id, receiver]);
      const typing = await pool.query(
        "SELECT 1 FROM chat_typing WHERE user_id=$1 AND receiver_id=$2 AND expires_at > NOW()",
        [receiver, user.id]
      );
      return NextResponse.json({ success: true, messages: result.rows, typing: typing.rows.length > 0 });
    }
    return NextResponse.json({ success: false, error: "Unknown chat action." }, { status: 404 });
  } catch (error) {
    console.error("[chat] GET failed:", error.message);
    return NextResponse.json({ success: false, error: "Chat service is unavailable." }, { status: 503 });
  }
}

export async function POST(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  const { action } = await params;
  if (action === "upload") {
    try { return await uploadFile(request); }
    catch (error) {
      console.error("[chat] upload failed:", error.message);
      return NextResponse.json({ success: false, error: "Could not upload chat file." }, { status: 502 });
    }
  }

  try {
    await ensureChatSchema();
    const body = await request.json().catch(() => ({}));
    if (action === "typing") {
      const receiver = Number(body.receiver_id);
      if (!Number.isInteger(receiver)) return NextResponse.json({ success: false, error: "receiver_id is required." }, { status: 400 });
      await pool.query(`
        INSERT INTO chat_typing(user_id, receiver_id, expires_at)
        VALUES($1,$2,NOW() + INTERVAL '3 seconds')
        ON CONFLICT(user_id) DO UPDATE SET receiver_id=EXCLUDED.receiver_id, expires_at=EXCLUDED.expires_at
      `, [user.id, receiver]);
      return NextResponse.json({ success: true });
    }
    if (action !== "send") return NextResponse.json({ success: false, error: "Unknown chat action." }, { status: 404 });

    const receiver = Number(body.receiver_id);
    const message = String(body.message || "").trim();
    const attachmentUrl = body.attachment_url || null;
    if (!Number.isInteger(receiver) || (!message && !attachmentUrl)) {
      return NextResponse.json({ success: false, error: "A recipient and message or attachment are required." }, { status: 400 });
    }
    if (message.length > 2000) return NextResponse.json({ success: false, error: "Messages must be 2,000 characters or fewer." }, { status: 400 });
    const msgType = body.msg_type || (String(body.attachment_type || "").startsWith("image/") ? "image" : "file");
    const replyToId = body.reply_to_id == null ? null : Number(body.reply_to_id);
    if (replyToId !== null && !Number.isInteger(replyToId)) {
      return NextResponse.json({ success: false, error: "reply_to_id must be a message id." }, { status: 400 });
    }
    const result = await pool.query(`
      INSERT INTO chat_messages(sender_id, receiver_id, message, msg_type, attachment_url, attachment_name, attachment_type, reply_to_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id, sender_id, receiver_id, message, msg_type, is_read, attachment_url, attachment_name, attachment_type, reply_to_id, created_at
    `, [user.id, receiver, message, msgType, attachmentUrl, body.attachment_name || null, body.attachment_type || null, replyToId]);
    return NextResponse.json({ success: true, message: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("[chat] POST failed:", error.message);
    return NextResponse.json({ success: false, error: "Chat service is unavailable." }, { status: 503 });
  }
}

export async function DELETE(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  const { action } = await params;
  if (action !== "message") return NextResponse.json({ success: false, error: "Unknown chat action." }, { status: 404 });
  const messageId = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(messageId)) return NextResponse.json({ success: false, error: "Message id is required." }, { status: 400 });
  try {
    await ensureChatSchema();
    const result = await pool.query(
      "UPDATE chat_messages SET message='', attachment_url=NULL, deleted_at=NOW() WHERE id=$1 AND sender_id=$2 AND deleted_at IS NULL RETURNING id",
      [messageId, user.id]
    );
    if (!result.rows.length) return NextResponse.json({ success: false, error: "Message not found or cannot be deleted." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[chat] delete failed:", error.message);
    return NextResponse.json({ success: false, error: "Chat service is unavailable." }, { status: 503 });
  }
}