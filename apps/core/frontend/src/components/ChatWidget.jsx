"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const EMOJIS = ["😀", "😂", "😍", "😊", "👍", "🙏", "❤️", "🔥", "🎉", "👏", "😅", "🤝", "💯", "📦", "🚚", "✨"];

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }) : "";
}

function Bubble({ msg, myId, onReply, onForward, onDelete }) {
  const own = String(msg.sender_id) === String(myId);
  const isImage = msg.attachment_type?.startsWith("image/");
  const isAudio = msg.attachment_type?.startsWith("audio/");
  const deleted = Boolean(msg.deleted_at);
  return (
    <div style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start", marginBottom: "8px" }}>
      <div style={{
        maxWidth: "82%", padding: "9px 13px", borderRadius: own ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: own ? "var(--dz-gradient)" : "var(--elevated)", color: own ? "#fff" : "var(--text)",
        fontSize: "0.85rem", lineHeight: 1.5,
      }}>
        {!deleted && isImage && msg.attachment_url && <img src={msg.attachment_url} alt={msg.attachment_name || "Shared image"} style={{ maxWidth: "220px", maxHeight: "180px", borderRadius: "8px", display: "block", marginBottom: msg.message ? "6px" : 0 }} />}
        {!deleted && isAudio && msg.attachment_url && <audio controls src={msg.attachment_url} style={{ maxWidth: "220px" }} />}
        {!deleted && !isImage && !isAudio && msg.attachment_url && (
          <a href={msg.attachment_url} target="_blank" rel="noreferrer" style={{ color: own ? "#fff" : "var(--dz-blue)", display: "block", marginBottom: msg.message ? "5px" : 0 }}>
            📎 {msg.attachment_name || "Open attachment"}
          </a>
        )}
        {deleted ? <p style={{ fontStyle: "italic", opacity: 0.7 }}>Message deleted</p> : msg.message && <p style={{ whiteSpace: "pre-wrap" }}>{msg.message}</p>}
        <div style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start", gap: "4px", marginTop: "4px" }}>
          <button type="button" onClick={() => onReply(msg)} style={{ border: "none", background: "transparent", color: own ? "rgba(255,255,255,0.8)" : "var(--text-muted)", fontSize: "0.62rem", cursor: "pointer" }}>Reply</button>
          <button type="button" onClick={() => onForward(msg)} style={{ border: "none", background: "transparent", color: own ? "rgba(255,255,255,0.8)" : "var(--text-muted)", fontSize: "0.62rem", cursor: "pointer" }}>Forward</button>
          {own && !deleted && <button type="button" onClick={() => onDelete(msg)} style={{ border: "none", background: "transparent", color: own ? "rgba(255,255,255,0.8)" : "var(--text-muted)", fontSize: "0.62rem", cursor: "pointer" }}>Delete</button>}
        </div>
        <p style={{ fontSize: "0.65rem", color: own ? "rgba(255,255,255,0.72)" : "var(--text-muted)", marginTop: "3px", textAlign: "right" }}>
          {formatTime(msg.created_at)} {own && <span aria-label={msg.is_read ? "Read" : "Sent"}>{msg.is_read ? "✓✓" : "✓"}</span>}
        </p>
      </div>
    </div>
  );
}

