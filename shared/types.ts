// =============================================
// ポーカーチップ管理アプリ — 共有型定義
// サーバーとクライアントの両方で使用
// =============================================

// --- ゲームの基本型 ---

export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export type PlayerStatus = 'active' | 'folded' | 'allin' | 'busted' | 'sitting_out';

export type GameMode = 'cash' | 'tournament';

export type StackVariance = 'none' | 'small' | 'large';

// --- プレイヤー ---

export interface Player {
  id: string;
  name: string;
  chips: number;
  currentBet: number;
  totalBet: number;       // このハンドでの合計ベット額（純利益計算用）
  status: PlayerStatus;
  rebuyCount: number;
  isHost: boolean;
  isConnected: boolean;
  seatIndex: number;
}

// --- ポット ---

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface PotState {
  main: number;
  sidePots: SidePot[];
  total: number;
}

// --- トーナメント ブラインドレベル ---

export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
  ante: number;
  isBreak?: boolean;
}

// ストラクチャー（参考: NLH Good Game 500）
// ante = BB
export const BLIND_STRUCTURE: BlindLevel[] = [
  { level: 1,  sb: 100,    bb: 200,     ante: 200 },
  { level: 2,  sb: 200,    bb: 300,     ante: 300 },
  { level: 3,  sb: 200,    bb: 400,     ante: 400 },
  { level: 4,  sb: 300,    bb: 600,     ante: 600 },
  { level: 5,  sb: 400,    bb: 800,     ante: 800 },
  { level: 0,  sb: 0,      bb: 0,       ante: 0, isBreak: true },
  { level: 6,  sb: 500,    bb: 1000,    ante: 1000 },
  { level: 7,  sb: 600,    bb: 1200,    ante: 1200 },
  { level: 8,  sb: 1000,   bb: 1500,    ante: 1500 },
  { level: 9,  sb: 1000,   bb: 2000,    ante: 2000 },
  { level: 10, sb: 1500,   bb: 3000,    ante: 3000 },
  { level: 0,  sb: 0,      bb: 0,       ante: 0, isBreak: true },
  { level: 11, sb: 2000,   bb: 4000,    ante: 4000 },
  { level: 12, sb: 3000,   bb: 6000,    ante: 6000 },
  { level: 13, sb: 4000,   bb: 8000,    ante: 8000 },
  { level: 14, sb: 5000,   bb: 10000,   ante: 10000 },
  { level: 15, sb: 6000,   bb: 12000,   ante: 12000 },
  { level: 16, sb: 10000,  bb: 15000,   ante: 15000 },
  { level: 0,  sb: 0,      bb: 0,       ante: 0, isBreak: true },
  { level: 17, sb: 10000,  bb: 20000,   ante: 20000 },
  { level: 18, sb: 15000,  bb: 30000,   ante: 30000 },
  { level: 19, sb: 20000,  bb: 40000,   ante: 40000 },
  { level: 20, sb: 30000,  bb: 60000,   ante: 60000 },
  { level: 21, sb: 40000,  bb: 80000,   ante: 80000 },
  { level: 22, sb: 50000,  bb: 100000,  ante: 100000 },
  { level: 23, sb: 60000,  bb: 120000,  ante: 120000 },
  { level: 24, sb: 75000,  bb: 150000,  ante: 150000 },
  { level: 25, sb: 100000, bb: 200000,  ante: 200000 },
  { level: 26, sb: 150000, bb: 300000,  ante: 300000 },
  { level: 27, sb: 200000, bb: 400000,  ante: 400000 },
  { level: 28, sb: 300000, bb: 600000,  ante: 600000 },
  { level: 29, sb: 400000, bb: 800000,  ante: 800000 },
  { level: 30, sb: 500000, bb: 1000000, ante: 1000000 },
];

// --- ゲーム設定 ---

export interface TournamentConfig {
  enabled: boolean;
  levelDurationMin: number;  // レベル間隔（分）
  startLevel: number;        // 開始レベル（1-based）
}

export interface GameSettings {
  mode: GameMode;
  initialChips: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;            // 0 = アンティなし
  turnTimeLimit: number;   // 0 = 無制限
  stackVariance: StackVariance; // スタック差
  tournament: TournamentConfig;
}

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'cash',
  initialChips: 1000,
  smallBlind: 10,
  bigBlind: 20,
  ante: 0,
  turnTimeLimit: 0,
  stackVariance: 'none',
  tournament: {
    enabled: false,
    levelDurationMin: 20,
    startLevel: 1,
  },
};

// --- トーナメント状態 ---

