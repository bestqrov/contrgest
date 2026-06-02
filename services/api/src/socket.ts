import { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@field-ops/shared';
import { createLogger } from '@field-ops/shared';
import http from 'http';

const logger = createLogger('api:socket');

let _io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

export function initSocketIO(
  httpServer: http.Server,
  corsOrigin: string,
): Server<ClientToServerEvents, ServerToClientEvents> {
  _io = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
    transports: ['websocket', 'polling'],
  });

  _io.on('connection', (socket) => {
    logger.info('Dashboard connected', { socketId: socket.id });

    socket.on('join', (room) => {
      socket.join(room);
      logger.debug('Socket joined room', { socketId: socket.id, room });
    });

    socket.on('disconnect', () => {
      logger.info('Dashboard disconnected', { socketId: socket.id });
    });
  });

  return _io;
}

export function getIO(): Server<ClientToServerEvents, ServerToClientEvents> {
  if (!_io) throw new Error('Socket.io not initialized');
  return _io;
}
