import { useState } from 'react';
import { socket } from '../socket';
import ChipDisplay from '../components/ChipDisplay';
import PotDisplay from '../components/PotDisplay';
import ActionButtons from '../components/ActionButtons';
import RaiseSlider from '../components/RaiseSlider';
import BustedOverlay from '../components/BustedOverlay';
import type { GameState, AvailableActions, HandResult, PlayerAction } from '../../../shared/types';

interface PlayerGameProps {
  gameState: GameState;
  availableActions: AvailableActions | null;
  handResult: HandResult | null;
  roomCode: string;
  playerId: string;
}

function PlayerGame({
  gameState,
  availableActions,
  handResult,
  roomCode,
  playerId,
}: PlayerGameProps) {
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  const me = gameState.players.find((p) => p.id === playerId);
  if (!me) return null;

  const isBusted = me.status === 'busted';
  const isMyTurn = availableActions !== null && me.status === 'active';

  const phaseLabels: Record<string, string> = {
    preflop: 'プリフロップ',
    flop: 'フロップ',
    turn: 'ターン',
    river: 'リバー',
    showdown: 'ショーダウン',
    waiting: '待機中',
  };

  const handleAction = (action: PlayerAction, amount?: number) => {
    socket.emit('game:action', { roomCode, action, amount });
    setShowRaiseSlider(false);
  };

  const handleRebuy = () => {
    socket.emit('game:rebuy', { roomCode });
  };

  const currentPlayerName =
    gameState.players[gameState.currentPlayerIndex]?.name ?? '';

  return (
    <div className="player-game">
      {isBusted && (
        <BustedOverlay rebuyCount={me.rebuyCount} onRebuy={handleRebuy} />
      )}

      <div className="player-game-header">
        <div className="phase-indicator">
          <span className="hand-number">Hand #{gameState.handNumber}</span>
          <span className="phase-badge">{phaseLabels[gameState.phase]}</span>
        </div>
      </div>

      <ChipDisplay chips={me.chips} />

      <PotDisplay pot={gameState.pot} players={gameState.players} />

      {gameState.lastAction && (
        <div className="last-action">
          {gameState.players.find((p) => p.id === gameState.lastAction!.playerId)
            ?.name ?? '???'}
          :{' '}
          {getActionLabel(
            gameState.lastAction.action,
            gameState.lastAction.amount
          )}
        </div>
      )}

      {me.currentBet > 0 && (
        <div className="my-current-bet">
          あなたのベット: <strong>{me.currentBet}</strong>
        </div>
      )}

      <div className="players-strip">
        {gameState.players
          .filter((p) => p.id !== playerId)
          .map((p) => (
            <div
              key={p.id}
              className={`strip-player ${
                p.status === 'folded'
                  ? 'strip-folded'
                  : p.status === 'busted'
                  ? 'strip-busted'
                  : p.status === 'allin'
                  ? 'strip-allin'
                  : p.id === gameState.players[gameState.currentPlayerIndex]?.id
                  ? 'strip-current'
                  : ''
              }`}
            >
              <span className="strip-name">{p.name}</span>
              <span className="strip-chips">{p.chips}</span>
              {p.currentBet > 0 && (
                <span className="strip-bet">Bet {p.currentBet}</span>
              )}
            </div>
          ))}
      </div>

      {handResult && (
        <div className="hand-result-banner">
          {handResult.winners.map((w, i) => (
            <div key={i} className="winner-banner-row">
              {w.playerName} <strong>{w.amount >= 0 ? '+' : ''}{w.amount}</strong> チップ
            </div>
          ))}
        </div>
      )}

      <div className="player-action-area">
        {isMyTurn && !showRaiseSlider && (
          <ActionButtons
            availableActions={availableActions!}
            onAction={handleAction}
            onRaise={() => setShowRaiseSlider(true)}
          />
        )}

        {isMyTurn && showRaiseSlider && availableActions && (
          <RaiseSlider
            minRaise={availableActions.minRaise}
            maxRaise={availableActions.maxRaise}
            potTotal={gameState.pot.total}
            onConfirm={(amount) => handleAction('raise', amount)}
            onCancel={() => setShowRaiseSlider(false)}
            isBet={availableActions.canCheck}
          />
        )}

        {!isMyTurn && !isBusted && !handResult && gameState.phase !== 'showdown' && gameState.phase !== 'waiting' && (
          <div className="waiting-turn">
            <div className="waiting-spinner"></div>
            <p>{currentPlayerName} のアクションを待っています...</p>
          </div>
        )}

        {gameState.phase === 'showdown' && !handResult && (
          <div className="waiting-turn">
            <p>ホストが勝者を選択中...</p>
          </div>
        )}
      </div>
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

export default PlayerGame;
