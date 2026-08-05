"use client";
/**
 * useOrderSocket — Socket.IO hook for real-time order tracking.
 * Connects to realtime-service (port 4021) and joins the order room.
 * Gracefully degrades if the service is unreachable.
 *
 * Usage:
 *   const { connected } = useOrderSocket({
 *     orderId, token,
 *     onStatusUpdate: (data) => setStatus(data.status),
 *     onLocation:     (data) => setCoords({ lat: data.lat, lng: data.lng }),
 *   });
 */
import { useEffect, useRef, useState, useCallback } from "react";

const REALTIME_URL =
  process.env.NEXT_PUBLIC_REALTIME_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:4021`
    : null);

export function useOrderSocket({ orderId, token, onStatusUpdate, onLocation, onMessage } = {}) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!orderId || !token || !REALTIME_URL) return;

    let socket;
    let destroyed = false;

    import("socket.io-client")
      .then(({ io }) => {
        if (destroyed) return;

        socket = io(REALTIME_URL, {
          auth: { token },
          transports: ["websocket", "polling"],
          reconnectionAttempts: 5,
          reconnectionDelay: 3000,
          timeout: 8000,
        });

        socket.on("connect", () => {
          if (!destroyed) {
            setConnected(true);
            socket.emit("join:order", orderId);
          }
        });

        socket.on("disconnect", () => { if (!destroyed) setConnected(false); });
        socket.on("connect_error", () => { if (!destroyed) setConnected(false); });

        socket.on("order:status_update", (data) => {
          if (!destroyed && onStatusUpdate) onStatusUpdate(data);
        });

        socket.on("agent:location", (data) => {
          if (!destroyed && onLocation) onLocation(data);
        });

        socket.on("chat:message", (data) => {
          if (!destroyed && onMessage) onMessage(data);
        });

        socketRef.current = socket;
      })
      .catch(() => {}); // graceful: no socket.io-client → no crash

    return () => {
      destroyed = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, token]);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) socketRef.current.emit(event, data);
  }, []);

  return { connected, emit };
}
