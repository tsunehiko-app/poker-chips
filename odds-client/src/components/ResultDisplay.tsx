import './ResultDisplay.css';

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

interface ResultDisplayProps {
  result: ResultData | null;
  loading: boolean;
  error: string | null;
}

export function ResultDisplay({ result, loading, error }: ResultDisplayProps) {
  if (loading) {
    return (
      <div className="result-container">
        <div className="result-loading">
          <div className="spinner"></div>
          <span>計算中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="result-container">
        <div className="result-error">{error}</div>
      </div>
    );
  }

  if (!result) return null;

  // ハンド分布をソート
  const handOrder = [
    'ロイヤルフラッシュ', 'ストレートフラッシュ', 'フォーオブアカインド',
    'フルハウス', 'フラッシュ', 'ストレート', 'スリーオブアカインド',
    'ツーペア', 'ワンペア', 'ハイカード'
  ];

  const sortedHands = handOrder
    .filter(h => result.handDistribution[h])
    .map(h => ({
      name: h,
      count: result.handDistribution[h],
      percent: Math.round((result.handDistribution[h] / result.totalSimulations) * 10000) / 100,
    }));

  return (
    <div className="result-container">
      {/* メイン勝率 */}
      <div className="result-main">
        <div className="rate-circle win">
          <span className="rate-value">{result.winRate}%</span>
          <span className="rate-label">勝率</span>
        </div>
        <div className="rate-circle tie">
          <span className="rate-value">{result.tieRate}%</span>
          <span className="rate-label">引分</span>
        </div>
        <div className="rate-circle lose">
          <span className="rate-value">{result.loseRate}%</span>
          <span className="rate-label">敗率</span>
        </div>
      </div>

      {/* プログレスバー */}
      <div className="result-bar">
        <div className="bar-win" style={{ width: `${result.winRate}%` }}></div>
        <div className="bar-tie" style={{ width: `${result.tieRate}%` }}></div>
        <div className="bar-lose" style={{ width: `${result.loseRate}%` }}></div>
      </div>

      {/* 最頻出ハンド */}
      <div className="best-hand">
        <span className="best-hand-label">最も期待できる役:</span>
        <span className="best-hand-value">{result.myBestHand}</span>
      </div>

      {/* ハンド分布 */}
      <div className="hand-distribution">
        <h4>ハンド分布</h4>
        {sortedHands.map(hand => (
          <div key={hand.name} className="hand-row">
            <span className="hand-name">{hand.name}</span>
            <div className="hand-bar-container">
              <div
                className="hand-bar"
                style={{ width: `${Math.max(hand.percent, 0.5)}%` }}
              ></div>
            </div>
            <span className="hand-percent">{hand.percent}%</span>
          </div>
        ))}
      </div>

      <div className="sim-count">
        シミュレーション回数: {result.totalSimulations.toLocaleString()}回
      </div>
    </div>
  );
}
