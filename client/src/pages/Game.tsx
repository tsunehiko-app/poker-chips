import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import HostGame from './HostGame';
import PlayerGame from './PlayerGame';
import TournamentBar from '../components/TournamentBar';
import type { GameState, AvailableActions, HandResult, FinalResult, PlayerAction, GamePhase, PotState, TournamentState, BlindLevel } from '../../../shared/types';

export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'warning' | 'success';
}

let toastId = 0;

function Game() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [availableActions, setAvailableActions] = useState<AvailableActions | null>(null);
  const [handResult, setHandResult] = useState<HandResult | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [phaseTransition, setPhaseTransition] = useState<string | null>(null);

  const playerId = sessionStorage.getItem('playerId');
  const isHost = sessionStorage.getItem('isHost') === 'true';

  const phaseLabels: Record<string, string> = {
    preflop: 'プリフロップ',
    flop: 'フロップ',
    turn: 'ターン',
    river: 'リバー',
    showdown: 'ショーダウン',
  };

  const showPhaseTransition = (phase: string) => {
    const label = phaseLabels[phase] || phase;
    setPhaseTransition(label);
    setTimeout(() => setPhaseTransition(null), 1500);
  };

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    if (!playerId || !roomCode) {
      navigate('/');
      return;
    }

    socket.emit('room:rejoin', { roomCode, playerId });

    const onStateUpdate = (data: { gameState: GameState }) => {
      setGameState((prev) => {
        // ハンド番号が変わったら前のハンド結果をクリア（新しいハンド開始）
        if (prev && data.gameState.handNumber !== prev.handNumber) {
          setHandResult(null);
        }
        return data.gameState;
      });
    };

    const onGameStarted = (data: { gameState: GameState }) => {
      setGameState(data.gameState);
    };

    const onYourTurn = (data: { availableActions: AvailableActions }) => {
      setAvailableActions(data.availableActions);
    };

    const onActionResult = (data: { playerId: string; playerName: string; action: PlayerAction; amount: number }) => {
      if (data.playerId !== playerId) {
        const actionText = getActionText(data.action, data.amount);
        addToast(`${data.playerName}: ${actionText}`);
      }
      if (data.playerId === playerId) {
        setAvailableActions(null);
      }
    };

    const onRoundEnd = (data: { phase: GamePhase; pot: PotState }) => {
      setAvailableActions(null);
      showPhaseTransition(data.phase);
    };

    const onShowdown = (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      setAvailableActions(null);
      showPhaseTransition('showdown');
    };

    const onHandResult = (data: { result: HandResult; gameState: GameState }) => {
      setHandResult(data.result);
      setGameState(data.gameState);
      setAvailableActions(null);
      data.result.winners.forEach((w) => {
        const sign = w.amount >= 0 ? '+' : '';
        addToast(`${w.playerName} ${sign}${w.amount} チップ`, 'success');
      });
    };

    const onPlayerBusted = (data: { playerId: string; playerName: string }) => {
      addToast(`${data.playerName} がバストしました`, 'warning');
    };

    const onPlayerRebuyed = (data: { playerId: string; playerName: string; rebuyCount: number; chips: number }) => {
      addToast(`${data.playerName} がリバイしました (${data.rebuyCount}回目)`, 'info');
    };

    const onPaused = () => {
      setIsPaused(true);
      addToast('ゲームが一時停止されました', 'warning');
    };

    const onResumed = () => {
      setIsPaused(false);
      addToast('ゲームが再開されました', 'info');
    };

    const onTournamentLevelUp = (data: { level: BlindLevel; nextLevel?: BlindLevel; tournament: TournamentState }) => {
      setGameState((prev) => prev ? { ...prev, tournament: data.tournament } : prev);
      showPhaseTransition(`Lv.${data.level.level} — ${data.level.sb.toLocaleString()}/${data.level.bb.toLocaleString()}`);
      addToast(`ブラインドアップ: ${data.level.sb.toLocaleString()}/${data.level.bb.toLocaleString()}`, 'warning');
    };

    const onTournamentPaused = (data: { tournament: TournamentState }) => {
      setGameState((prev) => prev ? { ...prev, tournament: data.tournament } : prev);
    };

    const onTournamentResumed = (data: { tournament: TournamentState }) => {
      setGameState((prev) => prev ? { ...prev, tournament: data.tournament } : prev);
    };

    const onEnded = (data: { results: FinalResult[] }) => {
      navigate(`/results/${roomCode}`, { state: { results: data.results } });
    };

    const onError = (data: { message: string }) => {
      addToast(data.message, 'warning');
    };

    socket.on('game:started', onGameStarted);
    socket.on('game:stateUpdate', onStateUpdate);
    socket.on('game:yourTurn', onYourTurn);
    socket.on('game:actionResult', onActionResult);
    socket.on('game:roundEnd', onRoundEnd);
    socket.on('game:showdown', onShowdown);
    socket.on('game:handResult', onHandResult);
    socket.on('game:playerBusted', onPlayerBusted);
    socket.on('game:playerRebuyed', onPlayerRebuyed);
    socket.on('game:paused', onPaused);
    socket.on('game:resumed', onResumed);
    socket.on('game:ended', onEnded);
    socket.on('error', onError);
    socket.on('tournament:levelUp', onTournamentLevelUp);
    socket.on('tournament:paused', onTournamentPaused);
    socket.on('tournament:resumed', onTournamentResumed);

    return () => {
      socket.off('game:started', onGameStarted);
      socket.off('game:stateUpdate', onStateUpdate);
      socket.off('game:yourTurn', onYourTurn);
      socket.off('game:actionResult', onActionResult);
      socket.off('game:roundEnd', onRoundEnd);
      socket.off('game:showdown', onShowdown);
      socket.off('game:handResult', onHandResult);
      socket.off('game:playerBusted', onPlayerBusted);
      socket.off('game:playerRebuyed', onPlayerRebuyed);
      socket.off('game:paused', onPaused);
      socket.off('game:resumed', onResumed);
      socket.off('game:ended', onEnded);
      socket.off('error', onError);
      socket.off('tournament:levelUp', onTournamentLevelUp);
      socket.off('tournament:paused', onTournamentPaused);
      socket.off('tournament:resumed', onTournamentResumed);
    };
  }, [roomCode, playerId, navigate]);

  if (!gameState) {
    return (
      <div className="page">
        <div className="loading-container">
          <div className="waiting-spinner"></div>
          <p>ゲームに接続中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      {isPaused && (
        <div className="pause-overlay">
          <div className="pause-text">一時停止中</div>
          {isHost && (
            <button
              className="btn btn-primary"
              style={{ marginTop: '24px', fontSize: '18px', padding: '16px 48px' }}
              onClick={() => socket.emit('game:resume', { roomCode: roomCode! })}
            >
              ゲームを再開する
            </button>
          )}
          {!isHost && (
            <div style={{ marginTop: '16px', color: '#9ca3af', fontSize: '14px' }}>
              ホストが再開するのを待っています...
            </div>
          )}
        </div>
      )}

      {phaseTransition && (
        <div className="phase-transition-overlay">
          <div className="phase-transition-text">{phaseTransition}</div>
        </div>
      )}

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {gameState.tournament && (
        <TournamentBar
          tournament={gameState.tournament}
          levelDurationMin={gameState.settings.tournament.levelDurationMin}
        />
      )}

      {isHost ? (
        <HostGame
          gameState={gameState}
          handResult={handResult}
          roomCode={roomCode!}
          playerId={playerId!}
          availableActions={availableActions}
        />
      ) : (
        <PlayerGame
          gameState={gameState}
          availableActions={availableActions}
          handResult={handResult}
          roomCode={roomCode!}
          playerId={playerId!}
        />
      )}
    </div>
  );
}

function getActionText(action: PlayerAction, amount: number): string {
  switch (action) {
    case 'fold':
      return 'フォールド';
    case 'check':
      return 'チェック';
    case 'call':
      return `コール ${amount}`;
    case 'raise':
      return `レイズ ${amount}`;
    case 'allin':
      return `オールイン ${amount}`;
  }
}

export default Game;
