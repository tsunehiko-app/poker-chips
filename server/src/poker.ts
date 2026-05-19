// ===== カード定義 =====
export type Suit = 'h' | 'd' | 'c' | 's'; // hearts, diamonds, clubs, spades
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['h', 'd', 'c', 's'];

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

// ===== デッキ生成 =====
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function parseCard(str: string): Card {
  const rank = str[0].toUpperCase() as Rank;
  const suit = str[1].toLowerCase() as Suit;
  if (!RANKS.includes(rank) || !SUITS.includes(suit)) {
    throw new Error(`Invalid card: ${str}`);
  }
  return { rank, suit };
}

function cardKey(card: Card): string {
  return `${card.rank}${card.suit}`;
}

// ===== Fisher-Yatesシャッフル =====
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== ハンドランク評価 =====
export enum HandRank {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

export const HAND_RANK_NAMES: Record<HandRank, string> = {
  [HandRank.HighCard]: 'ハイカード',
  [HandRank.OnePair]: 'ワンペア',
  [HandRank.TwoPair]: 'ツーペア',
  [HandRank.ThreeOfAKind]: 'スリーオブアカインド',
  [HandRank.Straight]: 'ストレート',
  [HandRank.Flush]: 'フラッシュ',
  [HandRank.FullHouse]: 'フルハウス',
  [HandRank.FourOfAKind]: 'フォーオブアカインド',
  [HandRank.StraightFlush]: 'ストレートフラッシュ',
  [HandRank.RoyalFlush]: 'ロイヤルフラッシュ',
};

interface EvaluatedHand {
  rank: HandRank;
  values: number[]; // タイブレーク用の値（降順）
}

// 7枚から最強の5枚を見つけて評価する
export function evaluateHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) throw new Error('Need at least 5 cards');

  let best: EvaluatedHand | null = null;

  // 7枚から5枚の組み合わせを全列挙 (C(7,5) = 21通り)
  const n = cards.length;
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const five = [cards[i], cards[j], cards[k], cards[l], cards[m]];
            const ev = evaluate5(five);
            if (!best || compareHands(ev, best) > 0) {
              best = ev;
            }
          }
        }
      }
    }
  }

  return best!;
}

// 5枚のカードを評価
function evaluate5(cards: Card[]): EvaluatedHand {
  const values = cards.map(c => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // ストレート判定
  let isStraight = false;
  let straightHigh = 0;

  // 通常ストレート
  const uniqueVals = [...new Set(values)].sort((a, b) => b - a);
  if (uniqueVals.length >= 5) {
    for (let i = 0; i <= uniqueVals.length - 5; i++) {
      if (uniqueVals[i] - uniqueVals[i + 4] === 4) {
        isStraight = true;
        straightHigh = uniqueVals[i];
        break;
      }
    }
    // A-2-3-4-5 (ホイール)
    if (!isStraight && uniqueVals.includes(14) && uniqueVals.includes(2) &&
        uniqueVals.includes(3) && uniqueVals.includes(4) && uniqueVals.includes(5)) {
      isStraight = true;
      straightHigh = 5; // Aはローとして扱う
    }
  }

  // ランク別のカウント
  const counts: Record<number, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }

  const pairs: number[] = [];
  let threeKind = 0;
  let fourKind = 0;

  for (const [val, count] of Object.entries(counts)) {
    const v = parseInt(val);
    if (count === 4) fourKind = v;
    else if (count === 3) threeKind = v;
    else if (count === 2) pairs.push(v);
  }
  pairs.sort((a, b) => b - a);

  // ロイヤルフラッシュ
  if (isFlush && isStraight && straightHigh === 14) {
    return { rank: HandRank.RoyalFlush, values: [14] };
  }

  // ストレートフラッシュ
  if (isFlush && isStraight) {
    return { rank: HandRank.StraightFlush, values: [straightHigh] };
  }

  // フォーオブアカインド
  if (fourKind) {
    const kicker = values.filter(v => v !== fourKind)[0];
    return { rank: HandRank.FourOfAKind, values: [fourKind, kicker] };
  }

  // フルハウス
  if (threeKind && pairs.length > 0) {
    return { rank: HandRank.FullHouse, values: [threeKind, pairs[0]] };
  }

  // フラッシュ
  if (isFlush) {
    return { rank: HandRank.Flush, values };
  }

  // ストレート
  if (isStraight) {
    return { rank: HandRank.Straight, values: [straightHigh] };
  }

  // スリーオブアカインド
  if (threeKind) {
    const kickers = values.filter(v => v !== threeKind).slice(0, 2);
    return { rank: HandRank.ThreeOfAKind, values: [threeKind, ...kickers] };
  }

  // ツーペア
  if (pairs.length >= 2) {
    const kicker = values.filter(v => v !== pairs[0] && v !== pairs[1])[0];
    return { rank: HandRank.TwoPair, values: [pairs[0], pairs[1], kicker] };
  }

  // ワンペア
  if (pairs.length === 1) {
    const kickers = values.filter(v => v !== pairs[0]).slice(0, 3);
    return { rank: HandRank.OnePair, values: [pairs[0], ...kickers] };
  }

  // ハイカード
  return { rank: HandRank.HighCard, values: values.slice(0, 5) };
}