// Call transport boundary: signaling can be attached here without changing chat UI.
function createCallSession(kind) {
  if (typeof RTCPeerConnection === "undefined") return null;
  const peer = new RTCPeerConnection();
  return { kind, peer, close: () => peer.close() };
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [convos, setConvos] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [callStatus, setCallStatus] = useState("");
  const [callActive, setCallActive] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const recorderRef = useRef(null);
  const voiceChunks = useRef([]);
  const callRef = useRef(null);

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("dunazoe_user") || "null");
      const storedToken = localStorage.getItem("dunazoe_token") || "";
      if (storedUser && storedToken) { setUser(storedUser); setToken(storedToken); }
    } catch (_) {}
  }, []);

  useEffect(() => {
    function handler(e) {
      if (!e.detail) return;
      setActive({ receiver_id: e.detail.receiver_id, name: e.detail.name || "Vendor" });
      setOpen(true);
    }
    document.addEventListener("dz:open-chat", handler);
    return () => document.removeEventListener("dz:open-chat", handler);
  }, []);

  const loadConvos = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API}/chat/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) {
        const list = data.conversations || [];
        setConvos(list);
        setUnread(list.reduce((sum, item) => sum + (item.unread || 0), 0));
      }
    } catch (_) {}
  }, [token]);

  useEffect(() => {
    if (!user || !token) return;
    loadConvos();
    const id = setInterval(loadConvos, 20000);
    return () => clearInterval(id);
  }, [user, token, loadConvos]);

  const loadMsgs = useCallback(async () => {
    if (!token || !active) return;
    try {
      const response = await fetch(`${API}/chat/messages?with=${encodeURIComponent(active.receiver_id)}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) { setMessages(data.messages || []); setTyping(Boolean(data.typing)); }
    } catch (_) {}
  }, [token, active]);

  useEffect(() => {
    if (!active) return undefined;
    setMessages([]); setTyping(false); loadMsgs();
    const id = setInterval(loadMsgs, 4000);
    return () => clearInterval(id);
  }, [active, loadMsgs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function uploadAttachment(file, kind = "file") {
    if (!file || !token) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file, file.name || `${kind}.webm`);
      form.append("kind", kind);
      const response = await fetch(`${API}/chat/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Upload failed");
      setPendingAttachment({ url: data.url, name: data.name, type: data.type, kind });
    } catch (error) {
      setCallStatus(error.message);
    } finally { setUploading(false); }
  }

  function onFileSelected(event) {
    const file = event.target.files?.[0];
    if (file) uploadAttachment(file, file.type.startsWith("image/") ? "image" : "file");
    event.target.value = "";
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setCallStatus("Voice notes are not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChunks.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => e.data.size && voiceChunks.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        uploadAttachment(new File([new Blob(voiceChunks.current, { type: recorder.mimeType || "audio/webm" })], "voice-note.webm", { type: recorder.mimeType || "audio/webm" }), "voice");
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true); setCallStatus("Recording voice note… tap the microphone to stop.");
    } catch (_) { setCallStatus("Microphone permission was not granted."); }
  }

  function notifyTyping() {
    if (!active || !token) return;
    clearTimeout(typingTimer.current);
    fetch(`${API}/chat/typing`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ receiver_id: active.receiver_id }),
    }).catch(() => {});
    typingTimer.current = setTimeout(() => {}, 2500);
  }

  async function send(event) {
    event.preventDefault();
    const message = input.trim();
    if ((!message && !pendingAttachment) || !active || sending) return;
    setSending(true);
    const attachment = pendingAttachment;
    setInput(""); setPendingAttachment(null); setCallStatus("");
    try {
      const response = await fetch(`${API}/chat/send`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
           receiver_id: active.receiver_id, message,
           reply_to_id: replyingTo?.id || null,
          msg_type: attachment?.kind === "image" ? "image" : attachment?.kind === "voice" ? "file" : attachment ? "file" : "text",
          attachment_url: attachment?.url, attachment_name: attachment?.name, attachment_type: attachment?.type,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Message failed");
      setReplyingTo(null);
      await loadMsgs(); await loadConvos();
    } catch (error) { setCallStatus(error.message); }
    finally { setSending(false); }
  }

  async function startCall(kind) {
    if (callRef.current) endCall();
    const session = createCallSession(kind);
    if (!session || !navigator.mediaDevices?.getUserMedia) {
      setCallStatus("Calling is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
      stream.getTracks().forEach(track => session.peer.addTrack(track, stream));
      const offer = await session.peer.createOffer();
      await session.peer.setLocalDescription(offer);
      callRef.current = { ...session, stream };
      setCallActive(true);
      setCallStatus(`${kind === "video" ? "Video" : "Voice"} call started. Waiting for the recipient to join…`);
    } catch (error) {
      session.close();
      setCallStatus(error.name === "NotAllowedError" ? "Microphone/camera permission was not granted." : "Could not start the call.");
    }
  }

  function endCall() {
    callRef.current?.stream?.getTracks().forEach(track => track.stop());
    callRef.current?.close();
    callRef.current = null;
    setCallActive(false);
    setCallStatus("");
  }

  async function deleteMessage(message) {
    try {
      const response = await fetch(`${API}/chat/message?id=${encodeURIComponent(message.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not delete message.");
      await loadMsgs();
    } catch (error) { setCallStatus(error.message); }
  }

  function forwardMessage(message) {
    const text = message.message || message.attachment_name || "attachment";
    setInput(`Forwarded: ${text}`);
    setCallStatus("Edit the forwarded message and send it.");
  }

  if (!user) return null;
  return (
    <>
      <button onClick={() => setOpen(value => !value)} aria-label={open ? "Close chat" : "Open chat"} style={{
        position: "fixed", bottom: "24px", right: "24px", zIndex: 9000, width: "56px", height: "56px",
        borderRadius: "50%", background: "var(--dz-gradient)", border: "none", cursor: "pointer", fontSize: "1.3rem",
        boxShadow: "0 4px 24px rgba(0,102,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {open ? "✕" : "💬"}
        {!open && unread > 0 && <span style={{ position: "absolute", top: "2px", right: "2px", minWidth: "18px", height: "18px", borderRadius: "9px", background: "var(--danger)", border: "2px solid var(--bg)", fontSize: "0.6rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && <div className="chat-widget-panel" style={{
        position: "fixed", bottom: "92px", right: "24px", zIndex: 9000, width: "360px", height: "540px",
        borderRadius: "20px", background: "var(--bg)", border: "1px solid var(--border)", display: "flex",
        flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.6)", overflow: "hidden",
      }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px", background: "var(--surface)" }}>
          {active ? <button type="button" onClick={() => setActive(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1rem" }}>←</button> : <span style={{ fontSize: "1.1rem" }}>💬</span>}
          <div style={{ flex: 1 }}><p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{active ? active.name : "Messages"}</p><p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{active ? (typing ? "Typing…" : "Secure chat") : "Vendor · Buyer chats"}</p></div>
           {active && <>{callActive ? <button type="button" onClick={endCall} aria-label="End call" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: "1rem" }}>⏹️</button> : <><button type="button" onClick={() => startCall("voice")} aria-label="Start voice call" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: "1rem" }}>📞</button><button type="button" onClick={() => startCall("video")} aria-label="Start video call" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: "1rem" }}>🎥</button></>}</>}
          {!active && <button type="button" onClick={loadConvos} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>↻</button>}
        </div>

        {!active ? <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {convos.length === 0 ? <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)" }}><p style={{ fontSize: "2rem" }}>💬</p><p style={{ fontSize: "0.82rem" }}>No conversations yet.</p><p style={{ fontSize: "0.75rem", marginTop: "6px" }}>Chat vendors from any product page.</p></div> : convos.map(convo => (
            <button key={convo.other_user_id} type="button" onClick={() => setActive({ receiver_id: convo.other_user_id, name: convo.other_user_name || "User" })} style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "12px", background: "transparent", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--dz-gradient)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800 }}>{(convo.other_user_name || "?")[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>{convo.other_user_name || "User"}</p><p style={{ fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{convo.last_message || "—"}</p></div>
              {convo.unread > 0 && <span style={{ minWidth: "18px", height: "18px", borderRadius: "9px", background: "var(--dz-blue)", fontSize: "0.65rem", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{convo.unread}</span>}
            </button>
          ))}
        </div> : <>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            {messages.length === 0 && <div style={{ textAlign: "center", padding: "32px 12px", color: "var(--text-muted)", fontSize: "0.82rem" }}>Say hello! 👋</div>}
             {messages.map((message, index) => <Bubble key={message.id || index} msg={message} myId={user.id || user.user_id} onReply={setReplyingTo} onForward={forwardMessage} onDelete={deleteMessage} />)}
            <div ref={bottomRef} />
          </div>
          {callStatus && <div style={{ padding: "6px 12px", color: "var(--warning)", fontSize: "0.7rem", borderTop: "1px solid var(--border)" }}>{callStatus}</div>}
           {replyingTo && <div style={{ padding: "6px 12px", color: "var(--dz-blue)", fontSize: "0.72rem", borderTop: "1px solid var(--border)" }}>↩ Replying to: {replyingTo.message || replyingTo.attachment_name || "attachment"} <button type="button" onClick={() => setReplyingTo(null)} style={{ border: "none", background: "none", color: "var(--danger)", cursor: "pointer" }}>cancel</button></div>}
           {pendingAttachment && <div style={{ padding: "6px 12px", color: "var(--dz-blue)", fontSize: "0.72rem", borderTop: "1px solid var(--border)" }}>📎 {pendingAttachment.name} <button type="button" onClick={() => setPendingAttachment(null)} style={{ border: "none", background: "none", color: "var(--danger)", cursor: "pointer" }}>remove</button></div>}
           {emojiOpen && <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", display: "flex", flexWrap: "wrap", gap: "4px", background: "var(--surface)" }}>
             {EMOJIS.map(emoji => (
               <button key={emoji} type="button" onClick={() => setInput(value => `${value}${emoji}`)} aria-label={`Add ${emoji}`} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "1.15rem", padding: "3px" }}>{emoji}</button>
             ))}
           </div>}
          <form onSubmit={send} style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", display: "flex", gap: "6px", alignItems: "center" }}>
            <label title="Upload image, document, PDF, or video" style={{ cursor: uploading ? "wait" : "pointer", color: "var(--text-secondary)", fontSize: "1.1rem" }}>📎<input type="file" hidden accept="image/*,.pdf,.doc,.docx,video/*" onChange={onFileSelected} disabled={uploading} /></label>
             <button type="button" title="Choose emoji" onClick={() => setEmojiOpen(value => !value)} style={{ border: "none", background: "none", cursor: "pointer", color: emojiOpen ? "var(--dz-blue)" : "var(--text-secondary)", fontSize: "1.05rem" }}>😊</button>
            <button type="button" title="Record voice note" onClick={toggleRecording} style={{ border: "none", background: "none", cursor: "pointer", color: recording ? "var(--danger)" : "var(--text-secondary)", fontSize: "1.05rem" }}>{recording ? "⏹️" : "🎤"}</button>
            <input value={input} onChange={event => { setInput(event.target.value); notifyTyping(); }} placeholder={recording ? "Recording voice note…" : "Type a message…"} disabled={sending || recording} style={{ flex: 1, minWidth: 0, padding: "9px 10px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "0.85rem", outline: "none" }} />
            <button type="submit" disabled={sending || uploading || (!input.trim() && !pendingAttachment)} style={{ padding: "9px 12px", borderRadius: "12px", background: "var(--dz-gradient)", border: "none", cursor: "pointer", color: "#fff" }}>→</button>
          </form>
        </>}
      </div>}
    </>
  );
}