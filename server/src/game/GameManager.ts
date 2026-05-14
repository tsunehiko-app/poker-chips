import {
  GameState,
  GamePhase,
  GameSettings,
  Player,
  PlayerAction,
  PlayerStatus,
  PotState,
  AvailableActions,
  HandResult,
  FinalResult,
  TournamentState,
  BlindLevel,
  BLIND_STRUCTURE,
} from '../../../shared/types';
import { calculatePots, distributePots } from './PotCalculator';

export class GameManager {
  private gameState: GameState;
  private accumulatedPot: number = 0; // ラウンド間で蓄積されるポット
  private lastRaiserId: string | null = null; // 最後にレイズしたプレイヤー
  private actedInRound: Set<string> = new Set(); // このラウンドでアクション済みのプレイヤー

  constructor(
    private roomCode: string,
    settings: GameSettings,
    players: Player[]
  ) {
    const adjustedPlayers = players.map((p) => ({ ...p }));

    // スタック差の適用
    if (settings.stackVariance !== 'none' && adjustedPlayers.length >= 2) {
      const base = settings.initialChips;
      // small: ±10% の範囲, large: ±30% の範囲
      const varianceRate = settings.stackVariance === 'small' ? 0.10 : 0.30;
      const totalTarget = base * adjustedPlayers.length;

      // 各プレイヤーにランダムな係数を割り当て
      const rawChips = adjustedPlayers.map(() => {
        const factor = 1 + (Math.random() * 2 - 1) * varianceRate;
        return Math.round(base * factor);
      });

      // 合計が元の合計と同じになるよう調整（BBの倍数に丸める）
      const bb = settings.bigBlind || 1;
      const rawTotal = rawChips.reduce((s, c) => s + c, 0);
      const scale = totalTarget / rawTotal;
      const finalChips = rawChips.map((c) => Math.max(bb, Math.round((c * scale) / bb) * bb));

      // 端数調整: 差分を最大チップの人に付与
      const finalTotal = finalChips.reduce((s, c) => s + c, 0);
      const diff = totalTarget - finalTotal;
      if (diff !== 0) {
        const maxIdx = finalChips.indexOf(Math.max(...finalChips));
        finalChips[maxIdx] += diff;
      }

      adjustedPlayers.forEach((p, i) => {
        p.chips = finalChips[i];
      });
    }

    this.gameState = {
      phase: 'waiting',
      players: adjustedPlayers,
      dealerIndex: -1, // startNewHandで0に設定される
      currentPlayerIndex: 0,
      pot: { main: 0, sidePots: [], total: 0 },
      currentBet: 0,
      handNumber: 0,
      settings: { ...settings },
    };

    // トーナメントモードの初期化
    if (settings.tournament.enabled) {
      const startIdx = this.findStructureIndex(settings.tournament.startLevel);
      const level = BLIND_STRUCTURE[startIdx];
      this.gameState.settings.smallBlind = level.sb;
      this.gameState.settings.bigBlind = level.bb;
      this.gameState.settings.ante = level.ante;
      this.gameState.tournament = {
        currentLevel: level.level,
        structureIndex: startIdx,
        levelStartTime: Date.now(),
        isPaused: false,
        pausedTimeRemaining: 0,
      };
    }
  }

  /**
   * BLIND_STRUCTUREの中からレベル番号に対応するインデックスを探す
   */
  private findStructureIndex(level: number): number {
    const idx = BLIND_STRUCTURE.findIndex((l) => l.level === level && !l.isBreak);
    return idx >= 0 ? idx : 0;
  }

  getState(): GameState {
    return { ...this.gameState };
  }

