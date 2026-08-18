# DUNAZOE Chat System Update

**Updated:** 2026-08-17  
**Architecture:** existing Socket.IO realtime service retained

## Supported behavior

- Authenticated conversation list and message history.
- Text messages with sent/read receipts.
- Typing state with a short-lived database presence row.
- Image, document, PDF, and video attachment selection.
- Voice-note recording, upload, preview, and playback.
- Voice and video call controls expose a `RTCPeerConnection` session boundary ready for signaling.

## Storage behavior

`POST /api/chat/upload` uses the existing Cloudinary account when the three Cloudinary environment values are configured. If storage is not configured, development-only data URLs are allowed up to 2 MB; larger files fail explicitly instead of being silently lost. Production file storage should be configured before relying on attachment durability.

The chat route performs additive schema setup for `attachment_url`, `attachment_name`, `attachment_type`, and the `chat_typing` table. The original `chat_messages` text/is_read contract remains compatible with the existing realtime service.

## Files changed

- `apps/core/frontend/src/app/api/chat/[action]/route.js` — authenticated conversations, messages, send, upload, typing, and read receipt behavior.
- `apps/core/frontend/src/components/ChatWidget.jsx` — responsive UI, attachments, voice notes, receipts, typing indicator, and call controls.
- `apps/core/frontend/src/app/globals.css` — narrow-screen chat panel sizing.

## Manual checks before publish

- Sign in with a normal user account and open the widget.
- Send a text between two accounts; confirm the second account sees `✓✓` after opening the conversation.
- Upload one image and one PDF/document; confirm the recipient can open them.
- Record and send a voice note; confirm playback.
- Verify call buttons report browser/session readiness without claiming a connected call.
- Configure durable Cloudinary storage before production attachment use.