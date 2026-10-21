import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket;
export function getSocket() {
  if (!socket) socket = io(import.meta.env.VITE_SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'] });
  return socket;
}
export function resetSocket() { if (socket) { socket.disconnect(); socket = null; } }

// useSocketEvent('tournament:update', handler, { room: tournamentId })
export default function useSocketEvent(event, handler, { room, enabled = true } = {}) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return undefined;
    const s = getSocket();
    const join = () => room && s.emit('tournament:join', room);
    const on = (...args) => ref.current(...args);
    join();
    s.on('connect', join);
    s.on(event, on);
    return () => { s.off(event, on); s.off('connect', join); if (room) s.emit('tournament:leave', room); };
  }, [event, room, enabled]);
}
