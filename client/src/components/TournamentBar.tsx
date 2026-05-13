import { useState, useEffect } from 'react';
import type { TournamentState, BlindLevel } from '../../../shared/types';
import { BLIND_STRUCTURE } from '../../../shared/types';

interface TournamentBarProps {
  tournament: TournamentState;
  levelDurationMin: number;
}

function TournamentBar({ tournament, levelDurationMin }: TournamentBarProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (tournament.isPaused) {
      setRemaining(tournament.pausedTimeRemaining);
      return;
    }

    const update = () => {
      const durationMs = levelDurationMin * 60 * 1000;
      const elapsed = Date.now() - tournament.levelStartTime;
      setRemaining(Math.max(0, durationMs - elapsed));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [tournament, levelDurationMin]);

  const currentLevel = BLIND_STRUCTURE[tournament.structureIndex];
  const nextIdx = (() => {
    let idx = tournament.structureIndex + 1;
    while (idx < BLIND_STRUCTURE.length && BLIND_STRUCTURE[idx].isBreak) idx++;
    return idx < BLIND_STRUCTURE.length ? idx : -1;
  })();
  const nextLevel = nextIdx >= 0 ? BLIND_STRUCTURE[nextIdx] : null;

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const timerStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const isWarning = remaining < 60000 && !tournament.isPaused;

  if (!currentLevel) return null;

  return (
    <div className="tournament-bar">
      <div>
        <span className="t-level">Lv.{currentLevel.level}</span>
        <span className="t-blinds" style={{ marginLeft: '8px' }}>
          {currentLevel.sb.toLocaleString()}/{currentLevel.bb.toLocaleString()}
        </span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span className={`t-timer ${isWarning ? 'warning' : ''}`}>
          {tournament.isPaused ? '⏸ ' : ''}{timerStr}
        </span>
        {nextLevel && (
          <div className="t-next">
            次: {nextLevel.sb.toLocaleString()}/{nextLevel.bb.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

export default TournamentBar;
