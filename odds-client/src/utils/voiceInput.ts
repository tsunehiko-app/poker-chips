// 音声認識によるカード入力ユーティリティ

type CardResult = { rank: string; suit: string } | null;

// 日本語のカード名称マッピング
const RANK_MAP: Record<string, string> = {
  'エース': 'A', 'えーす': 'A', 'いち': 'A', '1': 'A',
  'に': '2', '2': '2', 'つー': '2',
  'さん': '3', '3': '3', 'すりー': '3',
  'よん': '4', 'し': '4', '4': '4', 'ふぉー': '4',
  'ご': '5', '5': '5', 'ふぁいぶ': '5',
  'ろく': '6', '6': '6', 'しっくす': '6',
  'なな': '7', 'しち': '7', '7': '7', 'せぶん': '7',
  'はち': '8', '8': '8', 'えいと': '8',
  'きゅう': '9', 'く': '9', '9': '9', 'ないん': '9',
  'じゅう': 'T', '10': 'T', 'てん': 'T',
  'じゃっく': 'J', 'じぇー': 'J',
  'くいーん': 'Q', 'くぃーん': 'Q',
  'きんぐ': 'K', 'けー': 'K',
};

const SUIT_MAP: Record<string, string> = {
  'はーと': 'h', 'ハート': 'h',
  'だいや': 'd', 'ダイヤ': 'd', 'だいやもんど': 'd',
  'くらぶ': 'c', 'クラブ': 'c',
  'すぺーど': 's', 'スペード': 's',
};

export function parseVoiceInput(text: string): CardResult {
  const normalized = text.toLowerCase().trim();

  let foundRank: string | null = null;
  let foundSuit: string | null = null;

  // スートを検索
  for (const [key, value] of Object.entries(SUIT_MAP)) {
    if (normalized.includes(key.toLowerCase())) {
      foundSuit = value;
      break;
    }
  }

  // ランクを検索
  for (const [key, value] of Object.entries(RANK_MAP)) {
    if (normalized.includes(key.toLowerCase())) {
      foundRank = value;
      break;
    }
  }

  if (foundRank && foundSuit) {
    return { rank: foundRank, suit: foundSuit };
  }

  return null;
}

// Web Speech API のラッパー
export class VoiceRecognition {
  private recognition: any;
  private isListening: boolean = false;

  constructor(
    private onResult: (text: string, card: CardResult) => void,
    private onError: (error: string) => void,
    private onStateChange: (listening: boolean) => void,
  ) {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.recognition = null;
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'ja-JP';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      const card = parseVoiceInput(text);
      this.onResult(text, card);
      this.isListening = false;
      this.onStateChange(false);
    };

    this.recognition.onerror = (event: any) => {
      this.onError(event.error === 'no-speech' ? '音声が検出されませんでした' : `エラー: ${event.error}`);
      this.isListening = false;
      this.onStateChange(false);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onStateChange(false);
    };
  }

  get isSupported(): boolean {
    return this.recognition !== null;
  }

  get listening(): boolean {
    return this.isListening;
  }

  start() {
    if (!this.recognition) {
      this.onError('このブラウザは音声認識に対応していません');
      return;
    }
    if (this.isListening) return;

    try {
      this.isListening = true;
      this.onStateChange(true);
      this.recognition.start();
    } catch (e) {
      this.isListening = false;
      this.onStateChange(false);
      this.onError('音声認識の開始に失敗しました');
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      this.onStateChange(false);
    }
  }
}
