import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = window.location.hostname === 'localhost'
      ? ``
      : `${window.location.protocol}//${window.location.host}`;

    const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token');

    socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
      auth: { token },
    });
  }
  return socket;
}

export function connectSocket(_userId: string) {
  const s = getSocket();
  if (!s.connected) {
    // Update token before connecting (may have refreshed)
    const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token');
    s.auth = { token };
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
