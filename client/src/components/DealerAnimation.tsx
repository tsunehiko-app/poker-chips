import { useState, useEffect, useRef } from 'react';

interface DealerAnimationProps {
  players: { id: string; name: string }[];
  dealerIndex: number;
  onComplete: () => void;
}

function DealerAnimation({ players, dealerIndex, onComplete }: DealerAnimationProps) {
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [phase, setPhase] = useState<'spinning' | 'landed' | 'done'>('spinning');
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef(0);

  useEffect(() => {
    // ルーレット風: 速く回って → 徐々にゆっくり → ディーラーで止まる
    const totalSteps = players.length * 3 + dealerIndex + Math.floor(Math.random() * players.length);
    // 各ステップの間隔を計算（最初は速く、最後はゆっくり）
    const baseSpeed = 60; // 最速 ms
    const maxSpeed = 500; // 最遅 ms

    const runStep = () => {
      stepRef.current++;
      const step = stepRef.current;
      const idx = step % players.length;
      setHighlightIndex(idx);

      if (step >= totalSteps) {
        // 止まった
        setHighlightIndex(dealerIndex);
        setPhase('landed');
        setTimeout(() => {
          setPhase('done');
          setTimeout(onComplete, 1200);
        }, 1800);
        return;
      }

      // イージング: 後半になるほど遅くなる
      const progress = step / totalSteps;
      const eased = progress * progress * progress; // cubic ease-in
      const delay = baseSpeed + (maxSpeed - baseSpeed) * eased;

      intervalRef.current = setTimeout(runStep, delay);
    };

    // 少し待ってから開始
    intervalRef.current = setTimeout(runStep, 600);

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [players, dealerIndex, onComplete]);

  return (
    <div className="dealer-anim-overlay">
      <div className="dealer-anim-container">
        <h2 className="dealer-anim-title">
          {phase === 'spinning' && 'ディーラーを決めています...'}
          {phase === 'landed' && `${players[dealerIndex].name} がディーラー!`}
          {phase === 'done' && `${players[dealerIndex].name} がディーラー!`}
        </h2>

        <div className="dealer-anim-ring">
          {players.map((player, idx) => (
            <div
              key={player.id}
              className={`dealer-anim-player ${
                idx === highlightIndex ? 'highlighted' : ''
              } ${
                phase === 'landed' && idx === dealerIndex ? 'winner' : ''
              } ${
                phase === 'done' && idx === dealerIndex ? 'winner' : ''
              }`}
            >
              <span className="dealer-anim-name">{player.name}</span>
              {(phase === 'landed' || phase === 'done') && idx === dealerIndex && (
                <span className="dealer-anim-badge">D</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DealerAnimation;
