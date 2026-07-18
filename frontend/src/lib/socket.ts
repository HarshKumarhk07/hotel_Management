import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api';

/**
 * Lazily-connected Socket.io client. Connects to the backend origin (the API URL
 * without its `/api/v1` suffix) and authenticates with the in-memory access
 * token — the same one used for REST.
 */
let socket: Socket | null = null;

function socketOrigin(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
  return apiUrl.replace(/\/api\/v\d+\/?$/, '');
}

export function getSocket(): Socket {
  if (socket?.connected) return socket;
  if (!socket) {
    socket = io(socketOrigin(), {
      autoConnect: false,
      transports: ['websocket'],
      auth: (cb) => cb({ token: getAccessToken() }),
    });
  }
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
