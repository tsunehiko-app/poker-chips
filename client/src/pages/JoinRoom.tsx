import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../socket';
import type { RoomInfo } from '../../../shared/types';

function JoinRoom() {
  const navigate = useNavigate();
  const { roomCode: urlRoomCode } = useParams<{ roomCode: string }>();
  const [roomCode, setRoomCode] = useState(urlRoomCode?.toUpperCase() || '');
  const [playerName, setPlayerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (urlRoomCode) {
      setRoomCode(urlRoomCode.toUpperCase());
    }
  }, [urlRoomCode]);

  const handleJoin = () => {
    if (!roomCode.trim() || roomCode.length !== 4) {
      setError('4文字のルームコードを入力してください');
      return;
    }
    if (!playerName.trim()) {
      setError('名前を入力してください');
      return;
    }
    setIsLoading(true);
    setError('');

    socket.emit('room:join', {
      roomCode: roomCode.toUpperCase(),
      playerName: playerName.trim(),
    });

    const onJoined = (data: { playerId: string; roomInfo: RoomInfo }) => {
      sessionStorage.setItem('playerId', data.playerId);
      sessionStorage.setItem('roomCode', data.roomInfo.roomCode);
      sessionStorage.setItem('isHost', 'false');
      cleanup();
      navigate(`/lobby/${data.roomInfo.roomCode}`);
    };

    const onError = (data: { message: string }) => {
      setError(data.message);
      setIsLoading(false);
      cleanup();
    };

    function cleanup() {
      socket.off('room:joined', onJoined);
      socket.off('error', onError);
    }

    socket.on('room:joined', onJoined);
    socket.on('error', onError);
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          &#8592; 戻る
        </button>
        <h1 className="page-title">ルームに参加</h1>
      </div>

      <div className="card">
        <div className="form-group">
          <label className="form-label">ルームコード</label>
          <input
            type="text"
            className="form-input room-code-input"
            placeholder="ABCD"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
            maxLength={4}
            autoCapitalize="characters"
          />
        </div>

        <div className="form-group">
          <label className="form-label">あなたの名前</label>
          <input
            type="text"
            className="form-input"
            placeholder="名前を入力"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={12}
          />
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        className="btn btn-primary btn-large btn-full"
        onClick={handleJoin}
        disabled={isLoading || !roomCode.trim() || !playerName.trim()}
      >
        {isLoading ? '参加中...' : '参加する'}
      </button>
    </div>
  );
}

export default JoinRoom;