// ハンド比較: a > b なら正、a < b なら負、同じなら0
function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.values.length, b.values.length); i++) {
    if (a.values[i] !== b.values[i]) return a.values[i] - b.values[i];
  }
  return 0;
}

// ===== モンテカルロシミュレーション =====
export interface SimulationInput {
  myHand: string[];       // 例: ["Ah", "Kd"]
  board: string[];        // 例: ["Ts", "Jh", "Qc"] (0~5枚)
  opponents: OpponentInput[];  // 相手情報
  simulations: number;    // シミュレーション回数
}

export interface OpponentInput {
  hand?: string[];  // 指定あり: ["7h", "8h"], 指定なし: undefined（ランダム）
}

export interface SimulationResult {
  win: number;
  tie: number;
  lose: number;
  winRate: number;
  tieRate: number;
  loseRate: number;
  totalSimulations: number;
  myBestHand: string;     // 最頻出の最強ハンドランク名
  handDistribution: Record<string, number>; // ハンドランク分布
}

export function simulate(input: SimulationInput): SimulationResult {
  const myHand = input.myHand.map(parseCard);
  const board = input.board.map(parseCard);
  const opponents = input.opponents.map(op => ({
    hand: op.hand ? op.hand.map(parseCard) : undefined,
  }));

  // 使用済みカードを除外したデッキ
  const usedKeys = new Set<string>();
  myHand.forEach(c => usedKeys.add(cardKey(c)));
  board.forEach(c => usedKeys.add(cardKey(c)));
  opponents.forEach(op => {
    if (op.hand) op.hand.forEach(c => usedKeys.add(cardKey(c)));
  });

  const remainingDeck = createDeck().filter(c => !usedKeys.has(cardKey(c)));

  let wins = 0;
  let ties = 0;
  let losses = 0;
  const handRankCounts: Record<string, number> = {};

  const numOpponents = opponents.length || 1;
  const boardCardsNeeded = 5 - board.length;

  for (let sim = 0; sim < input.simulations; sim++) {
    const shuffled = shuffle(remainingDeck);
    let idx = 0;

    // ボードの残りカードを配る
    const fullBoard = [...board];
    for (let i = 0; i < boardCardsNeeded; i++) {
      fullBoard.push(shuffled[idx++]);
    }

    // 自分のハンド評価
    const myCards = [...myHand, ...fullBoard];
    const myEval = evaluateHand(myCards);
    const handName = HAND_RANK_NAMES[myEval.rank];
    handRankCounts[handName] = (handRankCounts[handName] || 0) + 1;

    // 相手のハンド評価
    let myWins = true;
    let hasTie = false;

    for (let o = 0; o < numOpponents; o++) {
      let opHand: Card[];
      if (opponents[o]?.hand) {
        opHand = opponents[o].hand!;
      } else {
        opHand = [shuffled[idx++], shuffled[idx++]];
      }

      const opCards = [...opHand, ...fullBoard];
      const opEval = evaluateHand(opCards);
      const cmp = compareHands(myEval, opEval);

      if (cmp < 0) {
        myWins = false;
        hasTie = false;
        break;
      } else if (cmp === 0) {
        hasTie = true;
      }
    }

    if (!myWins) {
      losses++;
    } else if (hasTie) {
      ties++;
    } else {
      wins++;
    }
  }

  const total = input.simulations;

  // 最頻出ハンドランク
  let bestHand = 'ハイカード';
  let maxCount = 0;
  for (const [hand, count] of Object.entries(handRankCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestHand = hand;
    }
  }

  return {
    win: wins,
    tie: ties,
    lose: losses,
    winRate: Math.round((wins / total) * 10000) / 100,
    tieRate: Math.round((ties / total) * 10000) / 100,
    loseRate: Math.round((losses / total) * 10000) / 100,
    totalSimulations: total,
    myBestHand: bestHand,
    handDistribution: handRankCounts,
  };
}

