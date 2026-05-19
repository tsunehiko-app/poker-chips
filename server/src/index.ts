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
import { simulate, SimulationInput, analyzeOuts } from './poker';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const isDev = process.env.NODE_ENV !== 'production';

const app = express();
app.use(cors());
app.use(express.json());

// ===== API ルート（静的ファイルより先に定義）=====

// ヘルスチェック
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ポーカーオッズ計算API
app.post('/api/odds/calculate', (req, res) => {
  try {
    const { myHand, board, opponents, simulations } = req.body as SimulationInput;

    if (!myHand || myHand.length !== 2) {
      return res.status(400).json({ error: '手札は2枚必要です' });
    }
    if (board && board.length > 5) {
      return res.status(400).json({ error: 'ボードは最大5枚です' });
    }
    if (!opponents || opponents.length < 1) {
      return res.status(400).json({ error: '相手は1人以上必要です' });
    }

    const simCount = Math.min(simulations || 10000, 50000);

    const result = simulate({
      myHand,
      board: board || [],
      opponents,
      simulations: simCount,
    });

    // アウツ分析（相手ハンド情報を渡してライブアウツ計算）
    const opponentHands = opponents
      .filter(op => op.hand && op.hand.length === 2)
      .map(op => op.hand!);
    const outsAnalysis = analyzeOuts(myHand, board || [], opponentHands);

    res.json({ ...result, outs: outsAnalysis });
  } catch (err: any) {
    res.status(400).json({ error: err.message || '計算エラー' });
  }
});

app.post('/api/odds/outs', (req, res) => {
  try {
    const { myHand, board } = req.body;
    if (!myHand || myHand.length !== 2) {
      return res.status(400).json({ error: '手札は2枚必要です' });
    }
    const result = analyzeOuts(myHand, board || []);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || '分析エラー' });
  }
});

// ===== 本番環境：クライアント配信 =====
if (!isDev) {
  // ポーカーオッズクライアント（/odds/ パス）
  const oddsDist = path.join(__dirname, '../../../../odds-client/dist');
  app.use('/odds', express.static(oddsDist));
  app.get('/odds/*', (_req, res) => {
    res.sendFile(path.join(oddsDist, 'index.html'));
  });

  // ポーカーチップスクライアント（/ パス）
  const clientDist = path.join(__dirname, '../../../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

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
  if (!isDev) {
    console.log(`[Server] チップス: /`);
    console.log(`[Server] オッズ: /odds/`);
  }
});
