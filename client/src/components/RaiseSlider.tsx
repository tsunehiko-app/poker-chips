import { useState } from 'react';

interface RaiseSliderProps {
  minRaise: number;
  maxRaise: number;
  potTotal: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
  isBet?: boolean;
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
  const [isEditing, setIsEditing] = useState(false);
  const [inputText, setInputText] = useState(String(minRaise));

  const clamp = (val: number) => Math.min(Math.max(val, minRaise), maxRaise);

  // プリセット金額ボタン
  const presets = [
    { label: 'Min', value: minRaise },
    { label: '1/2', value: Math.round(potTotal * 0.5) },
    { label: '3/4', value: Math.round(potTotal * 0.75) },
    { label: 'Pot', value: potTotal },
    { label: 'Max', value: maxRaise },
  ];

  // +/- ボタンで増減する単位
  const getStep = () => {
    if (maxRaise <= 100) return 10;
    if (maxRaise <= 500) return 25;
    if (maxRaise <= 2000) return 50;
    return 100;
  };
  const step = getStep();

  const adjustAmount = (delta: number) => {
    setAmount((prev) => clamp(prev + delta));
  };

  const handleInputTap = () => {
    setIsEditing(true);
    setInputText(String(amount));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleInputBlur = () => {
    const val = Number(inputText);
    if (!isNaN(val) && val > 0) {
      setAmount(clamp(val));
    }
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="raise-panel">
      <div className="raise-header">
        <span className="raise-title">{label}額</span>
        <button className="btn btn-small btn-ghost" onClick={onCancel}>
          キャンセル
        </button>
      </div>

      {/* 金額表示 + ±ボタン */}
      <div className="raise-amount-row">
        <button
          className="raise-step-btn"
          onClick={() => adjustAmount(-step)}
          disabled={amount <= minRaise}
        >
          −{step}
        </button>

        {isEditing ? (
          <input
            type="number"
            className="raise-amount-input editing"
            value={inputText}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            autoFocus
            inputMode="numeric"
          />
        ) : (
          <button className="raise-amount-display" onClick={handleInputTap}>
            {amount.toLocaleString()}
          </button>
        )}

        <button
          className="raise-step-btn"
          onClick={() => adjustAmount(step)}
          disabled={amount >= maxRaise}
        >
          +{step}
        </button>
      </div>

      {/* プリセットボタン */}
      <div className="raise-presets">
        {presets.map((p) => {
          const clamped = clamp(p.value);
          return (
            <button
              key={p.label}
              className={`raise-preset-btn ${amount === clamped ? 'active' : ''}`}
              onClick={() => setAmount(clamped)}
            >
              <span className="preset-label">{p.label}</span>
              <span className="preset-value">{clamped.toLocaleString()}</span>
            </button>
          );
        })}
      </div>

      {/* 確定ボタン */}
      <button
        className="btn btn-primary btn-full raise-confirm-btn"
        onClick={() => onConfirm(amount)}
      >
        {label} {amount.toLocaleString()}
      </button>
    </div>
  );
}

export default RaiseSlider;