// ===== アウツ検出 =====
export interface DrawInfo {
  name: string;           // ドローの名前
  description: string;    // 説明
  outs: number;           // アウツ数
  outCards: string[];     // 具体的なアウツカード
  ruleOf4: number;        // ルール・オブ・4（フロップ時: outs×4）
  ruleOf2: number;        // ルール・オブ・2（ターン時: outs×2）
}

export interface OutsAnalysis {
  draws: DrawInfo[];
  totalOuts: number;        // 重複除去後の合計アウツ
  totalOutCards: string[];  // 重複除去後のアウツカード
  ruleOf4Equity: number;    // フロップ時の近似勝率
  ruleOf2Equity: number;    // ターン時の近似勝率
  street: 'preflop' | 'flop' | 'turn' | 'river';
  currentHandRank: string;  // 現在のハンドランク（ボードがある場合）
}

export function analyzeOuts(myHandStr: string[], boardStr: string[]): OutsAnalysis {
  const myHand = myHandStr.map(parseCard);
  const board = boardStr.map(parseCard);
  const allCards = [...myHand, ...board];

  // 使用済みカード
  const usedKeys = new Set(allCards.map(c => cardKey(c)));
  const remainingDeck = createDeck().filter(c => !usedKeys.has(cardKey(c)));

  // ストリート判定
  let street: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
  if (board.length === 3) street = 'flop';
  else if (board.length === 4) street = 'turn';
  else if (board.length === 5) street = 'river';

  // 現在のハンドランク（ボードがある場合）
  let currentHandRank = '';
  if (allCards.length >= 5) {
    const ev = evaluateHand(allCards);
    currentHandRank = HAND_RANK_NAMES[ev.rank];
  }

  const draws: DrawInfo[] = [];
  const allOutCards = new Set<string>();

  if (board.length >= 3 && board.length < 5) {
    // --- フラッシュドロー検出 ---
    detectFlushDraw(myHand, board, remainingDeck, draws, allOutCards);

    // --- ストレートドロー検出 ---
    detectStraightDraw(myHand, board, remainingDeck, draws, allOutCards);

    // --- オーバーカード検出 ---
    detectOvercards(myHand, board, remainingDeck, draws, allOutCards);

    // --- セット/トリップスドロー検出 ---
    detectSetDraw(myHand, board, remainingDeck, draws, allOutCards);

    // --- ツーペアドロー検出（ワンペア → ツーペア） ---
    detectTwoPairDraw(myHand, board, remainingDeck, draws, allOutCards);
  }

  const totalOutCards = [...allOutCards];
  const totalOuts = totalOutCards.length;

  // ルール・オブ・4&2 計算（上限は合計アウツに基づく）
  const ruleOf4Equity = Math.min(totalOuts * 4, 100);
  const ruleOf2Equity = Math.min(totalOuts * 2, 100);

  return {
    draws,
    totalOuts,
    totalOutCards,
    ruleOf4Equity,
    ruleOf2Equity,
    street,
    currentHandRank,
  };
}

