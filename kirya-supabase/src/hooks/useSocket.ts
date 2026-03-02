/**
 * useSocket
 * ─────────
 * Singleton socket.io-client connection shared across all components.
 * Automatically reconnects, and provides a typed event API.
 *
 * Usage:
 *   const { socket, connected } = useSocket();
 *   socket.emit('rider:location', { ... });
 *   socket.on('riders:update', callback);
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// In dev, Vite proxies /socket.io → localhost:4000
// In production, the server serves both the app and WebSocket on the same port
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket || _socket.disconnected) {
    _socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return _socket;
}

export function useSocket() {
  const socket = useRef<Socket>(getSocket());
  const [connected, setConnected] = useState(socket.current.connected);

  useEffect(() => {
    const s = socket.current;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    // Trigger connection if not already connected
    if (!s.connected) s.connect();

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      // Don't disconnect the singleton — other components still use it
    };
  }, []);

  return { socket: socket.current, connected };
}