  /**
   * 新しいハンドを開始する
   */
  startNewHand(): GameState {
    const state = this.gameState;
    state.handNumber++;

    // 全プレイヤーの状態をリセット（busted以外）
    state.players.forEach((p) => {
      if (p.status !== 'busted') {
        p.status = 'active';
        p.currentBet = 0;
        p.totalBet = 0;
      }
    });

    // ポットリセット
    state.pot = { main: 0, sidePots: [], total: 0 };
    state.currentBet = 0;
    this.accumulatedPot = 0;
    this.actedInRound.clear();
    this.lastRaiserId = null;

    // ディーラーボタンを決定
    if (state.handNumber === 1) {
      // 初回ハンド: ランダムにディーラーを選択
      const activeIndices: number[] = [];
      state.players.forEach((p, i) => {
        if (p.status !== 'busted') activeIndices.push(i);
      });
      const randomIdx = Math.floor(Math.random() * activeIndices.length);
      state.dealerIndex = activeIndices[randomIdx];
    } else {
      // 2回目以降: 次のアクティブプレイヤーに移動
      state.dealerIndex = this.findNextActivePlayer(state.dealerIndex);
    }

    // SB, BBの設定
    const activePlayers = this.getActivePlayers();

    if (activePlayers.length === 2) {
      // ヘッズアップ: ディーラー=SB、もう一人=BB
      const sbIndex = state.dealerIndex;
      const bbIndex = this.findNextActivePlayer(sbIndex);
      this.postBlind(sbIndex, state.settings.smallBlind);
      this.postBlind(bbIndex, state.settings.bigBlind);
      state.currentBet = state.settings.bigBlind;
      // ヘッズアップではSB(ディーラー)からアクション開始
      state.currentPlayerIndex = sbIndex;
    } else if (activePlayers.length >= 3) {
      const sbIndex = this.findNextActivePlayer(state.dealerIndex);
      const bbIndex = this.findNextActivePlayer(sbIndex);
      this.postBlind(sbIndex, state.settings.smallBlind);
      this.postBlind(bbIndex, state.settings.bigBlind);
      state.currentBet = state.settings.bigBlind;
      // プリフロップ: BBの次からアクション開始
      state.currentPlayerIndex = this.findNextActivePlayer(bbIndex);
    }

    // アンティの徴収（BBのみ）
    if (state.settings.ante > 0) {
      // BBプレイヤーを特定
      const bbPlayer = activePlayers.length === 2
        ? state.players[this.findNextActivePlayer(state.dealerIndex)]
        : state.players[this.findNextActivePlayer(this.findNextActivePlayer(state.dealerIndex))];
      if (bbPlayer && bbPlayer.status !== 'busted') {
        const anteAmount = Math.min(bbPlayer.chips, state.settings.ante);
        bbPlayer.chips -= anteAmount;
        bbPlayer.totalBet += anteAmount;
        state.pot.main += anteAmount;
        state.pot.total += anteAmount;
        this.accumulatedPot += anteAmount;
        if (bbPlayer.chips === 0 && bbPlayer.status !== 'allin') {
          bbPlayer.status = 'allin';
        }
      }
    }

    state.phase = 'preflop';
    state.lastAction = undefined;

    return this.getState();
  }

  /**
   * ブラインドを投稿する
   */
  private postBlind(playerIndex: number, amount: number): void {
    const player = this.gameState.players[playerIndex];
    if (player.chips <= amount) {
      // チップが足りない場合はオールイン
      player.currentBet = player.chips;
      player.chips = 0;
      player.status = 'allin';
    } else {
      player.currentBet = amount;
      player.chips -= amount;
    }
  }

  /**
   * プレイヤーのアクションを処理する
   * @returns handComplete: ハンド終了か, roundComplete: ラウンド終了か
   */
  handleAction(
    playerId: string,
    action: PlayerAction,
    amount?: number
  ): { handComplete: boolean; roundComplete: boolean; autoWin: boolean } {
    const state = this.gameState;
    const playerIndex = state.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) {
      throw new Error('プレイヤーが見つかりません');
    }

    const player = state.players[playerIndex];
    if (playerIndex !== state.currentPlayerIndex) {
      throw new Error('あなたのターンではありません');
    }
    if (player.status !== 'active') {
      throw new Error('アクションできない状態です');
    }

