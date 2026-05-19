import { CardDisplay } from '../App';
import './PlayerSlot.css';

interface PlayerSlotProps {
  playerNumber: number;
  cards: string[];
  isActive: boolean;
  activeSlot?: 0 | 1;
  winRate?: number;
  tieRate?: number;
  onSlotClick: (slot: 0 | 1) => void;
  onRemoveCard: (slot: 0 | 1) => void;
  onRemovePlayer?: () => void;
}

export function PlayerSlot({
  playerNumber,
  cards,
  isActive,
  activeSlot,
  winRate,
  tieRate,
  onSlotClick,
  onRemoveCard,
  onRemovePlayer,
}: PlayerSlotProps) {
  return (
    <div className={`player-slot ${isActive ? 'active' : ''}`}>
      <div className="player-header">
        <span className="player-label">プレイヤー{playerNumber}</span>
        {onRemovePlayer && (
          <button className="player-remove" onClick={onRemovePlayer} title="削除">
            ×
          </button>
        )}
      </div>

      <div className="player-cards">
        {[0, 1].map((slotIdx) => {
          const card = cards[slotIdx];
          const isActiveSlot = isActive && activeSlot === slotIdx;

          return (
            <div
              key={slotIdx}
              className={`player-card-slot ${isActiveSlot ? 'active-slot' : ''} ${card ? 'has-card' : ''}`}
              onClick={() => card ? onRemoveCard(slotIdx as 0 | 1) : onSlotClick(slotIdx as 0 | 1)}
            >
              {card ? (
                <CardDisplay card={card} />
              ) : (
                <span className="empty-card">?</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 勝率表示 */}
      {winRate !== undefined && (
        <div className="player-results">
          <div className="result-win">勝ち {winRate}%</div>
          {tieRate !== undefined && tieRate > 0 && (
            <div className="result-tie">引分 {tieRate}%</div>
          )}
        </div>
      )}
    </div>
  );
}
