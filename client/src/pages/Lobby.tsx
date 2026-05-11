import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../socket';
import QRCodeDisplay from '../components/QRCodeDisplay';
import PlayerList from '../components/PlayerList';
import type { RoomInfo, GameState, GameSettings } from '../../../shared/types';

type LobbyPhase = 'waiting' | 'seating';

function Lobby() {
  const navigate = useNavigate();
  const { roomCode } = useParams<{ roomCode: string }>();
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [error, setError] = useState('');
  const [lobbyPhase, setLobbyPhase] = useState<LobbyPhase>('waiting');
  const [seatOrder, setSeatOrder] = useState<{ id: string; name: string }[]>([]);

  const playerId = sessionStorage.getItem('playerId');
  const isHost = sessionStorage.getItem('isHost') === 'true';

  useEffect(() => {
    if (!playerId || !roomCode) {
      navigate('/');
      return;
    }

    socket.emit('room:rejoin', { roomCode, playerId });

    const onJoined = (data: { playerId: string; roomInfo: RoomInfo }) => {
      setRoomInfo(data.roomInfo);
      setSettings(data.roomInfo.settings);
    };

    const onPlayerJoined = (data: { roomInfo: RoomInfo }) => {
      setRoomInfo(data.roomInfo);
    };

    const onPlayerLeft = (data: { roomInfo: RoomInfo }) => {
      setRoomInfo(data.roomInfo);
    };

    const onGameStarted = (_data: { gameState: GameState }) => {
      navigate(`/game/${roomCode}`);
    };

    const onError = (data: { message: string }) => {
      setError(data.message);
    };

    socket.on('room:joined', onJoined);
    socket.on('room:playerJoined', onPlayerJoined);
    socket.on('room:playerLeft', onPlayerLeft);
    socket.on('game:started', onGameStarted);
    socket.on('error', onError);

    return () => {
      socket.off('room:joined', onJoined);
      socket.off('room:playerJoined', onPlayerJoined);
      socket.off('room:playerLeft', onPlayerLeft);
      socket.off('game:started', onGameStarted);
      socket.off('error', onError);
    };
  }, [roomCode, playerId, navigate]);

  const playerCount = roomInfo?.players.length ?? 0;

  // 「ゲーム開始」ボタン → 3人以上なら席順設定へ、2人ならそのまま開始
  const handleProceedToStart = () => {
    if (playerCount <= 2) {
      socket.emit('game:start', { roomCode: roomCode! });
    } else {
      setSeatOrder([]);
      setLobbyPhase('seating');
    }
  };

  // 席順設定：プレイヤーをタップして追加
  const handleAddToSeat = (id: string, name: string) => {
    if (seatOrder.find((s) => s.id === id)) return; // 既に追加済み
    setSeatOrder((prev) => [...prev, { id, name }]);
  };

  // 席順設定：最後の1人を取り消す
  const handleUndoSeat = () => {
    setSeatOrder((prev) => prev.slice(0, -1));
  };

  // 席順設定：リセット
  const handleResetSeat = () => {
    setSeatOrder([]);
  };

  // 席順確定 → ゲーム開始
  const handleConfirmSeatOrder = () => {
    socket.emit('game:start', {
      roomCode: roomCode!,
      seatOrder: seatOrder.map((s) => s.id),
    });
  };

  const joinUrl = `${window.location.origin}/join/${roomCode}`;

  // 席順設定画面
  if (lobbyPhase === 'seating' && roomInfo) {
    const unseated = roomInfo.players.filter(
      (p) => !seatOrder.find((s) => s.id === p.id)
    );
    const allSeated = seatOrder.length === roomInfo.players.length;

    return (
      <div className="page">
        <div className="page-header">
          <button className="btn-back" onClick={() => setLobbyPhase('waiting')}>
            &#8592; 戻る
          </button>
          <h1 className="page-title">席順を決める</h1>
        </div>

        <div className="card">
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
            自分の左隣の人から時計回りの順番でタップしてください
          </p>

          {/* 確定済みの席順 */}
          <div className="seat-order-list">
            {seatOrder.map((s, idx) => (
              <div key={s.id} className="seat-order-item seat-order-confirmed">
                <span className="seat-order-number">{idx + 1}</span>
                <span className="seat-order-name">{s.name}</span>
                <span className="seat-order-position" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {getPositionPreview(idx, roomInfo.players.length)}
                </span>
              </div>
            ))}

            {/* 次の空きスロット */}
            {!allSeated && (
              <div className="seat-order-item seat-order-empty">
                <span className="seat-order-number">{seatOrder.length + 1}</span>
                <span style={{ color: 'var(--text-muted)' }}>タップして選択...</span>
              </div>
            )}
          </div>
        </div>

        {/* まだ席についていないプレイヤー */}
        {unseated.length > 0 && (
          <div className="card">
            <h2 className="card-title">プレイヤーを選択</h2>
            <div className="seat-pick-grid">
              {unseated.map((p) => (
                <button
                  key={p.id}
                  className="btn btn-secondary seat-pick-btn"
                  onClick={() => handleAddToSeat(p.id, p.name)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          {seatOrder.length > 0 && (
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handleUndoSeat}>
              1つ戻す
            </button>
          )}
          {seatOrder.length > 0 && (
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handleResetSeat}>
              リセット
            </button>
          )}
        </div>

        {allSeated && (
          <button
            className="btn btn-primary btn-large btn-full"
            style={{ marginTop: '16px' }}
            onClick={handleConfirmSeatOrder}
          >
            この席順でゲーム開始
          </button>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }

  // 通常のロビー画面
  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          &#8592; ホーム
        </button>
        <h1 className="page-title">ロビー</h1>
      </div>

      <div className="card room-code-card">
        <p className="room-code-label">ルームコード</p>
        <p className="room-code-display">{roomCode}</p>
      </div>

      <div className="card qr-card">
        <p className="qr-label">QRコードで招待</p>
        <QRCodeDisplay url={joinUrl} />
        <p className="qr-url">{joinUrl}</p>
      </div>

      <div className="card">
        <h2 className="card-title">プレイヤー ({playerCount}人)</h2>
        {roomInfo && (
          <PlayerList
            players={roomInfo.players.map((p) => ({
              id: p.id,
              name: p.name,
              isHost: p.isHost,
              isConnected: p.isConnected,
            }))}
          />
        )}
      </div>

      {isHost && settings && (
        <div className="card">
          <h2 className="card-title">ゲーム設定</h2>
          <div className="settings-display">
            <div className="setting-row">
              <span className="setting-label">初期チップ</span>
              <span className="setting-value">{settings.initialChips}</span>
            </div>
            <div className="setting-row">
              <span className="setting-label">SB / BB</span>
              <span className="setting-value">
                {settings.smallBlind} / {settings.bigBlind}
              </span>
            </div>
            {settings.ante > 0 && (
              <div className="setting-row">
                <span className="setting-label">アンティ</span>
                <span className="setting-value">{settings.ante}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {isHost ? (
        <button
          className="btn btn-primary btn-large btn-full"
          onClick={handleProceedToStart}
          disabled={playerCount < 2}
        >
          {playerCount < 2 ? '2人以上でゲーム開始' : 'ゲーム開始'}
        </button>
      ) : (
        <div className="waiting-message">
          <div className="waiting-spinner"></div>
          <p>ホストがゲームを開始するのを待っています...</p>
        </div>
      )}
    </div>
  );
}

/**
 * 席順設定中にポジションのプレビューを表示
 */
function getPositionPreview(seatIndex: number, totalPlayers: number): string {
  if (totalPlayers === 2) return seatIndex === 0 ? 'D/SB' : 'BB';
  if (totalPlayers === 3) return ['', '', ''][seatIndex] || '';
  if (totalPlayers === 4) return ['', '', '', ''][seatIndex] || '';

  // ポジション名は初回ハンドのディーラー位置が決まってから確定するため
  // ここでは席番号だけ表示
  return `Seat ${seatIndex + 1}`;
}

export default Lobby;
