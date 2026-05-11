import { io, Socket } from 'socket.io-client';
import { useState, useEffect } from 'react';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types';

const URL = import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

export function useSocketConnected(): boolean {
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return connected;
}
