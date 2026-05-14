import { useState } from 'react';
import { socket } from '../socket';
import PotDisplay from '../components/PotDisplay';
import ActionButtons from '../components/ActionButtons';
import RaiseSlider from '../components/RaiseSlider';
import WinnerSelector from '../components/WinnerSelector';
import type { GameState, HandResult, Player, AvailableActions, PlayerAction, ShowdownPot } from '../../../shared/types';

interface HostGameProps {
  gameState: GameState;
  handResult: HandResult | null;
  roomCode: string;
  playerId: string;
  availableActions: AvailableActions | null;
  showdownPots: ShowdownPot[] | null;
}

function HostGame({ gameState, handResult, roomCode, playerId, availableActions, showdownPots }: HostGameProps) {
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;

  const handleAction = (action: PlayerAction, amount?: number) => {
    socket.emit('game:action', { roomCode, action, amount });
    setShowRaiseSlider(false);
  };

  const handleRaiseConfirm = (amount: number) => {
    handleAction('raise', amount);
  };

  // ベット中のチップを含めた合計POT
  const currentBetsTotal = gameState.players.reduce((sum, p) => sum + p.currentBet, 0);
  const displayPotTotal = gameState.pot.total + currentBetsTotal;

  const phaseLabels: Record<string, string> = {
    preflop: 'プリフロップ',
    flop: 'フロップ',
    turn: 'ターン',
    river: 'リバー',
    showdown: 'ショーダウン',
    waiting: '待機中',
  };

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isShowdown = gameState.phase === 'showdown';

  // ポジション名を計算する関数
  const getPositionLabel = (playerIndex: number): string => {
    const activePlayers = gameState.players.filter(
      (p) => p.status !== 'busted'
    );
    const activeCount = activePlayers.length;
    const dealerIdx = gameState.dealerIndex;

    if (activeCount <= 1) return '';

    // アクティブプレイヤーのインデックスリストを作成（ディーラーから時計回り）
    const activeIndices: number[] = [];
    for (let i = 0; i < gameState.players.length; i++) {
      const idx = (dealerIdx + i) % gameState.players.length;
      if (gameState.players[idx].status !== 'busted') {
        activeIndices.push(idx);
      }
    }

    const posInActive = activeIndices.indexOf(playerIndex);
    if (posInActive === -1) return '';

    if (activeCount === 2) {
      // ヘッズアップ: D/SBとBB
      return posInActive === 0 ? 'D/SB' : 'BB';
    }

    if (activeCount === 3) {
      const labels = ['D', 'SB', 'BB'];
      return labels[posInActive] || '';
    }

    if (activeCount === 4) {
      const labels = ['D', 'SB', 'BB', 'UTG'];
      return labels[posInActive] || '';
    }

    if (activeCount === 5) {
      const labels = ['D', 'SB', 'BB', 'UTG', 'CO'];
      return labels[posInActive] || '';
    }

    if (activeCount === 6) {
      const labels = ['D', 'SB', 'BB', 'UTG', 'HJ', 'CO'];
      return labels[posInActive] || '';
    }

    if (activeCount === 7) {
      const labels = ['D', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'];
      return labels[posInActive] || '';
    }

    if (activeCount === 8) {
      const labels = ['D', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO'];
      return labels[posInActive] || '';
    }

    if (activeCount === 9) {
      const labels = ['D', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'MP+1', 'HJ', 'CO'];
      return labels[posInActive] || '';
    }

    // 10人
    const labels = ['D', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'MP+1', 'HJ', 'CO'];
    return labels[posInActive] || '';
  };
  const activePlayers = gameState.players.filter(
    (p) => p.status === 'active' || p.status === 'allin'
  );

  const handleNextHand = () => {
    socket.emit('game:nextHand', { roomCode });
  };

  const handlePause = () => {
    socket.emit('game:pause', { roomCode });
  };

  const handleResume = () => {
    socket.emit('game:resume', { roomCode });
  };

  const handleEndGame = () => {
    socket.emit('game:end', { roomCode });
    setShowEndConfirm(false);
  };

  // トーナメント操作
  const handleTournamentPause = () => {
    socket.emit('tournament:pause', { roomCode });
  };

  const handleTournamentResume = () => {
    socket.emit('tournament:resume', { roomCode });
  };

  const handleTournamentSkip = () => {
    socket.emit('tournament:skipLevel', { roomCode });
  };

  const handleSelectWinners = (winnerIds: string[], potWinners?: { potIndex: number; winnerIds: string[] }[]) => {
    socket.emit('game:selectWinner', { roomCode, winnerIds, potWinners });
  };

  const getStatusClass = (player: Player) => {
    if (player.status === 'busted') return 'player-busted';
    if (player.status === 'folded') return 'player-folded';
    if (player.status === 'allin') return 'player-allin';
    if (player.id === currentPlayer?.id && !isShowdown && !handResult)
      return 'player-current';
    return 'player-active';
  };

  const getStatusBadge = (player: Player) => {
    switch (player.status) {
      case 'busted':
        return <span className="status-badge badge-busted">BUST</span>;
      case 'folded':
        return <span className="status-badge badge-folded">FOLD</span>;
      case 'allin':
        return <span className="status-badge badge-allin">ALL-IN</span>;
      default:
        return null;
    }
  };

  return (
    <div className="host-game">
      <div className="host-header">
        <div className="hand-info">
          <span className="hand-number">Hand #{gameState.handNumber}</span>
          <span className="phase-badge">{phaseLabels[gameState.phase]}</span>
        </div>
        <div className="host-controls-mini">
          {gameState.tournament && (
            <>
              {gameState.tournament.isPaused ? (
                <button className="btn btn-small btn-ghost" onClick={handleTournamentResume}>&#9654;</button>
              ) : (
                <button className="btn btn-small btn-ghost" onClick={handleTournamentPause}>&#9646;&#9646;</button>
              )}
              <button className="btn btn-small btn-ghost" onClick={handleTournamentSkip}>&#9654;&#9654;</button>
            </>
          )}
          {!gameState.tournament && (
            <button className="btn btn-small btn-ghost" onClick={handlePause}>
              &#9646;&#9646;
            </button>
          )}
          <button
            className="btn btn-small btn-ghost btn-danger-text"
            onClick={() => setShowEndConfirm(true)}
          >
            終了
          </button>
        </div>
      </div>

      <PotDisplay pot={gameState.pot} players={gameState.players} />

      {gameState.lastAction && (
        <div className="last-action">
          {gameState.players.find((p) => p.id === gameState.lastAction!.playerId)
            ?.name ?? '???'}
          :{' '}
          {getActionLabel(gameState.lastAction.action, gameState.lastAction.amount)}
        </div>
      )}

      <div className="host-table">
        {gameState.players.map((player, idx) => (
          <div key={player.id} className={`host-player-card ${getStatusClass(player)}`}>
            <div className="host-player-header">
              <span className="host-player-name">
                {player.name}
              </span>
              <span className="position-badge">{getPositionLabel(idx)}</span>
              {getStatusBadge(player)}
            </div>
            <div className="host-player-chips">
              <span className="chip-icon">&#9679;</span> {player.chips}
            </div>
            {player.currentBet > 0 && (
              <div className="host-player-bet">Bet: {player.currentBet}</div>
            )}
          </div>
        ))}
      </div>

      {isShowdown && !handResult && (
        <WinnerSelector
          players={activePlayers}
          showdownPots={showdownPots}
          onSelectWinners={handleSelectWinners}
        />
      )}

      {handResult && (
        <div className="hand-result-card">
          <h3 className="hand-result-title">ハンド結果</h3>
          {handResult.winners.map((w, i) => (
            <div key={i} className="winner-row">
              <span className="winner-name">{w.playerName}</span>
              <span className="winner-amount">{w.amount >= 0 ? '+' : ''}{w.amount}</span>
            </div>
          ))}
          <button className="btn btn-primary btn-full" onClick={handleNextHand}>
            次のハンドへ
          </button>
        </div>
      )}

      {!isShowdown && !handResult && gameState.phase !== 'waiting' && (
        <div className="host-action-area">
          {currentPlayer && (
            <div className="turn-indicator">
              {currentPlayer.name} のターン
            </div>
          )}

          {/* ホスト自身のターンならアクションボタンを表示 */}
          {isMyTurn && availableActions && !showRaiseSlider && (
            <ActionButtons
              availableActions={availableActions}
              onAction={handleAction}
              onRaise={() => setShowRaiseSlider(true)}
            />
          )}

          {isMyTurn && showRaiseSlider && availableActions && (
            <RaiseSlider
              minRaise={availableActions.minRaise}
              maxRaise={availableActions.maxRaise}
              potTotal={displayPotTotal}
              onConfirm={handleRaiseConfirm}
              onCancel={() => setShowRaiseSlider(false)}
              isBet={availableActions.canCheck}
            />
          )}
        </div>
      )}

      {showEndConfirm && (
        <div className="modal-overlay" onClick={() => setShowEndConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">ゲームを終了しますか?</h3>
            <p className="modal-text">全プレイヤーの結果が表示されます。</p>
            <div className="modal-buttons">
              <button
                className="btn btn-ghost"
                onClick={() => setShowEndConfirm(false)}
              >
                キャンセル
              </button>
              <button className="btn btn-danger" onClick={handleEndGame}>
                ゲーム終了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getActionLabel(action: string, amount: number): string {
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
    default:
      return action;
  }
}

export default HostGame;
