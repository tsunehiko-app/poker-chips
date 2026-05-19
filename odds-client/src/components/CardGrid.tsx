import './CardGrid.css';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = [
  { key: 's', symbol: '♠', name: 'スペード', color: '#2c3e50', bgClass: 'suit-spade' },
  { key: 'h', symbol: '♥', name: 'ハート', color: '#e74c3c', bgClass: 'suit-heart' },
  { key: 'd', symbol: '♦', name: 'ダイヤ', color: '#3498db', bgClass: 'suit-diamond' },
  { key: 'c', symbol: '♣', name: 'クラブ', color: '#27ae60', bgClass: 'suit-club' },
];

interface CardGridProps {
  usedCards: string[];
  onSelect: (card: string) => void;
}

export function CardGrid({ usedCards, onSelect }: CardGridProps) {
  return (
    <div className="card-grid-container">
      <div className="card-grid">
        {SUITS.map(suit => (
          <div key={suit.key} className="grid-row">
            {RANKS.map(rank => {
              const card = `${rank}${suit.key}`;
              const isUsed = usedCards.includes(card);

              return (
                <button
                  key={card}
                  className={`grid-card ${suit.bgClass} ${isUsed ? 'used' : ''}`}
                  onClick={() => !isUsed && onSelect(card)}
                  disabled={isUsed}
                  title={`${suit.name}の${rank}`}
                >
                  <span className="gc-rank">{rank}</span>
                  <span className="gc-suit">{suit.symbol}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="grid-hint">カードをクリックして選択 — 選択済みカードをクリックで解除</p>
    </div>
  );
}
