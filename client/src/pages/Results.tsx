import { useNavigate, useLocation } from 'react-router-dom';
import type { FinalResult } from '../../../shared/types';

function Results() {
  const navigate = useNavigate();
  const location = useLocation();
  const results: FinalResult[] | undefined = (location.state as any)?.results;

  if (!results || results.length === 0) {
    return (
      <div className="page">
        <div className="loading-container">
          <p>結果データがありません</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  const sorted = [...results].sort((a, b) => a.rank - b.rank);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">最終結果</h1>
      </div>

      <div className="results-table">
        <div className="results-header-row">
          <span className="results-col-rank">#</span>
          <span className="results-col-name">プレイヤー</span>
          <span className="results-col-chips">チップ</span>
          <span className="results-col-rebuy">リバイ</span>
          <span className="results-col-profit">損益</span>
        </div>

        {sorted.map((result) => (
          <div
            key={result.playerId}
            className={`results-row ${
              result.rank === 1 ? 'results-row-first' : ''
            }`}
          >
            <span className="results-col-rank">
              {result.rank === 1 && <span className="trophy">&#127942;</span>}
              {result.rank}
            </span>
            <span className="results-col-name">{result.playerName}</span>
            <span className="results-col-chips">{result.finalChips}</span>
            <span className="results-col-rebuy">
              {result.rebuyCount > 0 ? `x${result.rebuyCount}` : '-'}
            </span>
            <span
              className={`results-col-profit ${
                result.profit > 0
                  ? 'profit-positive'
                  : result.profit < 0
                  ? 'profit-negative'
                  : ''
              }`}
            >
              {result.profit > 0 ? '+' : ''}
              {result.profit}
            </span>
          </div>
        ))}
      </div>

      <div className="results-legend">
        <p>
          投資額 = 初期チップ x (1 + リバイ回数)
          <br />
          損益 = 最終チップ - 投資額
        </p>
      </div>

      <button
        className="btn btn-primary btn-large btn-full"
        onClick={() => navigate('/')}
      >
        ホームに戻る
      </button>
    </div>
  );
}

export default Results;
