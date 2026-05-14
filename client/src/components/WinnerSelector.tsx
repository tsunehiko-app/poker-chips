import { useState } from 'react';
import type { Player, ShowdownPot } from '../../../shared/types';

interface WinnerSelectorProps {
  players: Player[];
  showdownPots: ShowdownPot[] | null;
  onSelectWinners: (winnerIds: string[], potWinners?: { potIndex: number; winnerIds: string[] }[]) => void;
}

function WinnerSelector({ players, showdownPots, onSelectWinners }: WinnerSelectorProps) {
  const hasSidePots = showdownPots && showdownPots.length > 1;

  // サイドポットなし: 従来の単純選択
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // サイドポットあり: ポットごとの勝者選択
  const [potSelections, setPotSelections] = useState<Map<number, Set<string>>>(new Map());
  const [currentPotStep, setCurrentPotStep] = useState(0);

  // --- サイドポットなしのUI ---
  if (!hasSidePots) {
    const togglePlayer = (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
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
        <p className="winner-selector-hint">複数選択でスプリットポット</p>

        <div className="winner-list">
          {players.map((player) => (
            <button
              key={player.id}
              className={`winner-item ${selectedIds.has(player.id) ? 'winner-selected' : ''}`}
              onClick={() => togglePlayer(player.id)}
            >
              <span className="winner-item-name">{player.name}</span>
              <span className="winner-item-chips">{player.chips}</span>
              {selectedIds.has(player.id) && <span className="winner-checkmark">&#10003;</span>}
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

  // --- サイドポットありのUI: ポットごとに勝者を選択 ---
  const pots = showdownPots!;
  const currentPot = pots[currentPotStep];

  if (!currentPot) return null;

  const eligiblePlayers = players.filter((p) =>
    currentPot.eligiblePlayerIds.includes(p.id)
  );

  const currentSelections = potSelections.get(currentPotStep) || new Set<string>();

  const togglePotPlayer = (id: string) => {
    setPotSelections((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(currentPotStep) || []);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      next.set(currentPotStep, current);
      return next;
    });
  };

  const handleNextPot = () => {
    if (currentSelections.size === 0) return;

    if (currentPotStep < pots.length - 1) {
      // 次のポットへ。前のポットの勝者をデフォルト選択にプリセット
      const nextPot = pots[currentPotStep + 1];
      const nextSelections = potSelections.get(currentPotStep + 1);
      if (!nextSelections || nextSelections.size === 0) {
        // 前のポットの勝者のうち、次のポット対象者をデフォルト選択
        const preselect = new Set<string>();
        currentSelections.forEach((id) => {
          if (nextPot.eligiblePlayerIds.includes(id)) preselect.add(id);
        });
        if (preselect.size > 0) {
          setPotSelections((prev) => {
            const next = new Map(prev);
            next.set(currentPotStep + 1, preselect);
            return next;
          });
        }
      }
      setCurrentPotStep(currentPotStep + 1);
    } else {
      // 全ポット完了 → 確定
      handleConfirmAll();
    }
  };

  const handlePrevPot = () => {
    if (currentPotStep > 0) {
      setCurrentPotStep(currentPotStep - 1);
    }
  };

  const handleConfirmAll = () => {
    const allWinnerIds = new Set<string>();
    const potWinnersArray: { potIndex: number; winnerIds: string[] }[] = [];

    pots.forEach((pot, idx) => {
      const selections = potSelections.get(idx);
      if (selections && selections.size > 0) {
        const ids = Array.from(selections);
        ids.forEach((id) => allWinnerIds.add(id));
        potWinnersArray.push({ potIndex: idx, winnerIds: ids });
      }
    });

    onSelectWinners(Array.from(allWinnerIds), potWinnersArray);
  };

  const isLastPot = currentPotStep === pots.length - 1;

  return (
    <div className="winner-selector">
      <h3 className="winner-selector-title">勝者を選択</h3>

      {/* ポットステップ表示 */}
      <div className="pot-steps">
        {pots.map((pot, idx) => (
          <div
            key={idx}
            className={`pot-step ${idx === currentPotStep ? 'active' : ''} ${
              potSelections.has(idx) && (potSelections.get(idx)?.size || 0) > 0 ? 'done' : ''
            }`}
          >
            <span className="pot-step-num">{idx + 1}</span>
          </div>
        ))}
      </div>

      {/* 現在のポット情報 */}
      <div className="pot-info-card">
        <span className="pot-info-label">{currentPot.label}</span>
        <span className="pot-info-amount">{currentPot.amount.toLocaleString()}</span>
      </div>

      <p className="winner-selector-hint">
        このポットの勝者を選択（複数可）
      </p>

      {/* 対象プレイヤー一覧 */}
      <div className="winner-list">
        {eligiblePlayers.map((player) => (
          <button
            key={player.id}
            className={`winner-item ${currentSelections.has(player.id) ? 'winner-selected' : ''}`}
            onClick={() => togglePotPlayer(player.id)}
          >
            <span className="winner-item-name">{player.name}</span>
            <span className="winner-item-chips">{player.chips}</span>
            {currentSelections.has(player.id) && <span className="winner-checkmark">&#10003;</span>}
          </button>
        ))}
      </div>

      {/* ナビゲーション */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        {currentPotStep > 0 && (
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handlePrevPot}>
            &#8592; 前のポット
          </button>
        )}
        <button
          className={`btn ${isLastPot ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 2 }}
          onClick={handleNextPot}
          disabled={currentSelections.size === 0}
        >
          {isLastPot ? '確定する' : `次のポットへ &#8594;`}
        </button>
      </div>

      {/* 選択済みサマリー */}
      {potSelections.size > 0 && (
        <div className="pot-summary">
          {pots.map((pot, idx) => {
            const sel = potSelections.get(idx);
            if (!sel || sel.size === 0) return null;
            const names = Array.from(sel).map((id) => players.find((p) => p.id === id)?.name || '?');
            return (
              <div key={idx} className="pot-summary-row">
                <span className="pot-summary-label">{pot.label}</span>
                <span className="pot-summary-winners">{names.join(', ')}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WinnerSelector;
