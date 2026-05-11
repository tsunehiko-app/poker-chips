import { Player, SidePot, PotState } from '../../../shared/types';

export interface PotInfo {
  amount: number;
  eligiblePlayerIds: string[];
}

/**
 * プレイヤーのベットからメインポットとサイドポットを計算する
 */
export function calculatePots(players: Player[]): PotState {
  // ベットがあるプレイヤーのみ抽出し、ベット額でソート
  const bettingPlayers = players
    .filter((p) => p.currentBet > 0)
    .sort((a, b) => a.currentBet - b.currentBet);

  if (bettingPlayers.length === 0) {
    return { main: 0, sidePots: [], total: 0 };
  }

  const pots: PotInfo[] = [];
  let processedAmount = 0;

  // 各ベットレベルでポットを分割
  const uniqueBets = [...new Set(bettingPlayers.map((p) => p.currentBet))].sort(
    (a, b) => a - b
  );

  for (const betLevel of uniqueBets) {
    const contribution = betLevel - processedAmount;
    if (contribution <= 0) continue;

    // このレベルに貢献できるプレイヤー（ベットがこのレベル以上）
    const eligible = bettingPlayers.filter((p) => p.currentBet >= betLevel);
    // このレベルのポット額 = 貢献額 × 貢献者数
    const potAmount = contribution * eligible.length;

    // eligibleからfold済みでないプレイヤーのみがポットを獲得できる
    const eligibleForWin = eligible
      .filter((p) => p.status !== 'folded')
      .map((p) => p.id);

    pots.push({
      amount: potAmount,
      eligiblePlayerIds: eligibleForWin,
    });

    processedAmount = betLevel;
  }

  if (pots.length === 0) {
    return { main: 0, sidePots: [], total: 0 };
  }

  const mainPot = pots[0].amount;
  const sidePots: SidePot[] = pots.slice(1).map((p) => ({
    amount: p.amount,
    eligiblePlayerIds: p.eligiblePlayerIds,
  }));

  const total = pots.reduce((sum, p) => sum + p.amount, 0);

  return {
    main: mainPot,
    sidePots,
    total,
  };
}

/**
 * ポットを勝者に分配する
 * @param currentPot 現在のポット状態
 * @param accumulatedPot 前のラウンドから蓄積されたポット
 * @param winnerIds 勝者のプレイヤーID配列
 * @param players 全プレイヤー
 * @returns 各ポットの分配結果と各プレイヤーの獲得額
 */
export function distributePots(
  currentPot: PotState,
  accumulatedPot: number,
  winnerIds: string[],
  players: Player[]
): {
  distributions: { potIndex: number; amount: number; winnerIds: string[] }[];
  playerWinnings: Map<string, number>;
} {
  const playerWinnings = new Map<string, number>();
  const distributions: {
    potIndex: number;
    amount: number;
    winnerIds: string[];
  }[] = [];

  // メインポット + 蓄積されたポットの分配
  const mainTotal = currentPot.main + accumulatedPot;
  if (mainTotal > 0) {
    // メインポットは全プレイヤーが対象なので、winnerIdsからそのまま分配
    const mainWinners = winnerIds.filter((id) => {
      const player = players.find((p) => p.id === id);
      return player && player.status !== 'folded';
    });

    if (mainWinners.length > 0) {
      const share = Math.floor(mainTotal / mainWinners.length);
      const remainder = mainTotal - share * mainWinners.length;

      mainWinners.forEach((id, idx) => {
        const amount = share + (idx === 0 ? remainder : 0);
        playerWinnings.set(id, (playerWinnings.get(id) || 0) + amount);
      });

      distributions.push({
        potIndex: 0,
        amount: mainTotal,
        winnerIds: mainWinners,
      });
    }
  }

  // サイドポットの分配
  currentPot.sidePots.forEach((sidePot, index) => {
    if (sidePot.amount <= 0) return;

    // サイドポットの対象者のうち、勝者に含まれるプレイヤー
    const eligibleWinners = winnerIds.filter((id) =>
      sidePot.eligiblePlayerIds.includes(id)
    );

    if (eligibleWinners.length > 0) {
      const share = Math.floor(sidePot.amount / eligibleWinners.length);
      const remainder = sidePot.amount - share * eligibleWinners.length;

      eligibleWinners.forEach((id, idx) => {
        const amount = share + (idx === 0 ? remainder : 0);
        playerWinnings.set(id, (playerWinnings.get(id) || 0) + amount);
      });

      distributions.push({
        potIndex: index + 1,
        amount: sidePot.amount,
        winnerIds: eligibleWinners,
      });
    } else {
      // 対象の勝者がいない場合、eligible全員に返却
      const fallbackWinners = sidePot.eligiblePlayerIds;
      if (fallbackWinners.length > 0) {
        const share = Math.floor(sidePot.amount / fallbackWinners.length);
        const remainder = sidePot.amount - share * fallbackWinners.length;

        fallbackWinners.forEach((id, idx) => {
          const amount = share + (idx === 0 ? remainder : 0);
          playerWinnings.set(id, (playerWinnings.get(id) || 0) + amount);
        });

        distributions.push({
          potIndex: index + 1,
          amount: sidePot.amount,
          winnerIds: fallbackWinners,
        });
      }
    }
  });

  return { distributions, playerWinnings };
}
