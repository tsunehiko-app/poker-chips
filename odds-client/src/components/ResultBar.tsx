import './ResultBar.css';

interface Player {
  id: number;
  cards: string[];
}

interface PlayerResult {
  playerId: number;
  winRate: number;
  tieRate: number;
}

interface ResultBarProps {
  players: Player[];
  results: PlayerResult[];
}

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#27ae60', '#f39c12', '#9b59b6', '#1abc9c'];

export function ResultBar({ players, results }: ResultBarProps) {
  return (
    <div className="result-bar-container">
      <div className="result-bar-track">
        {results.map((r, i) => (
          <div
            key={r.playerId}
            className="result-bar-segment"
            style={{
              width: `${r.winRate}%`,
              backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length],
            }}
          >
            {r.winRate > 8 && <span className="segment-label">{r.winRate}%</span>}
          </div>
        ))}
      </div>

      <div className="result-legend">
        {results.map((r, i) => (
          <div key={r.playerId} className="legend-item">
            <span
              className="legend-dot"
              style={{ backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
            />
            <span className="legend-name">P{i + 1}</span>
            <span className="legend-rate">{r.winRate}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
