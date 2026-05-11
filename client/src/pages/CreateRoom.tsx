import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import type { GameSettings } from '../../../shared/types';
import { DEFAULT_SETTINGS } from '../../../shared/types';

function CreateRoom() {
  const navigate = useNavigate();
  const [hostName, setHostName] = useState('');
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

        <div className="form-group">
          <label className="form-label">初期チップ</label>
          <input
            type="number"
            className="form-input"
            value={settings.initialChips}
            onChange={(e) =>
              setSettings({ ...settings, initialChips: Math.max(100, Number(e.target.value)) })
            }
            min={100}
            step={100}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">SB</label>
            <input
              type="number"
              className="form-input"
              value={settings.smallBlind}
              onChange={(e) =>
                setSettings({ ...settings, smallBlind: Math.max(1, Number(e.target.value)) })
              }
              min={1}
            />
          </div>
          <div className="form-group">
            <label className="form-label">BB</label>
            <input
              type="number"
              className="form-input"
              value={settings.bigBlind}
              onChange={(e) =>
                setSettings({ ...settings, bigBlind: Math.max(2, Number(e.target.value)) })
              }
              min={2}
            />
          </div>
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