// --- フラッシュドロー ---
function detectFlushDraw(
  myHand: Card[], board: Card[], remaining: Card[],
  draws: DrawInfo[], allOuts: Set<string>
) {
  const allCards = [...myHand, ...board];
  const suitCounts: Record<string, Card[]> = {};

  for (const c of allCards) {
    if (!suitCounts[c.suit]) suitCounts[c.suit] = [];
    suitCounts[c.suit].push(c);
  }

  for (const [suit, cards] of Object.entries(suitCounts)) {
    // 手札のカードがそのスートに含まれているか確認
    const myCardsInSuit = myHand.filter(c => c.suit === suit);
    if (myCardsInSuit.length === 0) continue; // 手札が関与しないフラッシュドローは除外

    if (cards.length === 4) {
      // フラッシュドロー（あと1枚）
      const outCards = remaining.filter(c => c.suit === suit);
      const outs = outCards.length;
      const outStrs = outCards.map(c => cardKey(c));

      draws.push({
        name: 'フラッシュドロー',
        description: `${suitName(suit as Suit)}があと1枚で完成`,
        outs,
        outCards: outStrs,
        ruleOf4: outs * 4,
        ruleOf2: outs * 2,
      });

      outStrs.forEach(c => allOuts.add(c));
    } else if (cards.length === 3 && myCardsInSuit.length >= 1) {
      // バックドアフラッシュドロー（あと2枚必要）
      const outCards = remaining.filter(c => c.suit === suit);
      draws.push({
        name: 'バックドアフラッシュドロー',
        description: `${suitName(suit as Suit)}があと2枚で完成（弱いドロー）`,
        outs: 1, // 近似的に1〜1.5アウツ相当
        outCards: outCards.slice(0, 3).map(c => cardKey(c)),
        ruleOf4: 4,
        ruleOf2: 2,
      });
      // バックドアは合計アウツに含めない（弱すぎる）
    }
  }
}

// --- ストレートドロー ---
function detectStraightDraw(
  myHand: Card[], board: Card[], remaining: Card[],
  draws: DrawInfo[], allOuts: Set<string>
) {
  const allCards = [...myHand, ...board];
  const vals = new Set(allCards.map(c => RANK_VALUE[c.rank]));
  // Aは1としても使える
  if (vals.has(14)) vals.add(1);

  const myVals = new Set(myHand.map(c => RANK_VALUE[c.rank]));
  if (myVals.has(14)) myVals.add(1);

  // 全ての5連続の窓をチェック
  let bestDraw: { type: string; neededVals: number[]; gapCount: number } | null = null;

  for (let low = 1; low <= 10; low++) {
    const window = [low, low + 1, low + 2, low + 3, low + 4];
    const have = window.filter(v => vals.has(v));
    const missing = window.filter(v => !vals.has(v));

    if (have.length === 4 && missing.length === 1) {
      // 手札がこの窓に関与しているか
      const myInWindow = window.filter(v => myVals.has(v));
      if (myInWindow.length === 0) continue;

      const missingVal = missing[0];

      // オープンエンド vs ガットショットの判定
      // ガットショット: 欠けているのが窓の内側
      const isGutshot = missingVal !== low && missingVal !== low + 4;

      if (!bestDraw || (isGutshot && bestDraw.type === 'gutshot') || !isGutshot) {
        bestDraw = {
          type: isGutshot ? 'gutshot' : 'oesd',
          neededVals: missing,
          gapCount: missing.length,
        };
      }
    }
  }

  // オープンエンドストレートドロー（4連続カードで両端が空いている）
  // 追加チェック: 4連続のカードがあるか
  for (let low = 1; low <= 11; low++) {
    const seq = [low, low + 1, low + 2, low + 3];
    if (seq.every(v => vals.has(v))) {
      const myInSeq = seq.filter(v => myVals.has(v));
      if (myInSeq.length === 0) continue;

      const lowOut = low - 1;
      const highOut = low + 4;

      // 両端が有効か（1未満や15以上は無効）
      const validLow = lowOut >= 1 && lowOut <= 14 && !vals.has(lowOut);
      const validHigh = highOut >= 1 && highOut <= 14 && !vals.has(highOut);

      if (validLow && validHigh) {
        // オープンエンドストレートドロー
        const outCards = remaining.filter(c => {
          const v = RANK_VALUE[c.rank];
          return v === lowOut || v === highOut || (lowOut === 1 && v === 14) || (highOut === 14 && v === 1);
        });
        const outStrs = outCards.map(c => cardKey(c));

        draws.push({
          name: 'オープンエンドストレートドロー',
          description: `両端どちらかが来ればストレート完成（8アウツ）`,
          outs: outCards.length,
          outCards: outStrs,
          ruleOf4: outCards.length * 4,
          ruleOf2: outCards.length * 2,
        });

        outStrs.forEach(c => allOuts.add(c));
        return; // OESDがあればガットショットは表示しない
      }
    }
  }

  // ガットショット（内側が1枚欠け）
  if (bestDraw?.type === 'gutshot') {
    const neededVal = bestDraw.neededVals[0];
    const actualVal = neededVal === 1 ? 14 : neededVal; // Aに変換
    const outCards = remaining.filter(c => RANK_VALUE[c.rank] === actualVal);
    const outStrs = outCards.map(c => cardKey(c));

    draws.push({
      name: 'ガットショットストレートドロー',
      description: `内側の1枚が来ればストレート完成（4アウツ）`,
      outs: outCards.length,
      outCards: outStrs,
      ruleOf4: outCards.length * 4,
      ruleOf2: outCards.length * 2,
    });

    outStrs.forEach(c => allOuts.add(c));
  }
}

