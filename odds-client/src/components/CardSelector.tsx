import { useState } from 'react';
import './CardSelector.css';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = [
  { key: 'h', symbol: '♥', name: 'ハート', color: '#e94560' },
  { key: 'd', symbol: '♦', name: 'ダイヤ', color: '#2196f3' },
  { key: 'c', symbol: '♣', name: 'クラブ', color: '#4caf50' },
  { key: 's', symbol: '♠', name: 'スペード', color: '#9c27b0' },
];

interface CardSelectorProps {
  selectedCards: string[];
  usedCards: string[];  // 他の場所で使われているカード
  maxCards: number;
  onSelect: (cards: string[]) => void;
  label: string;
}

export function CardSelector({ selectedCards, usedCards, maxCards, onSelect, label }: CardSelectorProps) {
  const [filterSuit, setFilterSuit] = useState<string | null>(null);

  const handleCardClick = (card: string) => {
    if (usedCards.includes(card) && !selectedCards.includes(card)) return;

    if (selectedCards.includes(card)) {
      onSelect(selectedCards.filter(c => c !== card));
    } else if (selectedCards.length < maxCards) {
      onSelect([...selectedCards, card]);
    }
  };

  const isDisabled = (card: string) => {
    return usedCards.includes(card) && !selectedCards.includes(card);
  };

  const filteredRanks = RANKS;
  const filteredSuits = filterSuit ? SUITS.filter(s => s.key === filterSuit) : SUITS;

  return (
    <div className="card-selector">
      <div className="card-selector-header">
        <span className="card-selector-label">{label}</span>
        <span className="card-selector-count">
          {selectedCards.length}/{maxCards}
        </span>
      </div>

      {/* 選択中のカード表示 */}
      <div className="selected-cards-row">
        {selectedCards.length === 0 ? (
          <span className="placeholder-text">タップまたは音声で選択</span>
        ) : (
          selectedCards.map(card => {
            const suit = SUITS.find(s => s.key === card[1]);
            return (
              <div
                key={card}
                className="selected-card-chip"
                style={{ borderColor: suit?.color }}
                onClick={() => handleCardClick(card)}
              >
                <span style={{ color: suit?.color }}>{suit?.symbol}</span>
                <span>{card[0]}</span>
                <span className="remove-x">×</span>
              </div>
            );
          })
        )}
      </div>

      {/* スートフィルター */}
      <div className="suit-filter">
        <button
          className={`suit-filter-btn ${filterSuit === null ? 'active' : ''}`}
          onClick={() => setFilterSuit(null)}
        >
          全て
        </button>
        {SUITS.map(suit => (
          <button
            key={suit.key}
            className={`suit-filter-btn ${filterSuit === suit.key ? 'active' : ''}`}
            style={{ color: suit.color }}
            onClick={() => setFilterSuit(filterSuit === suit.key ? null : suit.key)}
          >
            {suit.symbol}
          </button>
        ))}
      </div>

      {/* カードグリッド */}
      <div className="card-grid">
        {filteredSuits.map(suit => (
          <div key={suit.key} className="suit-row">
            {filteredRanks.map(rank => {
              const card = `${rank}${suit.key}`;
              const isSelected = selectedCards.includes(card);
              const disabled = isDisabled(card);

              return (
                <button
                  key={card}
                  className={`card-btn ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                  style={{
                    '--suit-color': suit.color,
                  } as React.CSSProperties}
                  onClick={() => handleCardClick(card)}
                  disabled={disabled}
                >
                  <span className="card-rank">{rank}</span>
                  <span className="card-suit">{suit.symbol}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
