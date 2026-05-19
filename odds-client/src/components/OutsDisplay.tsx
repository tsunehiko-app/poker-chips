import { CardDisplay } from '../App';
import './OutsDisplay.css';

interface DrawInfo {
  name: string;
  description: string;
  outs: number;
  outCards: string[];
  ruleOf4: number;
  ruleOf2: number;
}

interface OutsData {
  draws: DrawInfo[];
  totalOuts: number;
  totalOutCards: string[];
  ruleOf4Equity: number;
  ruleOf2Equity: number;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  currentHandRank: string;
}

interface OutsDisplayProps {
  outs: OutsData | null;
  actualWinRate?: number; // モンテカルロの実測勝率
}

// アウツ数に応じた強さラベル
function getDrawStrength(totalOuts: number): { label: string; color: string } {
  if (totalOuts >= 15) return { label: 'モンスタードロー', color: '#e74c3c' };
  if (totalOuts >= 12) return { label: '非常に強いドロー', color: '#e67e22' };
  if (totalOuts >= 9) return { label: '強いドロー', color: '#f39c12' };
  if (totalOuts >= 6) return { label: '中程度のドロー', color: '#3498db' };
  if (totalOuts >= 3) return { label: '弱いドロー', color: '#95a5a6' };
  return { label: 'ドローなし', color: '#7f8c8d' };
}

// ドローの色
function getDrawColor(name: string): string {
  if (name.includes('フラッシュ')) return '#e74c3c';
  if (name.includes('ストレート')) return '#3498db';
  if (name.includes('オーバーカード')) return '#f39c12';
  if (name.includes('セット')) return '#9b59b6';
  if (name.includes('ツーペア')) return '#27ae60';
  return '#95a5a6';
}

export function OutsDisplay({ outs, actualWinRate }: OutsDisplayProps) {
  if (!outs || outs.draws.length === 0) return null;

  const strength = getDrawStrength(outs.totalOuts);
  const isFlop = outs.street === 'flop';
  const isTurn = outs.street === 'turn';
  const activeRule = isFlop ? outs.ruleOf4Equity : outs.ruleOf2Equity;
  const ruleLabel = isFlop ? 'ルール・オブ・4' : 'ルール・オブ・2';
  const ruleFormula = isFlop
    ? `${outs.totalOuts} × 4 = ${outs.ruleOf4Equity}%`
    : `${outs.totalOuts} × 2 = ${outs.ruleOf2Equity}%`;

  return (
    <div className="outs-display">
      {/* ヘッダー */}
      <div className="outs-header">
        <div className="outs-header-left">
          <h3 className="outs-title">アウツ分析</h3>
          <span className="current-hand">現在: {outs.currentHandRank || '—'}</span>
        </div>
        <div className="outs-total" style={{ borderColor: strength.color }}>
          <span className="outs-number" style={{ color: strength.color }}>{outs.totalOuts}</span>
          <span className="outs-label">アウツ</span>
        </div>
      </div>

      {/* 強さインジケーター */}
      <div className="strength-bar">
        <div
          className="strength-fill"
          style={{
            width: `${Math.min((outs.totalOuts / 20) * 100, 100)}%`,
            background: strength.color,
          }}
        />
        <span className="strength-label" style={{ color: strength.color }}>
          {strength.label}
        </span>
      </div>

      {/* ルール・オブ・4&2 */}
      {(isFlop || isTurn) && (
        <div className="rule-section">
          <div className="rule-card">
            <div className="rule-header">
              <span className="rule-name">{ruleLabel}</span>
              <span className="rule-street">
                {isFlop ? 'フロップ（残り2枚）' : 'ターン（残り1枚）'}
              </span>
            </div>
            <div className="rule-formula">{ruleFormula}</div>
            <div className="rule-comparison">
              <div className="rule-value">
                <span className="rv-label">暗算（近似）</span>
                <span className="rv-number">{activeRule}%</span>
              </div>
              {actualWinRate !== undefined && (
                <>
                  <div className="rule-vs">vs</div>
                  <div className="rule-value">
                    <span className="rv-label">実測（MC法）</span>
                    <span className="rv-number actual">{actualWinRate}%</span>
                  </div>
                </>
              )}
            </div>
            {actualWinRate !== undefined && (
              <div className="rule-accuracy">
                誤差: {Math.abs(activeRule - actualWinRate).toFixed(1)}%
                {Math.abs(activeRule - actualWinRate) <= 3
                  ? ' — 暗算で十分な精度!'
                  : Math.abs(activeRule - actualWinRate) <= 6
                  ? ' — 概ね合っています'
                  : ' — アウツが多い場合は4&2は過大評価気味'}
              </div>
            )}
          </div>

          {/* 4&2の解説 */}
          <div className="rule-tip">
            <span className="tip-icon">💡</span>
            <span className="tip-text">
              {isFlop
                ? 'フロップ時はアウツ数×4が大体の勝率。ライブゲーム中に暗算で判断できます。'
                : 'ターン時はアウツ数×2が大体の勝率。残り1枚なので×2になります。'}
            </span>
          </div>
        </div>
      )}

      {/* 各ドロー詳細 */}
      <div className="draws-list">
        {outs.draws.map((draw, i) => (
          <div key={i} className="draw-item">
            <div className="draw-header">
              <span className="draw-dot" style={{ background: getDrawColor(draw.name) }} />
              <span className="draw-name">{draw.name}</span>
              <span className="draw-outs-badge">{draw.outs}アウツ</span>
            </div>
            <p className="draw-desc">{draw.description}</p>
            <div className="draw-out-cards">
              {draw.outCards.slice(0, 12).map(card => (
                <div key={card} className="mini-card">
                  <CardDisplay card={card} size="small" />
                </div>
              ))}
              {draw.outCards.length > 12 && (
                <span className="more-cards">+{draw.outCards.length - 12}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* アウツ早見表 */}
      <div className="outs-reference">
        <h4 className="ref-title">アウツ早見表（ルール・オブ・4&2）</h4>
        <div className="ref-table">
          <div className="ref-header-row">
            <span>ドロー</span>
            <span>アウツ</span>
            <span>フロップ(×4)</span>
            <span>ターン(×2)</span>
          </div>
          {OUTS_REFERENCE.map(row => (
            <div key={row.draw} className={`ref-row ${outs.draws.some(d => d.name.includes(row.match)) ? 'highlight' : ''}`}>
              <span>{row.draw}</span>
              <span className="ref-outs">{row.outs}</span>
              <span>{row.flop}%</span>
              <span>{row.turn}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const OUTS_REFERENCE = [
  { draw: 'セットドロー', outs: 2, flop: 8, turn: 4, match: 'セット' },
  { draw: 'ガットショット', outs: 4, flop: 16, turn: 8, match: 'ガットショット' },
  { draw: 'オーバーカード2枚', outs: 6, flop: 24, turn: 12, match: 'オーバーカード' },
  { draw: 'OESD', outs: 8, flop: 32, turn: 16, match: 'オープンエンド' },
  { draw: 'フラッシュドロー', outs: 9, flop: 36, turn: 18, match: 'フラッシュドロー' },
  { draw: 'フラッシュ+ガットショット', outs: 12, flop: 48, turn: 24, match: '' },
  { draw: 'フラッシュ+OESD', outs: 15, flop: 60, turn: 30, match: '' },
];