    let actionAmount = 0;

    switch (action) {
      case 'fold':
        player.status = 'folded';
        actionAmount = 0;
        break;

      case 'check':
        if (player.currentBet < state.currentBet) {
          throw new Error('チェックできません。コールまたはレイズしてください');
        }
        actionAmount = 0;
        break;

      case 'call': {
        const callAmount = state.currentBet - player.currentBet;
        if (callAmount <= 0) {
          throw new Error('コールする必要はありません');
        }
        if (player.chips <= callAmount) {
          // チップが足りない場合はオールイン
          actionAmount = player.chips;
          player.currentBet += player.chips;
          player.chips = 0;
          player.status = 'allin';
        } else {
          actionAmount = callAmount;
          player.chips -= callAmount;
          player.currentBet += callAmount;
        }
        break;
      }

      case 'raise': {
        const raiseAmount = amount || 0;
        if (raiseAmount <= 0) {
          throw new Error('レイズ額を指定してください');
        }
        const totalBet = raiseAmount;
        const additionalChips = totalBet - player.currentBet;

        if (additionalChips > player.chips) {
          throw new Error('チップが足りません');
        }
        if (totalBet <= state.currentBet) {
          throw new Error('現在のベット以上にレイズしてください');
        }

        const minRaise = state.currentBet + state.settings.bigBlind;
        if (totalBet < minRaise && additionalChips < player.chips) {
          throw new Error(`最低レイズ額は ${minRaise} です`);
        }

        player.chips -= additionalChips;
        player.currentBet = totalBet;
        state.currentBet = totalBet;
        actionAmount = totalBet;
        this.lastRaiserId = playerId;
        // レイズ時は他のプレイヤーのacted状態をリセット
        this.actedInRound.clear();
        break;
      }

      case 'allin': {
        const allInAmount = player.chips;
        player.currentBet += allInAmount;
        actionAmount = player.currentBet;
        player.chips = 0;
        player.status = 'allin';

        if (player.currentBet > state.currentBet) {
          state.currentBet = player.currentBet;
          this.lastRaiserId = playerId;
          this.actedInRound.clear();
        }
        break;
      }
    }

    // アクション済みとしてマーク
    this.actedInRound.add(playerId);

    // lastActionを記録
    state.lastAction = {
      playerId,
      action,
      amount: actionAmount,
    };

    // 1人だけ残った場合はハンド終了
    const activePlayers = this.getActivePlayers();
    const nonFoldedPlayers = state.players.filter(
      (p) => p.status !== 'folded' && p.status !== 'busted'
    );

    if (nonFoldedPlayers.length === 1) {
      return { handComplete: true, roundComplete: true, autoWin: true };
    }

    // 全員がオールインまたはフォールドで、アクティブプレイヤーが0人なら自動進行
    if (activePlayers.length === 0) {
      // 誰もアクションできるプレイヤーがいない → ラウンドを自動的に進める
      return { handComplete: false, roundComplete: true, autoWin: false };
    }

    // アクティブプレイヤーが1人だけ残っている場合
    // → その人が現在のベットに追いついていて、アクション済みならラウンド完了
    // → まだベットに追いついていないなら、コール/フォールドの機会を与える
    if (activePlayers.length === 1) {
      const remaining = activePlayers[0];
      if (
        this.actedInRound.has(remaining.id) &&
        remaining.currentBet >= state.currentBet
      ) {
        return { handComplete: false, roundComplete: true, autoWin: false };
      }
      // まだアクションが必要な場合はラウンド継続（isRoundCompleteで判定）
    }

    // ラウンド終了判定
    if (this.isRoundComplete()) {
      return { handComplete: false, roundComplete: true, autoWin: false };
    }

    // 次のプレイヤーに移動
    state.currentPlayerIndex = this.findNextActivePlayer(playerIndex);

