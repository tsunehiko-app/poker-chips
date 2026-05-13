import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  GamePhase,
} from '../../../shared/types';
import { GameManager } from '../game/GameManager';
import { getRooms, getSocketToPlayer } from './roomHandler';

function getPlayerIdFromSocket(socketId: string): { roomCode: string; playerId: string } | null {
  return getSocketToPlayer().get(socketId) || null;
}

function isHost(roomCode: string, playerId: string): boolean {
  const room = getRooms().get(roomCode);
  if (!room) return false;
  const player = room.players.find((p) => p.id === playerId);
  return player?.isHost || false;
}

export function registerGameHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
): void {
  // ゲーム開始（席順付き）
  socket.on('game:start', (data: { roomCode: string; seatOrder?: string[] }) => {
    const { roomCode, seatOrder } = data as any;
    const info = getPlayerIdFromSocket(socket.id);
    if (!info || info.roomCode !== roomCode) {
      socket.emit('error', { message: '不正なリクエストです' });
      return;
    }

    if (!isHost(roomCode, info.playerId)) {
      socket.emit('error', { message: 'ホストのみがゲームを開始できます' });
      return;
    }

    const room = getRooms().get(roomCode);
    if (!room) {
      socket.emit('error', { message: 'ルームが見つかりません' });
      return;
    }

    if (room.isGameStarted) {
      socket.emit('error', { message: 'ゲームは既に開始されています' });
      return;
    }

    const connectedPlayers = room.players.filter((p) => p.isConnected);
    if (connectedPlayers.length < 2) {
      socket.emit('error', { message: '2人以上のプレイヤーが必要です' });
      return;
    }

    // 席順の適用（3人以上でseatOrderが指定された場合）
    if (seatOrder && Array.isArray(seatOrder) && seatOrder.length === room.players.length) {
      const ordered = seatOrder.map((id: string, idx: number) => {
        const p = room.players.find((pl) => pl.id === id);
        if (p) p.seatIndex = idx;
        return p;
      }).filter(Boolean) as typeof room.players;
      if (ordered.length === room.players.length) {
        room.players = ordered;
      }
    }

    // GameManagerを作成
    room.gameManager = new GameManager(roomCode, room.settings, room.players);
    room.isGameStarted = true;

    // 最初のハンドを開始
    const gameState = room.gameManager.startNewHand();

    console.log(`[Game] ルーム ${roomCode} のゲームを開始 (${room.players.length}人)`);

    io.to(roomCode).emit('game:started', { gameState });
    io.to(roomCode).emit('game:stateUpdate', { gameState });

    // 最初のプレイヤーにターン通知
    notifyCurrentPlayer(io, room.gameManager, roomCode);
  });

  // プレイヤーアクション
  socket.on('game:action', ({ roomCode, action, amount }) => {
    const info = getPlayerIdFromSocket(socket.id);
    if (!info || info.roomCode !== roomCode) {
      socket.emit('error', { message: '不正なリクエストです' });
      return;
    }

    const room = getRooms().get(roomCode);
    if (!room || !room.gameManager) {
      socket.emit('error', { message: 'ゲームが開始されていません' });
      return;
    }

    if (room.isPaused) {
      socket.emit('error', { message: 'ゲームが一時停止中です' });
      return;
    }

    const gm = room.gameManager;
    const gameStateBefore = gm.getState();
    const player = gameStateBefore.players.find((p) => p.id === info.playerId);

    if (!player) {
      socket.emit('error', { message: 'プレイヤーが見つかりません' });
      return;
    }

    try {
      const result = gm.handleAction(info.playerId, action, amount);

      console.log(`[Game] ${player.name} → ${action}${amount ? ' ' + amount : ''} | roundComplete=${result.roundComplete} autoWin=${result.autoWin} isAllInRunout=${gm.isAllInRunout()}`);

      // アクション結果をブロードキャスト
      const gameState = gm.getState();
      const actionAmount = gameState.lastAction?.amount || 0;

      io.to(roomCode).emit('game:actionResult', {
        playerId: info.playerId,
        playerName: player.name,
        action,
        amount: actionAmount,
      });

      if (result.autoWin) {
        // 1人だけ残った → 自動勝利
        const handResult = gm.autoResolveWinner();
        const finalState = gm.getState();

        io.to(roomCode).emit('game:handResult', {
          result: handResult,
          gameState: finalState,
        });

        // バスト通知
        handResult.bustedPlayers.forEach((bp) => {
          io.to(roomCode).emit('game:playerBusted', {
            playerId: bp.playerId,
            playerName: bp.playerName,
          });
        });

        io.to(roomCode).emit('game:stateUpdate', { gameState: finalState });
        console.log(
          `[Game] ルーム ${roomCode} ハンド${finalState.handNumber}: 自動勝利`
        );
        return;
      }

      if (result.roundComplete) {
        // ラウンド終了 → フェーズを進める
        // アクティブプレイヤーが0-1人（全員オールイン）の場合、ショーダウンまで自動進行
        if (gm.isAllInRunout()) {
          // ショーダウンまで自動進行
          let currentState = gm.getState();
          const phaseOrder: GamePhase[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
          const currentPhaseIdx = phaseOrder.indexOf(currentState.phase);

          for (let i = currentPhaseIdx; i < phaseOrder.length - 1; i++) {
            const advancedState = gm.advancePhase();
            if (advancedState.phase === 'showdown') break;
          }

          // ショーダウンでなければもう一回進める
          currentState = gm.getState();
          if (currentState.phase !== 'showdown') {
            gm.advancePhase();
          }

          const showdownState = gm.getState();
          io.to(roomCode).emit('game:showdown', { gameState: showdownState });
          io.to(roomCode).emit('game:stateUpdate', { gameState: showdownState });
          console.log(
            `[Game] ルーム ${roomCode}: オールインランアウト → ショーダウン`
          );
          return;
        }

        // 通常のラウンド終了
        const advancedState = gm.advancePhase();

        if (advancedState.phase === 'showdown') {
          io.to(roomCode).emit('game:showdown', { gameState: advancedState });
          io.to(roomCode).emit('game:stateUpdate', { gameState: advancedState });
          console.log(`[Game] ルーム ${roomCode}: ショーダウン`);
        } else {
          io.to(roomCode).emit('game:roundEnd', {
            phase: advancedState.phase,
            pot: advancedState.pot,
          });
          io.to(roomCode).emit('game:stateUpdate', { gameState: advancedState });
          notifyCurrentPlayer(io, gm, roomCode);
        }
      } else {
        // ラウンド継続中
        io.to(roomCode).emit('game:stateUpdate', { gameState });
        notifyCurrentPlayer(io, gm, roomCode);
      }
    } catch (err: any) {
      socket.emit('error', { message: err.message || 'アクションに失敗しました' });
    }
  });

  // 次のラウンドへ（ホストのみ）— ベッティング中は進行不可
  socket.on('game:nextRound', ({ roomCode }) => {
    const info = getPlayerIdFromSocket(socket.id);
    if (!info || info.roomCode !== roomCode) {
      socket.emit('error', { message: '不正なリクエストです' });
      return;
    }

    if (!isHost(roomCode, info.playerId)) {
      socket.emit('error', { message: 'ホストのみが操作できます' });
      return;
    }

    const room = getRooms().get(roomCode);
    if (!room || !room.gameManager) {
      socket.emit('error', { message: 'ゲームが開始されていません' });
      return;
    }

    // ベッティング中はフェーズを進められない
    const currentState = room.gameManager.getState();
    const activeBettors = currentState.players.filter((p) => p.status === 'active');
    if (activeBettors.length > 0 && currentState.phase !== 'showdown') {
      socket.emit('error', { message: 'ベッティングが完了するまで次のラウンドに進めません' });
      return;
    }

    try {
      const gameState = room.gameManager.advancePhase();

      if (gameState.phase === 'showdown') {
        io.to(roomCode).emit('game:showdown', { gameState });
      } else {
        io.to(roomCode).emit('game:roundEnd', {
          phase: gameState.phase,
          pot: gameState.pot,
        });
        notifyCurrentPlayer(io, room.gameManager, roomCode);
      }

      io.to(roomCode).emit('game:stateUpdate', { gameState });
    } catch (err: any) {
      socket.emit('error', { message: err.message || 'フェーズ進行に失敗しました' });
    }
  });

  // 勝者選択（ホストのみ）
  socket.on('game:selectWinner', ({ roomCode, winnerIds }) => {
    const info = getPlayerIdFromSocket(socket.id);
    if (!info || info.roomCode !== roomCode) {
      socket.emit('error', { message: '不正なリクエストです' });
      return;
    }

    if (!isHost(roomCode, info.playerId)) {
      socket.emit('error', { message: 'ホストのみが勝者を選択できます' });
      return;
    }

    const room = getRooms().get(roomCode);
    if (!room || !room.gameManager) {
      socket.emit('error', { message: 'ゲームが開始されていません' });
      return;
    }

    try {
      const handResult = room.gameManager.selectWinners(winnerIds);
      const gameState = room.gameManager.getState();

      io.to(roomCode).emit('game:handResult', {
        result: handResult,
        gameState,
      });

      // バスト通知
      handResult.bustedPlayers.forEach((bp) => {
        io.to(roomCode).emit('game:playerBusted', {
          playerId: bp.playerId,
          playerName: bp.playerName,
        });
      });

      io.to(roomCode).emit('game:stateUpdate', { gameState });

      console.log(
        `[Game] ルーム ${roomCode} ハンド${gameState.handNumber}: 勝者 ${winnerIds.join(', ')}`
      );
    } catch (err: any) {
      socket.emit('error', { message: err.message || '勝者選択に失敗しました' });
    }
  });

  // 次のハンドへ（ホストのみ）
  socket.on('game:nextHand', ({ roomCode }) => {
    const info = getPlayerIdFromSocket(socket.id);
    if (!info || info.roomCode !== roomCode) {
      socket.emit('error', { message: '不正なリクエストです' });
      return;
    }

    if (!isHost(roomCode, info.playerId)) {
      socket.emit('error', { message: 'ホストのみが操作できます' });
      return;
    }

    const room = getRooms().get(roomCode);
    if (!room || !room.gameManager) {
      socket.emit('error', { message: 'ゲームが開始されていません' });
      return;
    }

    // アクティブプレイヤーが2人以上いるかチェック
    const gameState = room.gameManager.getState();
    const playablePlayers = gameState.players.filter(
      (p) => p.status !== 'busted' || p.chips > 0
    );
    if (playablePlayers.length < 2) {
      socket.emit('error', { message: 'プレイ可能なプレイヤーが2人未満です' });
      return;
    }

    // sitting_outのプレイヤーをactiveに戻す
    gameState.players.forEach((p) => {
      if (p.status === 'sitting_out') {
        p.status = 'active';
      }
    });

    // トーナメント: レベルアップチェック
    if (room.gameManager.isTournament()) {
      const levelUp = room.gameManager.checkTournamentLevelUp();
      if (levelUp) {
        io.to(roomCode).emit('tournament:levelUp', {
          level: levelUp.newLevel,
          nextLevel: levelUp.nextLevel,
          tournament: room.gameManager.getTournamentState()!,
        });
        console.log(`[Tournament] ルーム ${roomCode}: レベルアップ → Lv.${levelUp.newLevel.level} (${levelUp.newLevel.sb}/${levelUp.newLevel.bb})`);
      }
    }

    const newState = room.gameManager.startNewHand();

    console.log(`[Game] ルーム ${roomCode}: ハンド${newState.handNumber} 開始`);

    io.to(roomCode).emit('game:stateUpdate', { gameState: newState });
    notifyCurrentPlayer(io, room.gameManager, roomCode);
  });

  // リバイ
  socket.on('game:rebuy', ({ roomCode }) => {
    const info = getPlayerIdFromSocket(socket.id);
    if (!info || info.roomCode !== roomCode) {
      socket.emit('error', { message: '不正なリクエストです' });
      return;
    }

    const room = getRooms().get(roomCode);
    if (!room || !room.gameManager) {
      socket.emit('error', { message: 'ゲームが開始されていません' });
      return;
    }

    try {
      const player = room.gameManager.handleRebuy(info.playerId);
      const gameState = room.gameManager.getState();

      io.to(roomCode).emit('game:playerRebuyed', {
        playerId: player.id,
        playerName: player.name,
        rebuyCount: player.rebuyCount,
        chips: player.chips,
      });

      io.to(roomCode).emit('game:stateUpdate', { gameState });

      console.log(
        `[Game] ルーム ${roomCode}: ${player.name} がリバイ (${player.rebuyCount}回目)`
      );
    } catch (err: any) {
      socket.emit('error', { message: err.message || 'リバイに失敗しました' });
    }
  });

  // 一時停止
  socket.on('game:pause', ({ roomCode }) => {
    const info = getPlayerIdFromSocket(socket.id);
    if (!info || info.roomCode !== roomCode) {
      socket.emit('error', { message: '不正なリクエストです' });
      return;
    }

    if (!isHost(roomCode, info.playerId)) {
      socket.emit('error', { message: 'ホストのみが操作できます' });
      return;
    }

    const room = getRooms().get(roomCode);
    if (!room) return;

    room.isPaused = true;
    io.to(roomCode).emit('game:paused');
    console.log(`[Game] ルーム ${roomCode}: 一時停止`);
  });

  // 再開
  socket.on('game:resume', ({ roomCode }) => {
    const info = getPlayerIdFromSocket(socket.id);
    if (!info || info.roomCode !== roomCode) {
      socket.emit('error', { message: '不正なリクエストです' });
      return;
    }

    if (!isHost(roomCode, info.playerId)) {
      socket.emit('error', { message: 'ホストのみが操作できます' });
      return;
    }

    const room = getRooms().get(roomCode);
    if (!room) return;

    room.isPaused = false;
    io.to(roomCode).emit('game:resumed');
    console.log(`[Game] ルーム ${roomCode}: 再開`);
  });

  // トーナメント: 一時停止
  socket.on('tournament:pause', ({ roomCode }) => {
    const info = getPlayerIdFromSocket(socket.id);
    if (!info || !isHost(roomCode, info.playerId)) return;

    const room = getRooms().get(roomCode);
    if (!room?.gameManager?.isTournament()) return;

    const t = room.gameManager.pauseTournament();
    if (t) {
      io.to(roomCode).emit('tournament:paused', { tournament: t });
      console.log(`[Tournament] ルーム ${roomCode}: 一時停止`);
    }
  });

  // トーナメント: 再開
  socket.on('tournament:resume', ({ roomCode }) => {
    const info = getPlayerIdFromSocket(socket.id);
    if (!info || !isHost(roomCode, info.playerId)) return;

    const room = getRooms().get(roomCode);
    if (!room?.gameManager?.isTournament()) return;

    const t = room.gameManager.resumeTournament();
    if (t) {
      io.to(roomCode).emit('tournament:resumed', { tournament: t });
      console.log(`[Tournament] ルーム ${roomCode}: 再開`);
    }
  });

  // トーナメント: レベルスキップ
  socket.on('tournament:skipLevel', ({ roomCode }) => {
    const info = getPlayerIdFromSocket(socket.id);
    if (!info || !isHost(roomCode, info.playerId)) return;

    const room = getRooms().get(roomCode);
    if (!room?.gameManager?.isTournament()) return;

    const levelUp = room.gameManager.advanceTournamentLevel();
    if (levelUp) {
      io.to(roomCode).emit('tournament:levelUp', {
        level: levelUp.newLevel,
        nextLevel: levelUp.nextLevel,
        tournament: room.gameManager.getTournamentState()!,
      });
      io.to(roomCode).emit('game:stateUpdate', { gameState: room.gameManager.getState() });
      console.log(`[Tournament] ルーム ${roomCode}: レベルスキップ → Lv.${levelUp.newLevel.level}`);
    }
  });

  // ゲーム終了
  socket.on('game:end', ({ roomCode }) => {
    const info = getPlayerIdFromSocket(socket.id);
    if (!info || info.roomCode !== roomCode) {
      socket.emit('error', { message: '不正なリクエストです' });
      return;
    }

    if (!isHost(roomCode, info.playerId)) {
      socket.emit('error', { message: 'ホストのみが操作できます' });
      return;
    }

    const room = getRooms().get(roomCode);
    if (!room || !room.gameManager) {
      socket.emit('error', { message: 'ゲームが開始されていません' });
      return;
    }

    const results = room.gameManager.getFinalResults();
    room.isGameStarted = false;
    room.gameManager = null;

    io.to(roomCode).emit('game:ended', { results });
    console.log(`[Game] ルーム ${roomCode}: ゲーム終了`);
  });
}

/**
 * 現在のプレイヤーにターン通知を送る
 */
function notifyCurrentPlayer(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  gm: GameManager,
  roomCode: string
): void {
  const state = gm.getState();
  if (state.phase === 'waiting' || state.phase === 'showdown') return;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.status !== 'active') return;

  const actions = gm.getAvailableActions(currentPlayer.id);

  // 該当プレイヤーのソケットを探して通知
  const socketToPlayer = getSocketToPlayer();
  for (const [socketId, info] of socketToPlayer.entries()) {
    if (info.roomCode === roomCode && info.playerId === currentPlayer.id) {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        targetSocket.emit('game:yourTurn', { availableActions: actions });
      }
    }
  }
}
