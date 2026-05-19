import './OddsTable.css';

// プリフロップ勝率表データ（2人対戦時の近似値）
const PREFLOP_ODDS = [
  { hand: 'AA', preflop: '85.3%', flop: '-', turn: '-', river: '-' },
  { hand: 'KK', preflop: '82.4%', flop: '-', turn: '-', river: '-' },
  { hand: 'QQ', preflop: '79.9%', flop: '-', turn: '-', river: '-' },
  { hand: 'JJ', preflop: '77.5%', flop: '-', turn: '-', river: '-' },
  { hand: 'TT', preflop: '75.1%', flop: '-', turn: '-', river: '-' },
  { hand: 'AKs', preflop: '67.0%', flop: '-', turn: '-', river: '-' },
  { hand: '99', preflop: '72.1%', flop: '-', turn: '-', river: '-' },
  { hand: 'AQs', preflop: '66.1%', flop: '-', turn: '-', river: '-' },
  { hand: 'AKo', preflop: '65.4%', flop: '-', turn: '-', river: '-' },
  { hand: '88', preflop: '69.1%', flop: '-', turn: '-', river: '-' },
  { hand: 'AJs', preflop: '65.4%', flop: '-', turn: '-', river: '-' },
  { hand: 'KQs', preflop: '63.4%', flop: '-', turn: '-', river: '-' },
  { hand: '77', preflop: '66.2%', flop: '-', turn: '-', river: '-' },
  { hand: 'ATs', preflop: '64.7%', flop: '-', turn: '-', river: '-' },
  { hand: 'AQo', preflop: '64.5%', flop: '-', turn: '-', river: '-' },
];

// よくあるオールインマッチアップ
const MATCHUPS = [
  { matchup: 'AA vs KK', result: 'AA有利 81.9%' },
  { matchup: 'AA vs QQ', result: 'AA有利 82.4%' },
  { matchup: 'KK vs AKs', result: 'KK有利 65.7%' },
  { matchup: 'AA vs AKs', result: 'AA有利 87.2%' },
  { matchup: 'TT vs AKs', result: 'TT有利 54.2%' },
  { matchup: 'KK vs AKo', result: 'KK有利 69.2%' },
  { matchup: 'AA vs JJ', result: 'AA有利 80.2%' },
  { matchup: 'QQ vs AKs', result: 'QQ有利 54.0%' },
  { matchup: 'AKs vs JTs', result: 'AKs有利 60.7%' },
  { matchup: 'AA vs 72o', result: 'AA有利 88.0%' },
];

export function OddsTable() {
  return (
    <div className="odds-tables">
      {/* プリフロップ勝率表 */}
      <section className="odds-section">
        <h3 className="odds-title">ポーカーの勝率一覧</h3>
        <p className="odds-desc">
          フロップ前の各ハンドの勝率一覧（対ランダムハンド1人）
        </p>
        <div className="table-wrapper">
          <table className="odds-table">
            <thead>
              <tr>
                <th>ハンド</th>
                <th>プリフロップ勝率</th>
              </tr>
            </thead>
            <tbody>
              {PREFLOP_ODDS.map(row => (
                <tr key={row.hand}>
                  <td className="hand-cell">{row.hand}</td>
                  <td>
                    <div className="rate-bar-container">
                      <div
                        className="rate-bar"
                        style={{ width: row.preflop }}
                      />
                      <span className="rate-text">{row.preflop}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* マッチアップ表 */}
      <section className="odds-section">
        <h3 className="odds-title">よくあるオールインマッチアップ</h3>
        <div className="table-wrapper">
          <table className="odds-table">
            <thead>
              <tr>
                <th>マッチアップ</th>
                <th>予想勝率</th>
              </tr>
            </thead>
            <tbody>
              {MATCHUPS.map(row => (
                <tr key={row.matchup}>
                  <td className="hand-cell">{row.matchup}</td>
                  <td>{row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 解説セクション */}
      <section className="odds-section">
        <h3 className="odds-title">ポーカーオッズとは何か</h3>
        <div className="info-text">
          <p>
            ポーカーオッズ（確率）は、あるハンドが勝つ可能性を数値で表したものです。
            テキサスホールデムでは、自分の2枚の手札と最大5枚の共通カード（ボード）から
            最強の5枚の組み合わせを作ります。
          </p>
          <p>
            この計算機では、モンテカルロ法（ランダムシミュレーション）を使って
            勝率を算出しています。シミュレーション回数が多いほど正確な結果が得られます。
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="odds-section">
        <h3 className="odds-title">FAQ</h3>
        <div className="faq-list">
          <details className="faq-item">
            <summary>ポーカーオッズとは何ですか？</summary>
            <p>ポーカーオッズは、特定のハンドが勝つ確率を表す数値です。プリフロップ（手札のみの段階）からリバー（全てのカードが開かれた段階）まで、各段階での勝率を計算できます。</p>
          </details>
          <details className="faq-item">
            <summary>どうやってポーカーオッズを計算していますか？</summary>
            <p>モンテカルロ法と呼ばれるシミュレーション手法を使用しています。ランダムに残りのカードを配る試行を数千〜数万回繰り返し、勝ち・負け・引き分けの割合から確率を算出します。</p>
          </details>
          <details className="faq-item">
            <summary>インプライドオッズとは何ですか？</summary>
            <p>インプライドオッズは、現在のポットだけでなく、将来のベッティングラウンドで獲得できる可能性のあるチップも考慮した拡張的なオッズ計算です。相手がコールしてくれる額まで含めて計算します。</p>
          </details>
          <details className="faq-item">
            <summary>ポットオッズとは何ですか？</summary>
            <p>ポットオッズは、コールするために必要な額とポットの合計額の比率です。例えばポットが100でコール額が20の場合、ポットオッズは5:1です。ハンドの勝率がこのオッズを上回る場合、コールは期待値がプラスになります。</p>
          </details>
          <details className="faq-item">
            <summary>音声入力はどのブラウザで使えますか？</summary>
            <p>音声入力にはWeb Speech APIを使用しています。Chrome、Edge、Safariの最新版で利用可能です。「ハートのエース」「スペードのキング」のように日本語で話しかけてください。</p>
          </details>
        </div>
      </section>
    </div>
  );
}
