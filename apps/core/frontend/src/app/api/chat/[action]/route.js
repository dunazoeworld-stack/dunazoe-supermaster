import { NextResponse } from "next/server";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import pool from "../../../../lib/db.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "application/zip",
  "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav",
  "video/mp4", "video/webm", "video/quicktime",
]);
const EXTENSION_MIME = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", zip: "application/zip", webm: "audio/webm", ogg: "audio/ogg",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", mp4: "video/mp4", mov: "video/quicktime",
};
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
         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
         ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP,
         ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'::jsonb
    `).then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS chat_typing (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL
      )
     `)).then(() => pool.query(`
       CREATE TABLE IF NOT EXISTS chat_call_history (
         id SERIAL PRIMARY KEY,
         caller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         kind VARCHAR(10) NOT NULL CHECK (kind IN ('voice','video')),
         status VARCHAR(16) NOT NULL CHECK (status IN ('ringing','connected','ended','declined','missed','failed')),
         created_at TIMESTAMP NOT NULL DEFAULT NOW(),
         ended_at TIMESTAMP
       )
    `)).catch(err => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function uploadError(error, status = 400, details = {}) {
  return NextResponse.json({ success: false, code: error.code, error: error.message, details }, { status });
}

function hasSignature(mime, bytes) {
  const head = Buffer.from(bytes).subarray(0, 12);
  if (mime === "image/jpeg") return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (mime === "image/png") return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/gif") return head.subarray(0, 4).toString() === "GIF8";
  if (mime === "image/webp") return head.subarray(0, 4).toString() === "RIFF" && head.subarray(8, 12).toString() === "WEBP";
  if (mime === "application/pdf") return head.subarray(0, 5).toString() === "%PDF-";
  if (mime === "application/zip" || mime.includes("officedocument")) return head[0] === 0x50 && head[1] === 0x4b;
  return true;
}

async function uploadFile(request) {
  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind") || "file";
  if (!file || typeof file === "string") {
    return uploadError({ code: "ATTACHMENT_REQUIRED", message: "No file provided." });
  }
  if (!file.size) return uploadError({ code: "ATTACHMENT_EMPTY", message: "The selected file is empty." });
  if (file.size > MAX_UPLOAD_BYTES) {
    return uploadError({ code: "ATTACHMENT_TOO_LARGE", message: "Chat files must be 10 MB or smaller." }, 413, { maxBytes: MAX_UPLOAD_BYTES });
  }

  const bytes = await file.arrayBuffer();
  const extension = String(file.name || "").toLowerCase().split(".").pop();
  const browserMime = String(file.type || "").toLowerCase();
  const mime = browserMime && browserMime !== "application/octet-stream"
    ? browserMime
    : EXTENSION_MIME[extension] || browserMime || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return uploadError({ code: "ATTACHMENT_UNSUPPORTED", message: "This file type is not supported in chat." }, 415, { mime, extension });
  }
  if (!hasSignature(mime, bytes)) {
    return uploadError({ code: "ATTACHMENT_CORRUPT", message: "The file content does not match its declared type." }, 415, { mime });
  }
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
      const search = String(new URL(request.url).searchParams.get("q") || "").trim().slice(0, 100);
      if (!Number.isInteger(receiver)) return NextResponse.json({ success: false, error: "Conversation recipient is required." }, { status: 400 });
      if (receiver === Number(user.id)) {
        return NextResponse.json({ success: false, code: "SELF_CHAT_BLOCKED", error: "You cannot open a conversation with yourself." }, { status: 403 });
      }
      await pool.query("UPDATE chat_messages SET is_read=TRUE WHERE sender_id=$1 AND receiver_id=$2 AND is_read=FALSE", [receiver, user.id]);
      const result = await pool.query(`
           SELECT id, sender_id, receiver_id, order_id, message, msg_type, is_read,
                 attachment_url, attachment_name, attachment_type, reply_to_id, deleted_at, edited_at, reactions, created_at
        FROM chat_messages
        WHERE ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1))
          AND ($3 = '' OR message ILIKE '%' || $3 || '%')
        ORDER BY created_at ASC LIMIT 100
      `, [user.id, receiver, search]);
      const typing = await pool.query(
        "SELECT 1 FROM chat_typing WHERE user_id=$1 AND receiver_id=$2 AND expires_at > NOW()",
        [receiver, user.id]
      );
      return NextResponse.json({ success: true, messages: result.rows, typing: typing.rows.length > 0 });
    }
    if (action === "call-history") {
      const receiver = Number(new URL(request.url).searchParams.get("with"));
      const result = await pool.query(
        `SELECT id, caller_id, receiver_id, kind, status, created_at, ended_at
         FROM chat_call_history
         WHERE (caller_id=$1 OR receiver_id=$1)
           AND ($2::int IS NULL OR caller_id=$2 OR receiver_id=$2)
         ORDER BY created_at DESC LIMIT 50`,
        [user.id, Number.isInteger(receiver) ? receiver : null]
      );
      return NextResponse.json({ success: true, calls: result.rows });
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
      if (receiver === Number(user.id)) {
        return NextResponse.json({ success: false, code: "SELF_CHAT_BLOCKED", error: "You cannot send typing activity to yourself." }, { status: 403 });
      }
      await pool.query(`
        INSERT INTO chat_typing(user_id, receiver_id, expires_at)
        VALUES($1,$2,NOW() + INTERVAL '3 seconds')
        ON CONFLICT(user_id) DO UPDATE SET receiver_id=EXCLUDED.receiver_id, expires_at=EXCLUDED.expires_at
      `, [user.id, receiver]);
      return NextResponse.json({ success: true });
    }
    if (action === "react") {
      const messageId = Number(body.message_id);
      const emoji = String(body.emoji || "").trim();
      const validEmojis = ["😀", "😂", "😍", "😊", "👍", "🙏", "❤️", "🔥", "🎉", "👏", "😅", "🤝", "💯", "📦", "🚚", "✨"];
      if (!Number.isInteger(messageId) || !validEmojis.includes(emoji)) {
        return NextResponse.json({ success: false, error: "A valid message_id and emoji are required." }, { status: 400 });
      }
      const existing = await pool.query(
        "SELECT id, sender_id, receiver_id, reactions FROM chat_messages WHERE id=$1 AND (sender_id=$2 OR receiver_id=$2)",
        [messageId, user.id]
      );
      if (!existing.rows.length) return NextResponse.json({ success: false, error: "Message not found." }, { status: 404 });
      const reactions = existing.rows[0].reactions && typeof existing.rows[0].reactions === "object" ? existing.rows[0].reactions : {};
      const users = Array.isArray(reactions[emoji]) ? reactions[emoji].map(Number).filter(Number.isInteger) : [];
      const nextUsers = users.includes(Number(user.id)) ? users.filter(id => id !== Number(user.id)) : [...users, Number(user.id)];
      if (nextUsers.length) reactions[emoji] = nextUsers;
      else delete reactions[emoji];
      const updated = await pool.query(
        "UPDATE chat_messages SET reactions=$1::jsonb WHERE id=$2 RETURNING id, reactions",
        [JSON.stringify(reactions), messageId]
      );
      return NextResponse.json({ success: true, message: updated.rows[0] });
    }
    if (action === "call-event") {
      const peerId = Number(body.peer_id);
      const kind = body.kind === "video" ? "video" : "voice";
      const allowedStatuses = ["ringing", "connected", "ended", "declined", "missed", "failed"];
      const status = String(body.status || "");
      if (!Number.isInteger(peerId) || !allowedStatuses.includes(status)) {
        return NextResponse.json({ success: false, error: "A valid peer_id and call status are required." }, { status: 400 });
      }
      if (peerId === Number(user.id)) {
        return NextResponse.json({ success: false, code: "SELF_CHAT_BLOCKED", error: "Self-calls are not allowed." }, { status: 403 });
      }
      const result = await pool.query(
        `INSERT INTO chat_call_history(caller_id, receiver_id, kind, status, ended_at)
         VALUES($1,$2,$3,$4,CASE WHEN $4 IN ('ended','declined','missed','failed') THEN NOW() ELSE NULL END)
         RETURNING id, caller_id, receiver_id, kind, status, created_at, ended_at`,
        [user.id, peerId, kind, status]
      );
      return NextResponse.json({ success: true, call: result.rows[0] }, { status: 201 });
    }
    if (action !== "send") return NextResponse.json({ success: false, error: "Unknown chat action." }, { status: 404 });

    const receiver = Number(body.receiver_id);
    const message = String(body.message || "").trim();
    const attachmentUrl = body.attachment_url || null;
    if (!Number.isInteger(receiver) || (!message && !attachmentUrl)) {
      return NextResponse.json({ success: false, error: "A recipient and message or attachment are required." }, { status: 400 });
    }
    if (receiver === Number(user.id)) {
      return NextResponse.json({ success: false, code: "SELF_CHAT_BLOCKED", error: "You cannot chat with yourself." }, { status: 403 });
    }
    if (message.length > 2000) return NextResponse.json({ success: false, error: "Messages must be 2,000 characters or fewer." }, { status: 400 });
    const msgType = body.msg_type || (String(body.attachment_type || "").startsWith("image/") ? "image" : "file");
    if (!["text", "image", "file"].includes(msgType)) {
      return NextResponse.json({ success: false, code: "INVALID_MESSAGE_TYPE", error: "Unsupported message type." }, { status: 400 });
    }
    if (attachmentUrl) {
      const value = String(attachmentUrl);
      const isLocalAttachment = value.startsWith("data:") && value.length <= 3 * 1024 * 1024;
      let isHttpsAttachment = false;
      try {
        const parsed = new URL(value);
        isHttpsAttachment = parsed.protocol === "https:";
      } catch (_) {}
      if (!isLocalAttachment && !isHttpsAttachment) {
        return NextResponse.json({ success: false, code: "INVALID_ATTACHMENT_URL", error: "Attachment storage URL is not allowed." }, { status: 400 });
      }
    }
    const replyToId = body.reply_to_id == null ? null : Number(body.reply_to_id);
    if (replyToId !== null && !Number.isInteger(replyToId)) {
      return NextResponse.json({ success: false, error: "reply_to_id must be a message id." }, { status: 400 });
    }
    if (replyToId !== null) {
      const reply = await pool.query(
        "SELECT id FROM chat_messages WHERE id=$1 AND ((sender_id=$2 AND receiver_id=$3) OR (sender_id=$3 AND receiver_id=$2))",
        [replyToId, user.id, receiver]
      );
      if (!reply.rows.length) {
        return NextResponse.json({ success: false, code: "INVALID_REPLY_TARGET", error: "The reply target is not in this conversation." }, { status: 400 });
      }
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

export async function PATCH(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  const { action } = await params;
  if (action !== "message") return NextResponse.json({ success: false, error: "Unknown chat action." }, { status: 404 });
  try {
    await ensureChatSchema();
    const body = await request.json().catch(() => ({}));
    const messageId = Number(body.message_id);
    const message = String(body.message || "").trim();
    if (!Number.isInteger(messageId) || !message) {
      return NextResponse.json({ success: false, error: "message_id and message are required." }, { status: 400 });
    }
    if (message.length > 2000) return NextResponse.json({ success: false, error: "Messages must be 2,000 characters or fewer." }, { status: 400 });
    const result = await pool.query(
      `UPDATE chat_messages SET message=$1, edited_at=NOW()
       WHERE id=$2 AND sender_id=$3 AND deleted_at IS NULL
         AND created_at > NOW() - INTERVAL '15 minutes'
       RETURNING id, message, edited_at`,
      [message, messageId, user.id]
    );
    if (!result.rows.length) return NextResponse.json({ success: false, error: "Message cannot be edited." }, { status: 404 });
    return NextResponse.json({ success: true, message: result.rows[0] });
  } catch (error) {
    console.error("[chat] edit failed:", error.message);
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