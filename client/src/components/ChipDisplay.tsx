import { useState, useEffect, useRef } from 'react';

interface ChipDisplayProps {
  chips: number;
}

function ChipDisplay({ chips }: ChipDisplayProps) {
  const [displayChips, setDisplayChips] = useState(chips);
  const [animClass, setAnimClass] = useState('');
  const prevChips = useRef(chips);

  useEffect(() => {
    if (chips !== prevChips.current) {
      const diff = chips - prevChips.current;
      setAnimClass(diff > 0 ? 'chip-increase' : 'chip-decrease');

      const duration = 600;
      const startVal = prevChips.current;
      const endVal = chips;
      const startTime = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayChips(Math.round(startVal + (endVal - startVal) * eased));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
      prevChips.current = chips;

      const timer = setTimeout(() => setAnimClass(''), 800);
      return () => clearTimeout(timer);
    }
  }, [chips]);

  return (
    <div className={`chip-display ${animClass}`}>
      <div className="chip-display-label">YOUR CHIPS</div>
      <div className="chip-display-value">
        <span className="chip-icon-large">&#9679;</span>
        {displayChips.toLocaleString()}
      </div>
    </div>
  );
}

export default ChipDisplay;
