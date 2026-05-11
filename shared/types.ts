// =============================================
// ポーカーチップ管理アプリ — 共有型定義
// サーバーとクライアントの両方で使用
// =============================================

// --- ゲームの基本型 ---

export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export type PlayerStatus = 'active' | 'folded' | 'allin' | 'busted' | 'sitting_out';

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

// --- ゲーム設定 ---

export interface GameSettings {
  initialChips: number;
  smallBlind: number;
  bigBlind: number;
  turnTimeLimit: number; // 0 = 無制限
}

export const DEFAULT_SETTINGS: GameSettings = {
  initialChips: 1000,
  smallBlind: 10,
  bigBlind: 20,
  turnTimeLimit: 0,
};

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
  'game:selectWinner': (data: { roomCode: string; winnerIds: string[] }) => void;
  'game:nextHand': (data: { roomCode: string }) => void;
  'game:rebuy': (data: { roomCode: string }) => void;
  'game:pause': (data: { roomCode: string }) => void;
  'game:resume': (data: { roomCode: string }) => void;
  'game:end': (data: { roomCode: string }) => void;
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
  'game:showdown': (data: { gameState: GameState }) => void;
  'game:handResult': (data: { result: HandResult; gameState: GameState }) => void;
  'game:playerBusted': (data: { playerId: string; playerName: string }) => void;
  'game:playerRebuyed': (data: { playerId: string; playerName: string; rebuyCount: number; chips: number }) => void;
  'game:paused': () => void;
  'game:resumed': () => void;
  'game:ended': (data: { results: FinalResult[] }) => void;
  'error': (data: { message: string }) => void;
}
