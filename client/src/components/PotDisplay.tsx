import type { PotState, Player } from '../../../shared/types';

interface PotDisplayProps {
  pot: PotState;
  players?: Player[];
}

function PotDisplay({ pot, players }: PotDisplayProps) {
  // 現在のベット中のチップも含めた合計を表示
  const currentBets = players
    ? players.reduce((sum, p) => sum + p.currentBet, 0)
    : 0;
  const displayTotal = pot.total + currentBets;

  return (
    <div className="pot-display">
      <div className="pot-main">
        <span className="pot-label">POT</span>
        <span className="pot-amount">{displayTotal.toLocaleString()}</span>
      </div>
      {pot.sidePots.length > 0 && (
        <div className="pot-sides">
          <span className="pot-main-detail">
            メイン: {pot.main.toLocaleString()}
          </span>
          {pot.sidePots.map((sp, i) => (
            <span key={i} className="pot-side-detail">
              サイド{i + 1}: {sp.amount.toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default PotDisplay;
