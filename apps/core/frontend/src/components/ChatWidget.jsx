"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ||
  (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:4021` : null);
const EMOJIS = ["😀", "😂", "😍", "😊", "👍", "🙏", "❤️", "🔥", "🎉", "👏", "😅", "🤝", "💯", "📦", "🚚", "✨"];

async function safeJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch (_) {
    return { error: response.ok ? "The server returned an invalid response." : `Request failed (${response.status}).` };
  }
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }) : "";
}

function Bubble({ msg, myId, onReply, onForward, onDelete, onEdit, onReact, onAudioReady, onAudioPlay }) {
  const own = String(msg.sender_id) === String(myId);
  const isImage = msg.attachment_type?.startsWith("image/");
  const isAudio = msg.attachment_type?.startsWith("audio/");
  const deleted = Boolean(msg.deleted_at);
  const reactions = msg.reactions && typeof msg.reactions === "object" ? msg.reactions : {};
  const reactionEntries = Object.entries(reactions).filter(([, users]) => Array.isArray(users) && users.length);
  return (
    <div style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start", marginBottom: "8px" }}>
      <div style={{
        maxWidth: "82%", padding: "9px 13px", borderRadius: own ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: own ? "var(--dz-gradient)" : "var(--elevated)", color: own ? "#fff" : "var(--text)",
        fontSize: "0.85rem", lineHeight: 1.5,
      }}>
        {!deleted && isImage && msg.attachment_url && <img src={msg.attachment_url} alt={msg.attachment_name || "Shared image"} style={{ maxWidth: "220px", maxHeight: "180px", borderRadius: "8px", display: "block", marginBottom: msg.message ? "6px" : 0 }} />}
        {!deleted && isAudio && msg.attachment_url && <audio
          controls
          src={msg.attachment_url}
          onPlay={() => onAudioPlay?.(msg.id)}
          ref={node => { if (node) onAudioReady?.(msg.id, node); }}
          style={{ maxWidth: "220px" }}
        />}
        {!deleted && !isImage && !isAudio && msg.attachment_url && (
          <a href={msg.attachment_url} target="_blank" rel="noreferrer" style={{ color: own ? "#fff" : "var(--dz-blue)", display: "block", marginBottom: msg.message ? "5px" : 0 }}>
            📎 {msg.attachment_name || "Open attachment"}
          </a>
        )}
        {deleted ? <p style={{ fontStyle: "italic", opacity: 0.7 }}>Message deleted</p> : msg.message && <p style={{ whiteSpace: "pre-wrap" }}>{msg.message}</p>}
        <div style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start", gap: "4px", marginTop: "4px" }}>
          <button type="button" onClick={() => onReply(msg)} style={{ border: "none", background: "transparent", color: own ? "rgba(255,255,255,0.8)" : "var(--text-muted)", fontSize: "0.62rem", cursor: "pointer" }}>Reply</button>
          <button type="button" onClick={() => onForward(msg)} style={{ border: "none", background: "transparent", color: own ? "rgba(255,255,255,0.8)" : "var(--text-muted)", fontSize: "0.62rem", cursor: "pointer" }}>Forward</button>
          {!deleted && <button type="button" onClick={() => onReact(msg, "👍")} style={{ border: "none", background: "transparent", color: own ? "rgba(255,255,255,0.8)" : "var(--text-muted)", fontSize: "0.62rem", cursor: "pointer" }}>👍</button>}
          {own && !deleted && <button type="button" onClick={() => onEdit(msg)} style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.8)", fontSize: "0.62rem", cursor: "pointer" }}>Edit</button>}
          {own && !deleted && <button type="button" onClick={() => onDelete(msg)} style={{ border: "none", background: "transparent", color: own ? "rgba(255,255,255,0.8)" : "var(--text-muted)", fontSize: "0.62rem", cursor: "pointer" }}>Delete</button>}
        </div>
        {reactionEntries.length > 0 && <div style={{ display: "flex", gap: "4px", marginTop: "3px", flexWrap: "wrap" }}>
          {reactionEntries.map(([emoji, users]) => <button key={emoji} type="button" onClick={() => onReact(msg, emoji)} style={{ border: "1px solid rgba(127,127,127,0.35)", borderRadius: "10px", background: "transparent", color: own ? "#fff" : "var(--text)", fontSize: "0.65rem", cursor: "pointer", padding: "1px 5px" }}>{emoji} {users.length}</button>)}
        </div>}
        <p style={{ fontSize: "0.65rem", color: own ? "rgba(255,255,255,0.72)" : "var(--text-muted)", marginTop: "3px", textAlign: "right" }}>
          {formatTime(msg.created_at)} {msg.edited_at && <span> · edited</span>} {own && <span aria-label={msg.is_read ? "Read" : "Sent"}>{msg.is_read ? "✓✓" : "✓"}</span>}
        </p>
      </div>
    </div>
  );
}

export default function ChatWidget({ embedded = false }) {
  const [open, setOpen] = useState(embedded);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [convos, setConvos] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const uploading = pendingAttachments.some(item => item.status === "uploading");
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [callStatus, setCallStatus] = useState("");
  const [callActive, setCallActive] = useState(false);
  const [callKind, setCallKind] = useState("voice");
  const [micMuted, setMicMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState("Connecting");
  const [incomingCall, setIncomingCall] = useState(null);
  const [iceServers, setIceServers] = useState([{ urls: "stun:stun.l.google.com:19302" }]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingMessage, setEditingMessage] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const recorderRef = useRef(null);
  const voiceChunks = useRef([]);
  const discardRecordingRef = useRef(false);
  const callRef = useRef(null);
  const socketRef = useRef(null);
  const activeRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const audioPlayersRef = useRef(new Map());

  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    if (!token || !user || !REALTIME_URL) return undefined;
    let disposed = false;
    import("socket.io-client").then(({ io }) => {
      if (disposed) return;
      const socket = io(REALTIME_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 8,
        reconnectionDelay: 2000,
        timeout: 8000,
      });
      socket.on("call:invite", data => {
        if (!data?.sender_id || callRef.current) {
          if (data?.sender_id) socket.emit("call:end", { receiver_id: data.sender_id });
          return;
        }
        setActive(current => current || { receiver_id: data.sender_id, name: data.sender_name || "User" });
        setIncomingCall(data);
        setCallKind(data.kind === "video" ? "video" : "voice");
        setCallStatus(`Incoming ${data.kind === "video" ? "video" : "voice"} call. Accept to connect.`);
      });
      socket.on("call:answer", async data => {
        const session = callRef.current;
        if (!session || String(session.peerUserId) !== String(data?.sender_id) || !data.answer) return;
        try {
          await session.peer.setRemoteDescription(data.answer);
          session.remoteDescriptionSet = true;
          await flushIce(session);
        setConnectionQuality("Good");
        setCallStatus("Call connected.");
        } catch (_) { setCallStatus("The call could not connect."); }
      });
      socket.on("call:ice", async data => {
        const session = callRef.current;
        if (!session || String(session.peerUserId) !== String(data?.sender_id) || !data.candidate) return;
        try {
          if (session.remoteDescriptionSet) await session.peer.addIceCandidate(data.candidate);
          else session.pendingIce.push(data.candidate);
        } catch (_) {}
      });
      socket.on("call:end", data => {
        const session = callRef.current;
        if (session && (!data?.sender_id || String(session.peerUserId) === String(data.sender_id))) {
          recordCallEvent("ended", session.peerUserId, session.kind);
          endCall(false);
        }
        setIncomingCall(null);
        setCallStatus("");
      });
      socket.on("call:busy", () => setCallStatus("The recipient is already on another call."));
      socketRef.current = socket;
    }).catch(() => {});
    return () => {
      disposed = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [token, user]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/realtime/ice`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => response.ok ? safeJson(response) : null)
      .then(data => {
        if (Array.isArray(data?.ice_servers) && data.ice_servers.length) {
          setIceServers(data.ice_servers);
        }
      })
      .catch(() => {});
  }, [token]);

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
      if (String(e.detail.receiver_id) === String(user?.id || user?.user_id)) {
        setCallStatus("You cannot chat with yourself.");
        setOpen(true);
        return;
      }
      setActive({ receiver_id: e.detail.receiver_id, name: e.detail.name || "Vendor" });
      setOpen(true);
    }
    document.addEventListener("dz:open-chat", handler);
    return () => document.removeEventListener("dz:open-chat", handler);
  }, [user]);

  const loadConvos = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API}/chat/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await safeJson(response);
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
      const response = await fetch(`${API}/chat/messages?with=${encodeURIComponent(active.receiver_id)}&q=${encodeURIComponent(searchTerm)}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await safeJson(response);
      if (response.ok) { setMessages(data.messages || []); setTyping(Boolean(data.typing)); }
    } catch (_) {}
  }, [token, active, searchTerm]);

  useEffect(() => {
    if (!active) return undefined;
    setMessages([]); setTyping(false); setSearchTerm(""); setEditingMessage(null); loadMsgs();
    const id = setInterval(loadMsgs, 4000);
    return () => clearInterval(id);
  }, [active, loadMsgs]);

  useEffect(() => {
    if (!active || !token) return;
    fetch(`${API}/chat/call-history?with=${encodeURIComponent(active.receiver_id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async response => response.ok ? safeJson(response) : null)
      .then(data => setCallHistory(Array.isArray(data?.calls) ? data.calls : []))
      .catch(() => setCallHistory([]));
  }, [active, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function uploadAttachment(file, kind = "file", existingId = null) {
    if (!file || !token) return;
    const queueId = existingId || `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (existingId) {
      setPendingAttachments(items => items.map(item => item.id === existingId
        ? { ...item, status: "uploading", error: "" } : item));
    } else {
      setPendingAttachments(items => [...items, {
        id: queueId,
        name: file.name || `${kind}.webm`,
        type: file.type || "application/octet-stream",
        kind,
        file,
        status: "uploading",
        error: "",
      }]);
    }
    try {
      const form = new FormData();
      form.append("file", file, file.name || `${kind}.webm`);
      form.append("kind", kind);
      const response = await fetch(`${API}/chat/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await safeJson(response);
      if (!response.ok || !data.success) throw new Error(data.error || "Upload failed");
      setPendingAttachments(items => items.map(item => item.id === queueId
        ? { ...item, url: data.url, name: data.name || item.name, type: data.type || item.type, status: "ready", error: "" }
        : item));
    } catch (error) {
      setPendingAttachments(items => items.map(item => item.id === queueId
        ? { ...item, status: "failed", error: error.message || "Upload failed" } : item));
      setCallStatus(error.message);
    }
  }

  function onFileSelected(event) {
    const file = event.target.files?.[0];
    if (file) uploadAttachment(file, file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "voice" : "file");
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
      discardRecordingRef.current = false;
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => e.data.size && voiceChunks.current.push(e.data);
      recorder.onstop = () => {
        const discarded = discardRecordingRef.current;
        discardRecordingRef.current = false;
        stream.getTracks().forEach(track => track.stop());
        recorderRef.current = null;
        if (!discarded) {
          uploadAttachment(new File([new Blob(voiceChunks.current, { type: recorder.mimeType || "audio/webm" })], "voice-note.webm", { type: recorder.mimeType || "audio/webm" }), "voice");
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true); setCallStatus("Recording voice note… tap the microphone to stop.");
    } catch (_) { setCallStatus("Microphone permission was not granted."); }
  }

  function cancelRecording() {
    if (!recording) return;
    discardRecordingRef.current = true;
    recorderRef.current?.stop();
    setRecording(false);
    setCallStatus("Voice note cancelled.");
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
    const failed = pendingAttachments.filter(item => item.status === "failed");
    const attachments = pendingAttachments.filter(item => item.status === "ready");
    if (failed.length) {
      setCallStatus("Retry or remove the failed attachment before sending.");
      return;
    }
    if ((!message && !attachments.length) || !active || sending) return;
    setSending(true);
    setInput(""); setPendingAttachments([]); setCallStatus("");
    try {
      if (editingMessage) {
        const response = await fetch(`${API}/chat/message`, {
          method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message_id: editingMessage.id, message }),
        });
        const data = await safeJson(response);
        if (!response.ok || !data.success) throw new Error(data.error || "Message edit failed");
        setEditingMessage(null);
        await loadMsgs();
        return;
      }
      const remaining = [...attachments];
      const outbound = attachments.length ? attachments : [null];
      for (const attachment of outbound) {
        const response = await fetch(`${API}/chat/send`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            receiver_id: active.receiver_id,
            message: attachment === outbound[0] ? message : "",
            reply_to_id: replyingTo?.id || null,
            msg_type: attachment?.kind === "image" ? "image" : attachment ? "file" : "text",
            attachment_url: attachment?.url, attachment_name: attachment?.name, attachment_type: attachment?.type,
          }),
        });
        const data = await safeJson(response);
        if (!response.ok || !data.success) throw new Error(data.error || "Message failed");
        if (attachment) remaining.shift();
      }
      setReplyingTo(null);
      await loadMsgs(); await loadConvos();
    } catch (error) {
      setPendingAttachments(remaining.map(item => ({ ...item, status: "ready" })));
      setCallStatus(error.message);
    }
    finally { setSending(false); }
  }

  function emitCall(event, data) {
    if (socketRef.current?.connected) socketRef.current.emit(event, data);
  }

  async function flushIce(session) {
    if (!session.remoteDescriptionSet) return;
    const queued = session.pendingIce.splice(0);
    for (const candidate of queued) {
      try { await session.peer.addIceCandidate(candidate); } catch (_) {}
    }
  }

  function createPeer(kind, peerUserId) {
    if (typeof RTCPeerConnection === "undefined") return null;
    const peer = new RTCPeerConnection({ iceServers });
    const session = { kind, peer, peerUserId, stream: null, pendingIce: [], remoteDescriptionSet: false };
    peer.onicecandidate = event => {
      if (event.candidate) emitCall("call:ice", { receiver_id: peerUserId, candidate: event.candidate });
    };
    peer.ontrack = event => {
      const stream = event.streams?.[0];
      if (remoteAudioRef.current && stream) remoteAudioRef.current.srcObject = stream;
      if (remoteVideoRef.current && stream) remoteVideoRef.current.srcObject = stream;
    };
    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      setConnectionQuality(state === "connected" ? "Good" : state === "connecting" ? "Connecting" : "Poor");
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
        setCallStatus("Call disconnected.");
      }
    };
    return session;
  }

  async function startCall(kind) {
    if (callRef.current) endCall();
    if (!active?.receiver_id) return;
    const session = createPeer(kind, active.receiver_id);
    if (!session || !navigator.mediaDevices?.getUserMedia) {
      session?.peer?.close();
      setCallStatus("Calling is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
      session.stream = stream;
      setMicMuted(false);
      setCameraEnabled(kind === "video");
      setConnectionQuality("Connecting");
      callRef.current = session;
      stream.getTracks().forEach(track => session.peer.addTrack(track, stream));
      const offer = await session.peer.createOffer();
      await session.peer.setLocalDescription(offer);
      setCallActive(true);
      setCallKind(kind);
      setCallStatus(`${kind === "video" ? "Video" : "Voice"} call ringing…`);
      emitCall("call:invite", {
        receiver_id: active.receiver_id,
        kind,
        offer: session.peer.localDescription,
      });
      recordCallEvent("ringing", active.receiver_id, kind);
    } catch (error) {
      session.peer.close();
      callRef.current = null;
      setCallStatus(error.name === "NotAllowedError" ? "Microphone/camera permission was not granted." : "Could not start the call.");
    }
  }

  async function acceptCall() {
    const invite = incomingCall;
    if (!invite?.sender_id) return;
    setIncomingCall(null);
    const session = createPeer(invite.kind === "video" ? "video" : "voice", invite.sender_id);
    if (!session || !navigator.mediaDevices?.getUserMedia) {
      setCallStatus("Calling is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: invite.kind === "video" });
      session.stream = stream;
      setMicMuted(false);
      setCameraEnabled(invite.kind === "video");
      setConnectionQuality("Connecting");
      callRef.current = session;
      stream.getTracks().forEach(track => session.peer.addTrack(track, stream));
      await session.peer.setRemoteDescription(invite.offer);
      session.remoteDescriptionSet = true;
      await flushIce(session);
      const answer = await session.peer.createAnswer();
      await session.peer.setLocalDescription(answer);
      setCallKind(session.kind);
      setCallActive(true);
      setCallStatus("Call connected.");
      emitCall("call:answer", { receiver_id: invite.sender_id, answer: session.peer.localDescription });
      recordCallEvent("connected", invite.sender_id, session.kind);
    } catch (error) {
      session.peer.close();
      callRef.current = null;
      emitCall("call:end", { receiver_id: invite.sender_id });
      setCallStatus(error.name === "NotAllowedError" ? "Microphone/camera permission was not granted." : "Could not accept the call.");
    }
  }

  function declineCall() {
    if (incomingCall?.sender_id) {
      emitCall("call:end", { receiver_id: incomingCall.sender_id });
      recordCallEvent("declined", incomingCall.sender_id, callKind);
    }
    setIncomingCall(null);
    setCallStatus("");
  }

  function endCall(notify = true) {
    const session = callRef.current;
    if (notify && session?.peerUserId) {
      emitCall("call:end", { receiver_id: session.peerUserId });
      recordCallEvent("ended", session.peerUserId, session.kind);
    }
    callRef.current?.stream?.getTracks().forEach(track => track.stop());
    callRef.current?.peer?.close();
    callRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setCallActive(false);
    setConnectionQuality("Connecting");
    setIncomingCall(null);
    setCallStatus("");
  }

  async function deleteMessage(message) {
    try {
      const response = await fetch(`${API}/chat/message?id=${encodeURIComponent(message.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not delete message.");
      await loadMsgs();
    } catch (error) { setCallStatus(error.message); }
  }

  async function editMessage(message) {
    setEditingMessage(message);
    setReplyingTo(null);
    setInput(message.message || "");
    setCallStatus("Editing message — changes are allowed for 15 minutes.");
  }

  async function reactToMessage(message, emoji) {
    try {
      const response = await fetch(`${API}/chat/react`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: message.id, emoji }),
      });
      if (!response.ok) throw new Error("Could not update reaction.");
      await loadMsgs();
    } catch (error) { setCallStatus(error.message); }
  }

  function recordCallEvent(status, peerId, kind) {
    if (!peerId || !token) return;
    fetch(`${API}/chat/call-event`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ peer_id: peerId, kind, status }),
    }).catch(() => {});
  }

  function toggleMute() {
    const stream = callRef.current?.stream;
    if (!stream) return;
    const next = !micMuted;
    stream.getAudioTracks().forEach(track => { track.enabled = !next; });
    setMicMuted(next);
  }

  function toggleCamera() {
    const stream = callRef.current?.stream;
    if (!stream || callKind !== "video") return;
    const next = !cameraEnabled;
    stream.getVideoTracks().forEach(track => { track.enabled = next; });
    setCameraEnabled(next);
  }

  async function switchCamera() {
    const session = callRef.current;
    if (!session || session.kind !== "video" || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const replacement = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const newTrack = replacement.getVideoTracks()[0];
      const sender = session.peer.getSenders().find(item => item.track?.kind === "video");
      if (sender && newTrack) await sender.replaceTrack(newTrack);
      const oldTrack = session.stream.getVideoTracks()[0];
      oldTrack?.stop();
      session.stream.removeTrack(oldTrack);
      session.stream.addTrack(newTrack);
      setCameraEnabled(true);
    } catch (_) { setCallStatus("Could not switch camera."); }
  }

  function forwardMessage(message) {
    const text = message.message || message.attachment_name || "attachment";
    setInput(`Forwarded: ${text}`);
    setCallStatus("Edit the forwarded message and send it.");
  }

  const handleAudioReady = useCallback((id, node) => {
    audioPlayersRef.current.set(String(id), node);
  }, []);

  const handleAudioPlay = useCallback((id) => {
    for (const [otherId, player] of audioPlayersRef.current.entries()) {
      if (otherId !== String(id) && !player.paused) player.pause();
    }
  }, []);

  if (!user) return null;
  return (
    <>
      {!embedded && <button onClick={() => setOpen(value => !value)} aria-label={open ? "Close chat" : "Open chat"} style={{
        position: "fixed", bottom: "24px", right: "24px", zIndex: 9000, width: "56px", height: "56px",
        borderRadius: "50%", background: "var(--dz-gradient)", border: "none", cursor: "pointer", fontSize: "1.3rem",
        boxShadow: "0 4px 24px rgba(0,102,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {open ? "✕" : "💬"}
        {!open && unread > 0 && <span style={{ position: "absolute", top: "2px", right: "2px", minWidth: "18px", height: "18px", borderRadius: "9px", background: "var(--danger)", border: "2px solid var(--bg)", fontSize: "0.6rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{unread > 99 ? "99+" : unread}</span>}
      </button>}

      {open && <div className="chat-widget-panel" style={{
         position: embedded ? "relative" : "fixed", bottom: embedded ? "auto" : "92px", right: embedded ? "auto" : "24px",
         zIndex: embedded ? "auto" : 9000, width: embedded ? "100%" : "min(360px, calc(100vw - 24px))",
         height: embedded ? "calc(100vh - 150px)" : "540px", minHeight: embedded ? "480px" : "0",
         borderRadius: embedded ? "0" : "20px", background: "var(--bg)", border: "1px solid var(--border)", display: "flex",
        flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.6)", overflow: "hidden",
      }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px", background: "var(--surface)" }}>
          {active ? <button type="button" onClick={() => setActive(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1rem" }}>←</button> : <span style={{ fontSize: "1.1rem" }}>💬</span>}
           <div style={{ flex: 1 }}><p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{active ? active.name : "Messages"}</p><p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{active ? (typing ? "Typing…" : "Secure chat") : "Vendor · Buyer chats"}</p></div>
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
             <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search messages…" aria-label="Search messages"
               style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", marginBottom: "10px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "0.75rem", outline: "none" }} />
             {messages.length === 0 && <div style={{ textAlign: "center", padding: "32px 12px", color: "var(--text-muted)", fontSize: "0.82rem" }}>{searchTerm ? "No matching messages." : "Say hello! 👋"}</div>}
               {messages.map((message, index) => <Bubble key={message.id || index} msg={message} myId={user.id || user.user_id} onReply={setReplyingTo} onForward={forwardMessage} onDelete={deleteMessage} onEdit={editMessage} onReact={reactToMessage} onAudioReady={handleAudioReady} onAudioPlay={handleAudioPlay} />)}
            <div ref={bottomRef} />
          </div>
           {callStatus && <div style={{ padding: "6px 12px", color: "var(--warning)", fontSize: "0.7rem", borderTop: "1px solid var(--border)" }}>{callStatus}</div>}
            {editingMessage && <div style={{ padding: "6px 12px", color: "var(--dz-blue)", fontSize: "0.72rem", borderTop: "1px solid var(--border)" }}>✏️ Editing message <button type="button" onClick={() => { setEditingMessage(null); setInput(""); setCallStatus(""); }} style={{ border: "none", background: "none", color: "var(--danger)", cursor: "pointer" }}>cancel</button></div>}
            {!editingMessage && replyingTo && <div style={{ padding: "6px 12px", color: "var(--dz-blue)", fontSize: "0.72rem", borderTop: "1px solid var(--border)" }}>↩ Replying to: {replyingTo.message || replyingTo.attachment_name || "attachment"} <button type="button" onClick={() => setReplyingTo(null)} style={{ border: "none", background: "none", color: "var(--danger)", cursor: "pointer" }}>cancel</button></div>}
            {pendingAttachments.length > 0 && <div style={{ padding: "6px 12px", borderTop: "1px solid var(--border)", maxHeight: "92px", overflowY: "auto" }}>
              {pendingAttachments.map(item => <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "6px", color: item.status === "failed" ? "var(--danger)" : "var(--dz-blue)", fontSize: "0.72rem", marginBottom: "3px" }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {item.name} {item.status === "uploading" ? "· uploading…" : item.status === "failed" ? `· ${item.error}` : "· ready"}</span>
                {item.status === "failed" && item.file && <button type="button" onClick={() => uploadAttachment(item.file, item.kind, item.id)} style={{ border: "none", background: "none", color: "var(--dz-blue)", cursor: "pointer" }}>retry</button>}
                <button type="button" onClick={() => setPendingAttachments(items => items.filter(entry => entry.id !== item.id))} style={{ border: "none", background: "none", color: "var(--danger)", cursor: "pointer" }}>remove</button>
              </div>)}
            </div>}
           {emojiOpen && <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", display: "flex", flexWrap: "wrap", gap: "4px", background: "var(--surface)" }}>
             {EMOJIS.map(emoji => (
               <button key={emoji} type="button" onClick={() => setInput(value => `${value}${emoji}`)} aria-label={`Add ${emoji}`} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "1.15rem", padding: "3px" }}>{emoji}</button>
             ))}
           </div>}
          <form onSubmit={send} style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", display: "flex", gap: "6px", alignItems: "center" }}>
              <label title="Upload image, document, PDF, audio, or video" style={{ cursor: uploading ? "wait" : "pointer", color: "var(--text-secondary)", fontSize: "1.1rem" }}>📎<input type="file" hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,audio/*,video/*" capture="environment" onChange={onFileSelected} disabled={uploading} /></label>
             <button type="button" title="Choose emoji" onClick={() => setEmojiOpen(value => !value)} style={{ border: "none", background: "none", cursor: "pointer", color: emojiOpen ? "var(--dz-blue)" : "var(--text-secondary)", fontSize: "1.05rem" }}>😊</button>
             {recording && <button type="button" title="Cancel voice note" onClick={cancelRecording} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--danger)", fontSize: "1rem" }}>✕</button>}
            <button type="button" title="Record voice note" onClick={toggleRecording} style={{ border: "none", background: "none", cursor: "pointer", color: recording ? "var(--danger)" : "var(--text-secondary)", fontSize: "1.05rem" }}>{recording ? "⏹️" : "🎤"}</button>
             <input value={input} onChange={event => { setInput(event.target.value); notifyTyping(); }} placeholder={recording ? "Recording voice note…" : editingMessage ? "Update message…" : "Type a message…"} disabled={sending || recording} style={{ flex: 1, minWidth: 0, padding: "9px 10px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "0.85rem", outline: "none" }} />
             <button type="submit" disabled={sending || uploading || (!input.trim() && !pendingAttachments.some(item => item.status === "ready"))} style={{ padding: "9px 12px", borderRadius: "12px", background: "var(--dz-gradient)", border: "none", cursor: "pointer", color: "#fff" }}>→</button>
          </form>
        </>}
      </div>}
    </>
  );
}