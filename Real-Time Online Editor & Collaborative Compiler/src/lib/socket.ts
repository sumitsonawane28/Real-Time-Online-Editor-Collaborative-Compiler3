import { io, Socket } from 'socket.io-client';

// Set VITE_BACKEND_URL in your .env.local (dev) or Vercel env vars (prod).
// Example: VITE_BACKEND_URL=https://nexuscode-backend.onrender.com
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const socket: Socket = io(BACKEND_URL, {
  autoConnect:          true,
  transports:           ['websocket', 'polling'],
  reconnection:         true,
  reconnectionAttempts: 10,
  reconnectionDelay:    1000,
  reconnectionDelayMax: 5000,
  withCredentials:      true,
});

if (import.meta.env.DEV) {
  socket.on('connect',         () => console.log('[socket] ✓ connected', socket.id));
  socket.on('disconnect',      (r) => console.log('[socket] ✗ disconnected', r));
  socket.on('connect_error',   (e) => console.warn('[socket] connect_error', e.message));
  socket.on('reconnect',       (n) => console.log('[socket] ↺ reconnected after', n, 'attempts'));
}