export interface TournamentState {
  currentLevel: number;           // 現在のレベル（1-based）
  structureIndex: number;         // BLIND_STRUCTURE配列のインデックス
  levelStartTime: number;         // レベル開始タイムスタンプ(ms)
  isPaused: boolean;
  pausedTimeRemaining: number;    // 一時停止時の残り時間(ms)
}

// --- ゲーム状態 ---

export interface GameState {
  phase: GamePhase;
  players: Player[];
  dealerIndex: number;
  currentPlayerIndex: number;
  pot: PotState;
  currentBet: number;
  handNumber: number;
  settings: GameSettings;
  lastAction?: { playerId: string; action: PlayerAction; amount: number };
  tournament?: TournamentState;
}

// --- ルーム ---

export interface RoomInfo {
  roomCode: string;
  hostName: string;
  players: Pick<Player, 'id' | 'name' | 'isHost' | 'isConnected'>[];
  settings: GameSettings;
  isGameStarted: boolean;
}

// --- 利用可能なアクション ---

export interface AvailableActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaise: number;
  maxRaise: number;
  canAllIn: boolean;
  allInAmount: number;
}

// --- ハンド結果 ---

export interface HandResult {
  winners: { playerId: string; playerName: string; amount: number }[];
  potDistribution: { potIndex: number; amount: number; winnerIds: string[] }[];
  bustedPlayers: { playerId: string; playerName: string }[];
}

// --- ショーダウン用ポット情報 ---

export interface ShowdownPot {
  potIndex: number;
  label: string;          // "メインポット" or "サイドポット1" etc.
  amount: number;
  eligiblePlayerIds: string[];
}

// --- 最終結果 ---

export interface FinalResult {
  playerId: string;
  playerName: string;
  finalChips: number;
  initialChips: number;
  rebuyCount: number;
  totalInvested: number; // initialChips × (1 + rebuyCount)
  profit: number;        // finalChips - totalInvested
  rank: number;
}

// =============================================
// Socket.IO イベント型定義
// =============================================

// クライアント → サーバー
export interface ClientToServerEvents {
  'room:create': (data: { hostName: string; settings: GameSettings }) => void;
  'room:join': (data: { roomCode: string; playerName: string }) => void;
  'room:rejoin': (data: { roomCode: string; playerId: string }) => void;
  'game:start': (data: { roomCode: string; seatOrder?: string[] }) => void;
  'game:action': (data: { roomCode: string; action: PlayerAction; amount?: number }) => void;
  'game:nextRound': (data: { roomCode: string }) => void;
  'game:selectWinner': (data: { roomCode: string; winnerIds: string[]; potWinners?: { potIndex: number; winnerIds: string[] }[] }) => void;
  'game:nextHand': (data: { roomCode: string }) => void;
  'game:rebuy': (data: { roomCode: string }) => void;
  'game:pause': (data: { roomCode: string }) => void;
  'game:resume': (data: { roomCode: string }) => void;
  'game:end': (data: { roomCode: string }) => void;
  'tournament:pause': (data: { roomCode: string }) => void;
  'tournament:resume': (data: { roomCode: string }) => void;
  'tournament:skipLevel': (data: { roomCode: string }) => void;
}

// サーバー → クライアント
export interface ServerToClientEvents {
  'room:created': (data: { roomCode: string; playerId: string }) => void;
  'room:joined': (data: { playerId: string; roomInfo: RoomInfo }) => void;
  'room:playerJoined': (data: { roomInfo: RoomInfo }) => void;
  'room:playerLeft': (data: { roomInfo: RoomInfo }) => void;
  'game:started': (data: { gameState: GameState }) => void;
  'game:stateUpdate': (data: { gameState: GameState }) => void;
  'game:yourTurn': (data: { availableActions: AvailableActions }) => void;
  'game:actionResult': (data: { playerId: string; playerName: string; action: PlayerAction; amount: number }) => void;
  'game:roundEnd': (data: { phase: GamePhase; pot: PotState }) => void;
  'game:showdown': (data: { gameState: GameState; showdownPots?: ShowdownPot[] }) => void;
  'game:handResult': (data: { result: HandResult; gameState: GameState }) => void;
  'game:playerBusted': (data: { playerId: string; playerName: string }) => void;
  'game:playerRebuyed': (data: { playerId: string; playerName: string; rebuyCount: number; chips: number }) => void;
  'game:paused': () => void;
  'game:resumed': () => void;
  'game:ended': (data: { results: FinalResult[] }) => void;
  'tournament:levelUp': (data: { level: BlindLevel; nextLevel?: BlindLevel; tournament: TournamentState }) => void;
  'tournament:paused': (data: { tournament: TournamentState }) => void;
  'tournament:resumed': (data: { tournament: TournamentState }) => void;
  'error': (data: { message: string }) => void;
}
