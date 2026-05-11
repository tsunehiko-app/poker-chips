import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/types';
import { registerRoomHandlers } from './handlers/roomHandler';
import { registerGameHandlers } from './handlers/gameHandler';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const isDev = process.env.NODE_ENV !== 'production';

const app = express();
app.use(cors());
app.use(express.json());

// 本番環境ではクライアントのビルドをサーブ
if (!isDev) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ヘルスチェック
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: isDev
    ? {
        origin: '*',
        methods: ['GET', 'POST'],
      }
    : undefined,
});

io.on('connection', (socket) => {
  console.log(`[Socket] 接続: ${socket.id}`);

  registerRoomHandlers(io, socket);
  registerGameHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`[Socket] 切断: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Server] ポーカーチップ管理サーバーを起動しました`);
  console.log(`[Server] ポート: ${PORT}`);
  console.log(`[Server] 環境: ${isDev ? '開発' : '本番'}`);
});