// --- オーバーカード ---
function detectOvercards(
  myHand: Card[], board: Card[], remaining: Card[],
  draws: DrawInfo[], allOuts: Set<string>
) {
  const boardMaxVal = Math.max(...board.map(c => RANK_VALUE[c.rank]));
  const overcards = myHand.filter(c => RANK_VALUE[c.rank] > boardMaxVal);

  if (overcards.length > 0) {
    const outCards: string[] = [];
    for (const oc of overcards) {
      const outs = remaining.filter(c => c.rank === oc.rank);
      outs.forEach(c => outCards.push(cardKey(c)));
    }

    if (outCards.length > 0) {
      draws.push({
        name: 'オーバーカード',
        description: `ボードより高いカード（${overcards.map(c => c.rank).join(', ')}）でペアを作れる`,
        outs: outCards.length,
        outCards,
        ruleOf4: outCards.length * 4,
        ruleOf2: outCards.length * 2,
      });

      outCards.forEach(c => allOuts.add(c));
    }
  }
}

// --- セットドロー（ポケットペア → セット）---
function detectSetDraw(
  myHand: Card[], board: Card[], remaining: Card[],
  draws: DrawInfo[], allOuts: Set<string>
) {
  if (myHand[0].rank === myHand[1].rank) {
    // ポケットペアを持っている
    const boardHasMatch = board.some(c => c.rank === myHand[0].rank);
    if (!boardHasMatch) {
      const outCards = remaining
        .filter(c => c.rank === myHand[0].rank)
        .map(c => cardKey(c));

      if (outCards.length > 0) {
        draws.push({
          name: 'セットドロー',
          description: `ポケット${myHand[0].rank}${myHand[0].rank}がセットになる`,
          outs: outCards.length,
          outCards,
          ruleOf4: outCards.length * 4,
          ruleOf2: outCards.length * 2,
        });

        outCards.forEach(c => allOuts.add(c));
      }
    }
  }
}

// --- ツーペアドロー ---
function detectTwoPairDraw(
  myHand: Card[], board: Card[], remaining: Card[],
  draws: DrawInfo[], allOuts: Set<string>
) {
  // 既にワンペア（手札1枚がボードとペア）の場合、もう1枚もペアにできるか
  const allCards = [...myHand, ...board];
  if (allCards.length < 5) return;

  const ev = evaluateHand(allCards);
  if (ev.rank !== HandRank.OnePair) return;

  // 手札のうちペアになっていないカード
  const boardRanks = board.map(c => c.rank);
  const unpairedHandCards = myHand.filter(c => {
    // このカードがペアの一部でないか確認
    const countInAll = allCards.filter(ac => ac.rank === c.rank).length;
    return countInAll === 1; // 1枚だけ = ペアでない
  });

  for (const uc of unpairedHandCards) {
    const outCards = remaining
      .filter(c => c.rank === uc.rank)
      .map(c => cardKey(c));

    if (outCards.length > 0) {
      draws.push({
        name: 'ツーペアドロー',
        description: `${uc.rank}がもう1枚来ればツーペア`,
        outs: outCards.length,
        outCards,
        ruleOf4: outCards.length * 4,
        ruleOf2: outCards.length * 2,
      });
      // ツーペアドローは弱めなので合計には含めるが優先度低
      outCards.forEach(c => allOuts.add(c));
    }
  }
}

function suitName(suit: Suit): string {
  const names: Record<Suit, string> = {
    h: 'ハート', d: 'ダイヤ', c: 'クラブ', s: 'スペード',
  };
  return names[suit];
}
