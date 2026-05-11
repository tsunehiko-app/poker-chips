import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  GameSettings,
  Player,
  RoomInfo,
} from '../../../shared/types';
import { generateRoomCode } from '../utils/roomCode';
import { GameManager } from '../game/GameManager';

// ルームの状態
export interface RoomState {
  roomCode: string;
  players: Player[];
  settings: GameSettings;
  isGameStarted: boolean;
  isPaused: boolean;
  gameManager: GameManager | null;
}

// ソケットID → プレイヤーIDのマッピング
const socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();

// ルームストア
const rooms = new Map<string, RoomState>();

export function getRooms(): Map<string, RoomState> {
  return rooms;
}

export function getSocketToPlayer(): Map<string, { roomCode: string; playerId: string }> {
  return socketToPlayer;
}

function buildRoomInfo(room: RoomState): RoomInfo {
  return {
    roomCode: room.roomCode,
    hostName: room.players.find((p) => p.isHost)?.name || '',
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isConnected: p.isConnected,
    })),
    settings: room.settings,
    isGameStarted: room.isGameStarted,
  };
}

export function registerRoomHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
): void {
  // ルーム作成
  socket.on('room:create', ({ hostName, settings }) => {
    // ユニークなルームコードを生成
    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const playerId = uuidv4();
    const host: Player = {
      id: playerId,
      name: hostName,
      chips: settings.initialChips,
      currentBet: 0,
      totalBet: 0,
      status: 'active',
      rebuyCount: 0,
      isHost: true,
      isConnected: true,
      seatIndex: 0,
    };

    const room: RoomState = {
      roomCode,
      players: [host],
      settings: { ...settings },
      isGameStarted: false,
      isPaused: false,
      gameManager: null,
    };

    rooms.set(roomCode, room);
    socketToPlayer.set(socket.id, { roomCode, playerId });
    socket.join(roomCode);

    console.log(`[Room] ルーム ${roomCode} を作成 (ホスト: ${hostName})`);

    socket.emit('room:created', { roomCode, playerId });
    io.to(roomCode).emit('room:playerJoined', { roomInfo: buildRoomInfo(room) });
  });

  // ルーム参加
  socket.on('room:join', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('error', { message: 'ルームが見つかりません' });
      return;
    }

    if (room.isGameStarted) {
      socket.emit('error', { message: 'ゲームは既に開始されています' });
      return;
    }

    if (room.players.length >= 10) {
      socket.emit('error', { message: 'ルームが満員です（最大10人）' });
      return;
    }

    const playerId = uuidv4();
    const player: Player = {
      id: playerId,
      name: playerName,
      chips: room.settings.initialChips,
      currentBet: 0,
      totalBet: 0,
      status: 'active',
      rebuyCount: 0,
      isHost: false,
      isConnected: true,
      seatIndex: room.players.length,
    };

    room.players.push(player);
    socketToPlayer.set(socket.id, { roomCode, playerId });
    socket.join(roomCode);

    console.log(`[Room] ${playerName} がルーム ${roomCode} に参加`);

    const roomInfo = buildRoomInfo(room);
    socket.emit('room:joined', { playerId, roomInfo });
    io.to(roomCode).emit('room:playerJoined', { roomInfo });
  });

  // 再接続
  socket.on('room:rejoin', ({ roomCode, playerId }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('error', { message: 'ルームが見つかりません' });
      return;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      socket.emit('error', { message: 'プレイヤーが見つかりません' });
      return;
    }

    // 古いマッピングを削除
    for (const [sid, info] of socketToPlayer.entries()) {
      if (info.playerId === playerId) {
        socketToPlayer.delete(sid);
      }
    }

    player.isConnected = true;
    socketToPlayer.set(socket.id, { roomCode, playerId });
    socket.join(roomCode);

    // GameManagerの接続状態も更新
    if (room.gameManager) {
      room.gameManager.setPlayerConnected(playerId, true);
    }

    console.log(`[Room] ${player.name} がルーム ${roomCode} に再接続`);

    const roomInfo = buildRoomInfo(room);
    socket.emit('room:joined', { playerId, roomInfo });
    io.to(roomCode).emit('room:playerJoined', { roomInfo });

    // ゲームが進行中なら現在の状態を送信
    if (room.isGameStarted && room.gameManager) {
      const gameState = room.gameManager.getState();
      socket.emit('game:stateUpdate', { gameState });

      // 自分のターンならアクション情報も送信
      if (
        gameState.players[gameState.currentPlayerIndex]?.id === playerId &&
        gameState.phase !== 'waiting' &&
        gameState.phase !== 'showdown'
      ) {
        const actions = room.gameManager.getAvailableActions(playerId);
        socket.emit('game:yourTurn', { availableActions: actions });
      }
    }
  });

  // 切断処理
  socket.on('disconnect', () => {
    const info = socketToPlayer.get(socket.id);
    if (!info) return;

    const { roomCode, playerId } = info;
    const room = rooms.get(roomCode);
    if (!room) {
      socketToPlayer.delete(socket.id);
      return;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      socketToPlayer.delete(socket.id);
      return;
    }

    // プレイヤーを切断状態にする（削除はしない）
    player.isConnected = false;

    // GameManagerの接続状態も更新
    if (room.gameManager) {
      room.gameManager.setPlayerConnected(playerId, false);
    }

    console.log(`[Room] ${player.name} がルーム ${roomCode} から切断`);

    socketToPlayer.delete(socket.id);
    io.to(roomCode).emit('room:playerLeft', { roomInfo: buildRoomInfo(room) });

    // ゲーム開始前で全員切断したらルームを削除
    if (!room.isGameStarted) {
      const connected = room.players.filter((p) => p.isConnected);
      if (connected.length === 0) {
        rooms.delete(roomCode);
        console.log(`[Room] ルーム ${roomCode} を削除（全員退出）`);
      }
    }
  });
}
