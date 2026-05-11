import { useState } from 'react';

interface RaiseSliderProps {
  minRaise: number;
  maxRaise: number;
  potTotal: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
  isBet?: boolean; // true = 最初のベット, false = レイズ
}

function RaiseSlider({
  minRaise,
  maxRaise,
  potTotal,
  onConfirm,
  onCancel,
  isBet = false,
}: RaiseSliderProps) {
  const label = isBet ? 'ベット' : 'レイズ';
  const [amount, setAmount] = useState(minRaise);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(Number(e.target.value));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!isNaN(val)) {
      setAmount(Math.min(Math.max(val, minRaise), maxRaise));
    }
  };

  const setQuickAmount = (fraction: number) => {
    const potBased = Math.round(potTotal * fraction);
    setAmount(Math.min(Math.max(potBased, minRaise), maxRaise));
  };

  return (
    <div className="raise-slider">
      <div className="raise-header">
        <span className="raise-title">{label}額</span>
        <button className="btn btn-small btn-ghost" onClick={onCancel}>
          キャンセル
        </button>
      </div>

      <div className="raise-input-row">
        <input
          type="number"
          className="raise-input"
          value={amount}
          onChange={handleInputChange}
          min={minRaise}
          max={maxRaise}
        />
      </div>

      <input
        type="range"
        className="raise-range"
        min={minRaise}
        max={maxRaise}
        step={Math.max(1, Math.floor((maxRaise - minRaise) / 100))}
        value={amount}
        onChange={handleSliderChange}
      />

      <div className="raise-range-labels">
        <span>{minRaise}</span>
        <span>{maxRaise}</span>
      </div>

      <div className="raise-quick-buttons">
        <button
          className="btn btn-small btn-ghost"
          onClick={() => setQuickAmount(0.5)}
        >
          1/2 Pot
        </button>
        <button
          className="btn btn-small btn-ghost"
          onClick={() => setQuickAmount(0.75)}
        >
          3/4 Pot
        </button>
        <button
          className="btn btn-small btn-ghost"
          onClick={() => setQuickAmount(1)}
        >
          Pot
        </button>
        <button
          className="btn btn-small btn-ghost"
          onClick={() => setAmount(maxRaise)}
        >
          Max
        </button>
      </div>

      <button
        className="btn btn-primary btn-full"
        onClick={() => onConfirm(amount)}
      >
        {label} {amount.toLocaleString()}
      </button>
    </div>
  );
}

export default RaiseSlider;
