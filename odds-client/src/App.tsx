import { useState, useCallback, useRef } from 'react';
import { CardGrid } from './components/CardGrid';
import { PlayerSlot } from './components/PlayerSlot';
import { VoiceButton } from './components/VoiceButton';
import { ResultBar } from './components/ResultBar';
import { OutsDisplay } from './components/OutsDisplay';
import './App.css';

interface Player {
  id: number;
  cards: string[];
}

interface ResultData {
  win: number;
  tie: number;
  lose: number;
  winRate: number;
  tieRate: number;
  loseRate: number;
  totalSimulations: number;
  myBestHand: string;
  handDistribution: Record<string, number>;
}

// 各プレイヤーの勝率結果
interface PlayerResult {
  playerId: number;
  winRate: number;
  tieRate: number;
}

type SelectionTarget = { type: 'player'; index: number; cardSlot: 0 | 1 } | { type: 'board'; cardSlot: number };

function App() {
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, cards: ['', ''] },
    { id: 2, cards: ['', ''] },
  ]);
  const [board, setBoard] = useState<string[]>(['', '', '', '', '']);
  const [selectionTarget, setSelectionTarget] = useState<SelectionTarget>({ type: 'player', index: 0, cardSlot: 0 });
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [outsData, setOutsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simCount] = useState(20000);
  const cardGridRef = useRef<HTMLDivElement>(null);

  // 全ての使用済みカード
  const allUsedCards = [
    ...players.flatMap(p => p.cards.filter(c => c !== '')),
    ...board.filter(c => c !== ''),
  ];

  // プレイヤー追加 (最大6人)
  const addPlayer = () => {
    if (players.length >= 6) return;
    setPlayers([...players, { id: Date.now(), cards: ['', ''] }]);
  };

  // プレイヤー削除
  const removePlayer = (index: number) => {
    if (players.length <= 2) return;
    setPlayers(players.filter((_, i) => i !== index));
    setResults([]);
  };

  // カード選択処理
  const handleCardSelect = useCallback((card: string) => {
    if (allUsedCards.includes(card)) return;

    if (selectionTarget.type === 'player') {
      const { index, cardSlot } = selectionTarget;
      const newPlayers = [...players];
      const newCards = [...newPlayers[index].cards];
      newCards[cardSlot] = card;
      newPlayers[index] = { ...newPlayers[index], cards: newCards };
      setPlayers(newPlayers);

      // 次のスロットへ自動移動
      if (cardSlot === 0) {
        setSelectionTarget({ type: 'player', index, cardSlot: 1 });
      } else {
        // 次のプレイヤーへ
        const nextIdx = index + 1;
        if (nextIdx < players.length) {
          const nextSlot = newPlayers[nextIdx]?.cards[0] === '' ? 0 : 1;
          setSelectionTarget({ type: 'player', index: nextIdx, cardSlot: nextSlot as 0 | 1 });
        } else {
          // ボードへ
          const nextBoardSlot = board.findIndex(c => c === '');
          if (nextBoardSlot >= 0) {
            setSelectionTarget({ type: 'board', cardSlot: nextBoardSlot });
          }
        }
      }
    } else {
      const { cardSlot } = selectionTarget;
      const newBoard = [...board];
      newBoard[cardSlot] = card;
      setBoard(newBoard);

      // 次の空きボードスロットへ
      const nextSlot = newBoard.findIndex((c, i) => c === '' && i > cardSlot);
      if (nextSlot >= 0) {
        setSelectionTarget({ type: 'board', cardSlot: nextSlot });
      }
    }

    setResults([]);
  }, [selectionTarget, players, board, allUsedCards]);

  // カード削除
  const handleRemoveCard = (target: SelectionTarget) => {
    if (target.type === 'player') {
      const newPlayers = [...players];
      const newCards = [...newPlayers[target.index].cards];
      newCards[target.cardSlot] = '';
      newPlayers[target.index] = { ...newPlayers[target.index], cards: newCards };
      setPlayers(newPlayers);
    } else {
      const newBoard = [...board];
      newBoard[target.cardSlot] = '';
      setBoard(newBoard);
    }
    setSelectionTarget(target);
    setResults([]);
  };

  // スロットクリック
  const handleSlotClick = (target: SelectionTarget) => {
    setSelectionTarget(target);
    // カードグリッドまでスクロール
    cardGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // 音声入力でカード追加
  const handleVoiceCard = useCallback((cardStr: string) => {
    handleCardSelect(cardStr);
  }, [handleCardSelect]);

  // 計算実行
  const calculate = async () => {
    // Player1の手札が必要
    if (players[0].cards.some(c => c === '')) {
      setError('プレイヤー1の手札を2枚選択してください');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      // 各プレイヤーの勝率を計算（プレイヤー1視点）
      const myHand = players[0].cards;
      const boardCards = board.filter(c => c !== '');
      const opponents = players.slice(1).map(p => ({
        hand: p.cards.every(c => c !== '') ? p.cards : undefined,
      }));

      const response = await fetch('/api/odds/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myHand,
          board: boardCards,
          opponents,
          simulations: simCount,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '計算に失敗しました');
      }

      const data = await response.json();

      // アウツデータを保存
      if (data.outs) {
        setOutsData(data.outs);
      }

      // 結果をプレイヤーごとに表示
      const playerResults: PlayerResult[] = [
        { playerId: players[0].id, winRate: data.winRate, tieRate: data.tieRate },
      ];

      // 相手の勝率は残り%から推定（簡易版）
      const oppWinRate = Math.round((data.loseRate / (players.length - 1)) * 100) / 100;
      for (let i = 1; i < players.length; i++) {
        playerResults.push({
          playerId: players[i].id,
          winRate: oppWinRate,
          tieRate: data.tieRate,
        });
      }

      setResults(playerResults);
    } catch (e: any) {
      setError(e.message || '通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // リセット
  const reset = () => {
    setPlayers([
      { id: Date.now(), cards: ['', ''] },
      { id: Date.now() + 1, cards: ['', ''] },
    ]);
    setBoard(['', '', '', '', '']);
    setResults([]);
    setOutsData(null);
    setError(null);
    setSelectionTarget({ type: 'player', index: 0, cardSlot: 0 });
  };

  const hasAnyCards = allUsedCards.length > 0;

  return (
    <div className="app">
      {/* ヘッダー */}
      <header className="header">
        <div className="header-inner">
          <h1 className="logo">
            <span className="logo-icon">♠</span>
            ポーカー確率計算オッズ
          </h1>
        </div>
      </header>

      {/* メインセクション */}
      <main className="main">
        <div className="container">
          <h2 className="section-title">ポーカーオッズ計算機</h2>

          {/* テーブルエリア */}
          <div className="table-area">
            {/* プレイヤースロット */}
            <div className="players-row">
              {players.map((player, i) => {
                const playerResult = results.find(r => r.playerId === player.id);
                return (
                  <PlayerSlot
                    key={player.id}
                    playerNumber={i + 1}
                    cards={player.cards}
                    isActive={selectionTarget.type === 'player' && selectionTarget.index === i}
                    activeSlot={
                      selectionTarget.type === 'player' && selectionTarget.index === i
                        ? selectionTarget.cardSlot
                        : undefined
                    }
                    winRate={playerResult?.winRate}
                    tieRate={playerResult?.tieRate}
                    onSlotClick={(slot) => handleSlotClick({ type: 'player', index: i, cardSlot: slot })}
                    onRemoveCard={(slot) => handleRemoveCard({ type: 'player', index: i, cardSlot: slot })}
                    onRemovePlayer={players.length > 2 ? () => removePlayer(i) : undefined}
                  />
                );
              })}

              {/* プレイヤー追加ボタン */}
              {players.length < 6 && (
                <button className="add-player-btn" onClick={addPlayer}>
                  <span className="add-icon">+</span>
                </button>
              )}
            </div>

            {/* ボード（共通カード） */}
            <div className="board-area">
              <div className="board-label">ボード</div>
              <div className="board-cards">
                {board.map((card, i) => (
                  <div
                    key={i}
                    className={`board-slot ${
                      selectionTarget.type === 'board' && selectionTarget.cardSlot === i ? 'active' : ''
                    } ${card ? 'has-card' : ''}`}
                    onClick={() => card
                      ? handleRemoveCard({ type: 'board', cardSlot: i })
                      : handleSlotClick({ type: 'board', cardSlot: i })
                    }
                  >
                    {card ? (
                      <CardDisplay card={card} />
                    ) : (
                      <span className="empty-slot-text">?</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 勝率バー（結果がある場合） */}
            {results.length > 0 && (
              <ResultBar players={players} results={results} />
            )}
          </div>

          {/* 音声入力 */}
          <div className="voice-section">
            <VoiceButton onCardRecognized={handleVoiceCard} />
          </div>

          {/* カードグリッド */}
          <div ref={cardGridRef}>
            <CardGrid
              usedCards={allUsedCards}
              onSelect={handleCardSelect}
            />
          </div>

          {/* アクションボタン */}
          <div className="action-buttons">
            <button
              className="calc-btn"
              onClick={calculate}
              disabled={players[0].cards.some(c => c === '') || loading}
            >
              {loading ? (
                <><span className="btn-spinner"></span>計算中...</>
              ) : (
                '勝率を計算する'
              )}
            </button>
            {hasAnyCards && (
              <button className="reset-btn" onClick={reset}>
                リセット
              </button>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          {/* アウツ分析 */}
          {outsData && (
            <OutsDisplay
              outs={outsData}
              actualWinRate={results.length > 0 ? results[0].winRate : undefined}
            />
          )}
        </div>
      </main>

      {/* フッター */}
      <footer className="footer">
        <div className="container">
          <p>ポーカー勝率計算機 — テキサスホールデム</p>
        </div>
      </footer>
    </div>
  );
}

// カード表示用の小コンポーネント
export function CardDisplay({ card, size = 'normal' }: { card: string; size?: 'normal' | 'small' }) {
  if (!card) return null;
  const rank = card[0];
  const suit = card[1];
  const suitMap: Record<string, { symbol: string; color: string }> = {
    h: { symbol: '♥', color: 'var(--heart-red)' },
    d: { symbol: '♦', color: 'var(--diamond-blue)' },
    c: { symbol: '♣', color: 'var(--club-green)' },
    s: { symbol: '♠', color: 'var(--spade-dark)' },
  };
  const s = suitMap[suit] || { symbol: '?', color: '#000' };

  return (
    <div className={`card-display ${size}`} style={{ color: s.color }}>
      <span className="card-display-rank">{rank}</span>
      <span className="card-display-suit">{s.symbol}</span>
    </div>
  );
}

export default App;
