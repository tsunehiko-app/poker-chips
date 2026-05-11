import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import type { GameSettings } from '../../../shared/types';
import { DEFAULT_SETTINGS } from '../../../shared/types';

// チッププリセット → 自動的に100BBになるブラインド設定
const chipConfigs: { chips: number; sb: number; bb: number; ante: number }[] = [
  { chips: 100,  sb: 1,  bb: 2,   ante: 0 },
  { chips: 200,  sb: 1,  bb: 2,   ante: 0 },
  { chips: 300,  sb: 1,  bb: 3,   ante: 0 },
  { chips: 400,  sb: 2,  bb: 4,   ante: 0 },
  { chips: 500,  sb: 2,  bb: 5,   ante: 0 },
  { chips: 1000, sb: 5,  bb: 10,  ante: 0 },
];

function CreateRoom() {
  const navigate = useNavigate();
  const [hostName, setHostName] = useState('');
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [useAnte, setUseAnte] = useState(false);

  const handleCreate = () => {
    if (!hostName.trim()) {
      setError('名前を入力してください');
      return;
    }
    setIsLoading(true);
    setError('');

    socket.emit('room:create', { hostName: hostName.trim(), settings });

    const onCreated = (data: { roomCode: string; playerId: string }) => {
      sessionStorage.setItem('playerId', data.playerId);
      sessionStorage.setItem('roomCode', data.roomCode);
      sessionStorage.setItem('isHost', 'true');
      cleanup();
      navigate(`/lobby/${data.roomCode}`);
    };

    const onError = (data: { message: string }) => {
      setError(data.message);
      setIsLoading(false);
      cleanup();
    };

    function cleanup() {
      socket.off('room:created', onCreated);
      socket.off('error', onError);
    }

    socket.on('room:created', onCreated);
    socket.on('error', onError);
  };

  const selectChipConfig = (config: typeof chipConfigs[0]) => {
    const ante = useAnte ? config.bb : 0;
    setSettings({
      ...settings,
      initialChips: config.chips,
      smallBlind: config.sb,
      bigBlind: config.bb,
      ante,
    });
  };

  const toggleAnte = () => {
    const next = !useAnte;
    setUseAnte(next);
    setSettings({
      ...settings,
      ante: next ? settings.bigBlind : 0,
    });
  };

  // 現在選択中のconfigを探す
  const currentConfig = chipConfigs.find((c) => c.chips === settings.initialChips);

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          &#8592; 戻る
        </button>
        <h1 className="page-title">ルームを作成</h1>
      </div>

      <div className="card">
        <div className="form-group">
          <label className="form-label">あなたの名前</label>
          <input
            type="text"
            className="form-input"
            placeholder="名前を入力"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            maxLength={12}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">ゲーム設定</h2>

        {/* 初期チップ選択 */}
        <div className="form-group">
          <label className="form-label">初期チップ</label>
          <div className="chip-config-grid">
            {chipConfigs.map((config) => (
              <button
                key={config.chips}
                className={`chip-config-btn ${settings.initialChips === config.chips ? 'active' : ''}`}
                onClick={() => selectChipConfig(config)}
              >
                <span className="chip-config-amount">{config.chips.toLocaleString()}</span>
                <span className="chip-config-blind">{config.sb}/{config.bb}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 設定サマリ */}
        <div className="settings-summary">
          <div className="summary-item">
            <span className="summary-label">ブラインド</span>
            <span className="summary-value">{settings.smallBlind} / {settings.bigBlind}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">スタック</span>
            <span className="summary-value">{Math.floor(settings.initialChips / settings.bigBlind)} BB</span>
          </div>
        </div>

        {/* アンティ */}
        <div className="ante-toggle">
          <span className="ante-label">アンティ</span>
          <button
            className={`toggle-btn ${useAnte ? 'on' : 'off'}`}
            onClick={toggleAnte}
          >
            <span className="toggle-knob" />
          </button>
          {useAnte && (
            <span className="ante-amount">{settings.ante}</span>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        className="btn btn-primary btn-large btn-full"
        onClick={handleCreate}
        disabled={isLoading || !hostName.trim()}
      >
        {isLoading ? '作成中...' : 'ルームを作成'}
      </button>
    </div>
  );
}

export default CreateRoom;
