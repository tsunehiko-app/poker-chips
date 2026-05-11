interface PlayerListItem {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
}

interface PlayerListProps {
  players: PlayerListItem[];
}

function PlayerList({ players }: PlayerListProps) {
  return (
    <div className="player-list">
      {players.map((player) => (
        <div
          key={player.id}
          className={`player-list-item ${!player.isConnected ? 'player-disconnected' : ''}`}
        >
          <div className="player-list-info">
            <span className="player-list-name">
              {player.name}
              {player.isHost && <span className="host-badge">HOST</span>}
            </span>
          </div>
          <span
            className={`connection-dot ${
              player.isConnected ? 'dot-connected' : 'dot-disconnected'
            }`}
          ></span>
        </div>
      ))}

      {players.length === 0 && (
        <p className="player-list-empty">まだ誰も参加していません</p>
      )}
    </div>
  );
}

export default PlayerList;
