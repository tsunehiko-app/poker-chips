import { useState } from 'react';
import type { Player } from '../../../shared/types';

interface WinnerSelectorProps {
  players: Player[];
  onSelectWinners: (winnerIds: string[]) => void;
}

function WinnerSelector({ players, onSelectWinners }: WinnerSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedIds.size > 0) {
      onSelectWinners(Array.from(selectedIds));
    }
  };

  return (
    <div className="winner-selector">
      <h3 className="winner-selector-title">勝者を選択</h3>
      <p className="winner-selector-hint">
        複数選択でスプリットポット
      </p>

      <div className="winner-list">
        {players.map((player) => (
          <button
            key={player.id}
            className={`winner-item ${
              selectedIds.has(player.id) ? 'winner-selected' : ''
            }`}
            onClick={() => togglePlayer(player.id)}
          >
            <span className="winner-item-name">{player.name}</span>
            <span className="winner-item-chips">{player.chips}</span>
            {selectedIds.has(player.id) && (
              <span className="winner-checkmark">&#10003;</span>
            )}
          </button>
        ))}
      </div>

      <button
        className="btn btn-primary btn-full"
        onClick={handleConfirm}
        disabled={selectedIds.size === 0}
      >
        {selectedIds.size > 1
          ? `${selectedIds.size}人でスプリット`
          : selectedIds.size === 1
          ? '勝者を確定'
          : '勝者を選んでください'}
      </button>
    </div>
  );
}

export default WinnerSelector;