    return { handComplete: false, roundComplete: false, autoWin: false };
  }

  /**
   * ラウンドが完了したかチェック
   */
  private isRoundComplete(): boolean {
    const state = this.gameState;
    const activePlayers = state.players.filter(
      (p) => p.status === 'active'
    );

    // アクティブプレイヤーが全員同額をベットし、全員がアクション済み
    for (const player of activePlayers) {
      if (!this.actedInRound.has(player.id)) {
        return false;
      }
      if (player.currentBet !== state.currentBet) {
        return false;
      }
    }

    return true;
  }

  /**
   * フェーズを進める (preflop→flop→turn→river→showdown)
   */
  advancePhase(): GameState {
    const state = this.gameState;
    const phaseOrder: GamePhase[] = [
      'preflop',
      'flop',
      'turn',
      'river',
      'showdown',
    ];
    const currentIndex = phaseOrder.indexOf(state.phase);
    if (currentIndex === -1 || currentIndex >= phaseOrder.length - 1) {
      throw new Error('これ以上フェーズを進められません');
    }

    // 現在のベットをポットに蓄積
    this.collectBets();

    const nextPhase = phaseOrder[currentIndex + 1];
    state.phase = nextPhase;

    if (nextPhase === 'showdown') {
      return this.getState();
    }

    // ラウンドリセット
    state.currentBet = 0;
    this.actedInRound.clear();
    this.lastRaiserId = null;

    // ポストフロップ: ディーラーの左の最初のアクティブプレイヤーから開始
    const firstActive = this.findNextActivePlayer(state.dealerIndex);
    state.currentPlayerIndex = firstActive;

    return this.getState();
  }

  /**
   * 全プレイヤーのベットをポットに集める
   */
  private collectBets(): void {
    const state = this.gameState;
    const pots = calculatePots(state.players);

    // 蓄積されたポットに加算
    this.accumulatedPot += pots.total;

    // ポット状態を更新（蓄積分を含む）
    state.pot = {
      main: pots.main,
      sidePots: pots.sidePots,
      total: this.accumulatedPot,
    };

    // 全プレイヤーのtotalBetに加算してからcurrentBetをリセット
    state.players.forEach((p) => {
      p.totalBet += p.currentBet;
      p.currentBet = 0;
    });
  }

  /**
   * 勝者を選択してポットを分配する
   * サイドポット対応: totalBetベースでポット構造を再計算し、
   * 各ポットの対象者のみに分配する
   */
  selectWinners(winnerIds: string[]): HandResult {
    const state = this.gameState;

    // まだ未回収のベットがあれば集める
    this.collectBets();

    const validWinners = winnerIds.filter((id) => {
      const p = state.players.find((pl) => pl.id === id);
      return p && p.status !== 'folded' && p.status !== 'busted';
    });

    // totalBetを使ってサイドポット構造を再計算
    const bettingPlayers = state.players
      .filter((p) => p.totalBet > 0)
      .sort((a, b) => a.totalBet - b.totalBet);

    const pots: { amount: number; eligiblePlayerIds: string[] }[] = [];
    let processedAmount = 0;

    const uniqueBets = [...new Set(bettingPlayers.map((p) => p.totalBet))].sort(
      (a, b) => a - b
    );

    for (const betLevel of uniqueBets) {
      const contribution = betLevel - processedAmount;
      if (contribution <= 0) continue;

      // このレベルに貢献したプレイヤー（totalBetがこのレベル以上）
      const contributors = bettingPlayers.filter((p) => p.totalBet >= betLevel);
      const potAmount = contribution * contributors.length;

      // fold/busted以外のプレイヤーのみが獲得対象
      const eligibleForWin = contributors
        .filter((p) => p.status !== 'folded' && p.status !== 'busted')
        .map((p) => p.id);

      pots.push({ amount: potAmount, eligiblePlayerIds: eligibleForWin });
      processedAmount = betLevel;
    }

    // 各ポットを分配
    const playerWinnings = new Map<string, number>();
    const distributions: { potIndex: number; amount: number; winnerIds: string[] }[] = [];

    pots.forEach((pot, index) => {
      if (pot.amount <= 0) return;

      // このポットの対象者のうち、選択された勝者
      const potWinners = validWinners.filter((id) =>
        pot.eligiblePlayerIds.includes(id)
      );

      if (potWinners.length > 0) {
        const share = Math.floor(pot.amount / potWinners.length);
        const remainder = pot.amount - share * potWinners.length;
        potWinners.forEach((id, idx) => {
          const amt = share + (idx === 0 ? remainder : 0);
          playerWinnings.set(id, (playerWinnings.get(id) || 0) + amt);
        });
        distributions.push({
          potIndex: index,
          amount: pot.amount,
          winnerIds: potWinners,
        });
      } else {
        // 選択された勝者がこのポットの対象外 → 対象者全員に返却
        const fallback = pot.eligiblePlayerIds;
        if (fallback.length > 0) {
          const share = Math.floor(pot.amount / fallback.length);
          const remainder = pot.amount - share * fallback.length;
          fallback.forEach((id, idx) => {
            const amt = share + (idx === 0 ? remainder : 0);
            playerWinnings.set(id, (playerWinnings.get(id) || 0) + amt);
          });
          distributions.push({
            potIndex: index,
            amount: pot.amount,
            winnerIds: fallback,
          });
        }
      }
    });

    // チップを勝者に付与（amountは純利益 = 獲得額 - 自分のベット額）
    const winners: HandResult['winners'] = [];
    playerWinnings.forEach((grossAmount, playerId) => {
      const player = state.players.find((p) => p.id === playerId);
      if (player) {
        player.chips += grossAmount;
        const netProfit = grossAmount - player.totalBet;
        winners.push({
          playerId: player.id,
          playerName: player.name,
          amount: netProfit,
        });
      }
    });

    // 勝者に選ばれなかったがチップを返却されたプレイヤーも結果に含める
    state.players.forEach((p) => {
      if (playerWinnings.has(p.id) && !validWinners.includes(p.id)) {
        const grossAmount = playerWinnings.get(p.id)!;
        const netProfit = grossAmount - p.totalBet;
        winners.push({
          playerId: p.id,
          playerName: p.name,
          amount: netProfit,
        });
      }
    });

    // バスト判定
    const bustedPlayers: HandResult['bustedPlayers'] = [];
    state.players.forEach((p) => {
      if (p.chips === 0 && p.status !== 'busted') {
        p.status = 'busted';
        bustedPlayers.push({
          playerId: p.id,
          playerName: p.name,
        });
      }
    });

    // ポットリセット
    state.pot = { main: 0, sidePots: [], total: 0 };
    this.accumulatedPot = 0;

    const result: HandResult = {
      winners,
      potDistribution: distributions,
      bustedPlayers,
    };

    return result;
  }

  /**
   * 1人だけ残った場合の自動勝利処理
   */
  autoResolveWinner(): HandResult {
    const state = this.gameState;
    const nonFolded = state.players.filter(
      (p) => p.status !== 'folded' && p.status !== 'busted'
    );

    if (nonFolded.length !== 1) {
      throw new Error('自動勝利の条件を満たしていません');
    }

    return this.selectWinners([nonFolded[0].id]);
  }

  /**
   * リバイ処理
   */
  handleRebuy(playerId: string): Player {
    const state = this.gameState;
    const player = state.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error('プレイヤーが見つかりません');
    }
    if (player.status !== 'busted') {
      throw new Error('バストしていないプレイヤーはリバイできません');
    }

    player.chips = state.settings.initialChips;
    player.rebuyCount++;
    player.status = 'sitting_out'; // 次のハンドからアクティブ

    return { ...player };
  }

  /**
   * プレイヤーが取れるアクションを返す
   */
  getAvailableActions(playerId: string): AvailableActions {
    const state = this.gameState;
    const player = state.players.find((p) => p.id === playerId);

    const noActions: AvailableActions = {
      canFold: false,
      canCheck: false,
      canCall: false,
      callAmount: 0,
      canRaise: false,
      minRaise: 0,
      maxRaise: 0,
      canAllIn: false,
      allInAmount: 0,
    };

    if (!player || player.status !== 'active') {
      return noActions;
    }

    const playerIndex = state.players.indexOf(player);
    if (playerIndex !== state.currentPlayerIndex) {
      return noActions;
    }

    const callAmount = state.currentBet - player.currentBet;
    const canCheck = callAmount === 0;
    const canCall = callAmount > 0 && player.chips > callAmount;
    const minRaise = state.currentBet + state.settings.bigBlind;
    const maxRaise = player.currentBet + player.chips; // トータルベット
    const canRaise = player.chips > callAmount && maxRaise >= minRaise;
    const canAllIn = player.chips > 0;
    const allInAmount = player.chips;

    return {
      canFold: true,
      canCheck,
      canCall,
      callAmount: Math.min(callAmount, player.chips),
      canRaise,
      minRaise,
      maxRaise,
      canAllIn,
      allInAmount,
    };
  }

  /**
   * 最終結果を計算する
   */
  getFinalResults(): FinalResult[] {
    const state = this.gameState;
    const results: FinalResult[] = state.players.map((p) => {
      const totalInvested =
        state.settings.initialChips * (1 + p.rebuyCount);
      return {
        playerId: p.id,
        playerName: p.name,
        finalChips: p.chips,
        initialChips: state.settings.initialChips,
        rebuyCount: p.rebuyCount,
        totalInvested,
        profit: p.chips - totalInvested,
        rank: 0,
      };
    });

    // チップ数の降順でランク付け
    results.sort((a, b) => b.finalChips - a.finalChips);
    results.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return results;
  }

  /**
   * ハンドが完了したかチェック（1人だけ残っている）
   */
  isHandComplete(): boolean {
    const nonFolded = this.gameState.players.filter(
      (p) => p.status !== 'folded' && p.status !== 'busted'
    );
    return nonFolded.length <= 1;
  }

  /**
   * アクティブプレイヤー数（active状態のプレイヤー。allin/foldedは含まない）
   */
  getActivePlayersCount(): number {
    return this.getActivePlayers().length;
  }

  /**
   * active状態のプレイヤーを取得
   */
  private getActivePlayers(): Player[] {
    return this.gameState.players.filter((p) => p.status === 'active');
  }

  /**
   * 次のアクティブプレイヤーのインデックスを探す
   */
  private findNextActivePlayer(fromIndex: number): number {
    const players = this.gameState.players;
    const count = players.length;

    for (let i = 1; i <= count; i++) {
      const idx = (fromIndex + i) % count;
      const p = players[idx];
      if (p.status === 'active') {
        return idx;
      }
    }

    // アクティブプレイヤーがいない場合、non-foldedの最初のプレイヤー
    for (let i = 1; i <= count; i++) {
      const idx = (fromIndex + i) % count;
      const p = players[idx];
      if (p.status !== 'folded' && p.status !== 'busted') {
        return idx;
      }
    }

    return fromIndex;
  }

  /**
   * プレイヤーの接続状態を更新
   */
  setPlayerConnected(playerId: string, connected: boolean): void {
    const player = this.gameState.players.find((p) => p.id === playerId);
    if (player) {
      player.isConnected = connected;
    }
  }

  /**
   * ショーダウン状態かチェック
   */
  isShowdown(): boolean {
    return this.gameState.phase === 'showdown';
  }

  /**
   * 全員オールインかチェック（アクティブプレイヤーが0-1）
   */
  isAllInRunout(): boolean {
    const active = this.getActivePlayers();
    const nonFolded = this.gameState.players.filter(
      (p) => p.status !== 'folded' && p.status !== 'busted'
    );
    return active.length <= 1 && nonFolded.length > 1;
  }

  // =============================================
  // トーナメント機能
  // =============================================

  /**
   * トーナメントモードかチェック
   */
  isTournament(): boolean {
    return this.gameState.settings.tournament.enabled && !!this.gameState.tournament;
  }

  /**
   * トーナメントのレベルアップが必要かチェック
   * @returns レベルアップした場合は新しいBlindLevelを返す
   */
  checkTournamentLevelUp(): { newLevel: BlindLevel; nextLevel?: BlindLevel } | null {
    const t = this.gameState.tournament;
    if (!t || t.isPaused) return null;

    const durationMs = this.gameState.settings.tournament.levelDurationMin * 60 * 1000;
    const elapsed = Date.now() - t.levelStartTime;

    if (elapsed < durationMs) return null;

    // 次のレベルに進む
    return this.advanceTournamentLevel();
  }

  /**
   * トーナメントのレベルを1つ進める
   */
  advanceTournamentLevel(): { newLevel: BlindLevel; nextLevel?: BlindLevel } | null {
    const t = this.gameState.tournament;
    if (!t) return null;

    let nextIdx = t.structureIndex + 1;

    // ブレイクをスキップ
    while (nextIdx < BLIND_STRUCTURE.length && BLIND_STRUCTURE[nextIdx].isBreak) {
      nextIdx++;
    }

    if (nextIdx >= BLIND_STRUCTURE.length) return null; // 最終レベル

    const newLevel = BLIND_STRUCTURE[nextIdx];
    t.structureIndex = nextIdx;
    t.currentLevel = newLevel.level;
    t.levelStartTime = Date.now();

    // ゲーム設定に反映
    this.gameState.settings.smallBlind = newLevel.sb;
    this.gameState.settings.bigBlind = newLevel.bb;
    this.gameState.settings.ante = newLevel.ante;

    // 次のレベルを取得
    let nextNextIdx = nextIdx + 1;
    while (nextNextIdx < BLIND_STRUCTURE.length && BLIND_STRUCTURE[nextNextIdx].isBreak) {
      nextNextIdx++;
    }
    const nextLevel = nextNextIdx < BLIND_STRUCTURE.length ? BLIND_STRUCTURE[nextNextIdx] : undefined;

    return { newLevel, nextLevel };
  }

  /**
   * トーナメントを一時停止
   */
  pauseTournament(): TournamentState | null {
    const t = this.gameState.tournament;
    if (!t || t.isPaused) return null;

    const durationMs = this.gameState.settings.tournament.levelDurationMin * 60 * 1000;
    t.pausedTimeRemaining = Math.max(0, durationMs - (Date.now() - t.levelStartTime));
    t.isPaused = true;

    return { ...t };
  }

  /**
   * トーナメントを再開
   */
  resumeTournament(): TournamentState | null {
    const t = this.gameState.tournament;
    if (!t || !t.isPaused) return null;

    t.levelStartTime = Date.now() - (this.gameState.settings.tournament.levelDurationMin * 60 * 1000 - t.pausedTimeRemaining);
    t.isPaused = false;
    t.pausedTimeRemaining = 0;

    return { ...t };
  }

  /**
   * 現在のトーナメント状態を取得
   */
  getTournamentState(): TournamentState | undefined {
    return this.gameState.tournament ? { ...this.gameState.tournament } : undefined;
  }

  /**
   * 現在のレベルのBlindLevel情報を取得
   */
  getCurrentBlindLevel(): BlindLevel | null {
    const t = this.gameState.tournament;
    if (!t) return null;
    return BLIND_STRUCTURE[t.structureIndex] || null;
  }

  /**
   * 次のレベルのBlindLevel情報を取得
   */
  getNextBlindLevel(): BlindLevel | null {
    const t = this.gameState.tournament;
    if (!t) return null;
    let nextIdx = t.structureIndex + 1;
    while (nextIdx < BLIND_STRUCTURE.length && BLIND_STRUCTURE[nextIdx].isBreak) {
      nextIdx++;
    }
    return nextIdx < BLIND_STRUCTURE.length ? BLIND_STRUCTURE[nextIdx] : null;
  }
}
