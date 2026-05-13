import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import type { GameSettings, GameMode, StackVariance } from '../../../shared/types';
import { DEFAULT_SETTINGS, BLIND_STRUCTURE } from '../../../shared/types';

// リングゲーム用チッププリセット
const cashConfigs = [
  { chips: 100,  sb: 1,  bb: 2 },
  { chips: 200,  sb: 1,  bb: 2 },
  { chips: 300,  sb: 1,  bb: 3 },
  { chips: 400,  sb: 2,  bb: 4 },
  { chips: 500,  sb: 2,  bb: 5 },
  { chips: 1000, sb: 5,  bb: 10 },
];

// トーナメント用チッププリセット
const tournamentChips = [10000, 15000, 20000, 30000, 50000, 100000];

// レベル時間プリセット（分）— 5分刻み
const durationPresets = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

// ブレイクを除いたレベル一覧
const playableLevels = BLIND_STRUCTURE.filter((l) => !l.isBreak);

function CreateRoom() {
  const navigate = useNavigate();
  const [hostName, setHostName] = useState('');
  const [mode, setMode] = useState<GameMode>('cash');
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [useAnte, setUseAnte] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showStructure, setShowStructure] = useState(false);

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

  // --- リングゲーム ---
  const selectCashConfig = (config: typeof cashConfigs[0]) => {
    const ante = useAnte ? config.bb : 0;
    setSettings({
      ...settings,
      mode: 'cash',
      initialChips: config.chips,
      smallBlind: config.sb,
      bigBlind: config.bb,
      ante,
      tournament: { enabled: false, levelDurationMin: 20, startLevel: 1 },
    });
  };

  const toggleAnte = () => {
    const next = !useAnte;
    setUseAnte(next);
    setSettings({ ...settings, ante: next ? settings.bigBlind : 0 });
  };

  // --- トーナメント ---
  const selectTournamentChips = (chips: number) => {
    const startLevel = settings.tournament.startLevel;
    const lvl = playableLevels.find((l) => l.level === startLevel) || playableLevels[0];
    setSettings({
      ...settings,
      mode: 'tournament',
      initialChips: chips,
      smallBlind: lvl.sb,
      bigBlind: lvl.bb,
      ante: lvl.ante,
      tournament: { ...settings.tournament, enabled: true },
    });
  };

  const selectDuration = (min: number) => {
    setSettings({
      ...settings,
      tournament: { ...settings.tournament, levelDurationMin: min },
    });
  };

  const selectStartLevel = (level: number) => {
    const lvl = playableLevels.find((l) => l.level === level) || playableLevels[0];
    setSettings({
      ...settings,
      smallBlind: lvl.sb,
      bigBlind: lvl.bb,
      ante: lvl.ante,
      tournament: { ...settings.tournament, startLevel: level },
    });
  };

  // --- モード切替 ---
  const switchMode = (newMode: GameMode) => {
    setMode(newMode);
    if (newMode === 'cash') {
      const cfg = cashConfigs.find((c) => c.chips === settings.initialChips) || cashConfigs[0];
      selectCashConfig(cfg);
    } else {
      selectTournamentChips(20000);
      setSettings((prev) => ({
        ...prev,
        mode: 'tournament',
        tournament: { enabled: true, levelDurationMin: 20, startLevel: 1 },
      }));
      // 初期レベルのブラインドを設定
      const lvl = playableLevels[0];
      setSettings((prev) => ({
        ...prev,
        initialChips: 20000,
        smallBlind: lvl.sb,
        bigBlind: lvl.bb,
        ante: lvl.ante,
      }));
    }
  };

  // --- 編集 ---
  const startEdit = (field: string, value: number) => {
    setEditingField(field);
    setEditText(String(value));
  };

  const commitEdit = (field: string, min: number) => {
    const val = Number(editText);
    if (!isNaN(val) && val >= min) {
      const newSettings = { ...settings, [field]: val };
      if (useAnte && field === 'bigBlind') newSettings.ante = val;
      setSettings(newSettings);
    }
    setEditingField(null);
  };

  const startBBDepth = settings.bigBlind > 0 ? Math.floor(settings.initialChips / settings.bigBlind) : 0;

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>&#8592; 戻る</button>
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

      {/* モード選択 */}
      <div className="card">
        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'cash' ? 'active' : ''}`}
            onClick={() => switchMode('cash')}
          >
            リング
          </button>
          <button
            className={`mode-btn ${mode === 'tournament' ? 'active' : ''}`}
            onClick={() => switchMode('tournament')}
          >
            トーナメント
          </button>
        </div>
      </div>

      {/* リングゲーム設定 */}
      {mode === 'cash' && (
        <div className="card">
          <h2 className="card-title">ゲーム設定</h2>

          <div className="form-group">
            <label className="form-label">初期チップ</label>
            <div className="chip-config-grid">
              {cashConfigs.map((config) => (
                <button
                  key={config.chips}
                  className={`chip-config-btn ${settings.initialChips === config.chips ? 'active' : ''}`}
                  onClick={() => selectCashConfig(config)}
                >
                  <span className="chip-config-amount">{config.chips.toLocaleString()}</span>
                  <span className="chip-config-blind">{config.sb}/{config.bb}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="settings-edit-area">
            <div className="edit-field">
              <span className="edit-label">チップ</span>
              {editingField === 'initialChips' ? (
                <input type="number" className="edit-input" value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => commitEdit('initialChips', 10)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  autoFocus inputMode="numeric" />
              ) : (
                <button className="edit-value-btn" onClick={() => startEdit('initialChips', settings.initialChips)}>
                  {settings.initialChips.toLocaleString()}
                </button>
              )}
            </div>
            <div className="edit-field">
              <span className="edit-label">SB</span>
              {editingField === 'smallBlind' ? (
                <input type="number" className="edit-input" value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => commitEdit('smallBlind', 1)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  autoFocus inputMode="numeric" />
              ) : (
                <button className="edit-value-btn" onClick={() => startEdit('smallBlind', settings.smallBlind)}>
                  {settings.smallBlind}
                </button>
              )}
            </div>
            <div className="edit-field">
              <span className="edit-label">BB</span>
              {editingField === 'bigBlind' ? (
                <input type="number" className="edit-input" value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => commitEdit('bigBlind', 1)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  autoFocus inputMode="numeric" />
              ) : (
                <button className="edit-value-btn" onClick={() => startEdit('bigBlind', settings.bigBlind)}>
                  {settings.bigBlind}
                </button>
              )}
            </div>
            <div className="edit-field">
              <span className="edit-label">深さ</span>
              <span className="edit-value-static">{startBBDepth} BB</span>
            </div>
          </div>

          <div className="ante-toggle">
            <span className="ante-label">アンティ (BB)</span>
            <button className={`toggle-btn ${useAnte ? 'on' : 'off'}`} onClick={toggleAnte}>
              <span className="toggle-knob" />
            </button>
            {useAnte && <span className="ante-amount">{settings.ante}</span>}
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">スタック差</label>
            <div className="variance-toggle">
              {([['none', 'なし'], ['small', '少し'], ['large', '大きい']] as [StackVariance, string][]).map(([val, label]) => (
                <button
                  key={val}
                  className={`variance-btn ${settings.stackVariance === val ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, stackVariance: val })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* トーナメント設定 */}
      {mode === 'tournament' && (
        <div className="card">
          <h2 className="card-title">トーナメント設定</h2>

          {/* スタートチップ */}
          <div className="form-group">
            <label className="form-label">初期チップ</label>
            <div className="chip-config-grid">
              {tournamentChips.map((chips) => (
                <button
                  key={chips}
                  className={`chip-config-btn ${settings.initialChips === chips ? 'active' : ''}`}
                  onClick={() => selectTournamentChips(chips)}
                >
                  <span className="chip-config-amount">{chips.toLocaleString()}</span>
                </button>
              ))}
            </div>
            <div className="setting-custom-row" style={{ marginTop: '8px' }}>
              {editingField === 'tournamentChips' ? (
                <input type="number" className="edit-input" style={{ width: '140px' }} value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => {
                    const val = Number(editText);
                    if (!isNaN(val) && val >= 1000) selectTournamentChips(val);
                    setEditingField(null);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  autoFocus inputMode="numeric" />
              ) : (
                <button className="edit-value-btn" style={{ width: '140px' }}
                  onClick={() => { setEditingField('tournamentChips'); setEditText(String(settings.initialChips)); }}>
                  {settings.initialChips.toLocaleString()}
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block' }}>タップで変更</span>
                </button>
              )}
            </div>
          </div>

          {/* レベル時間 */}
          <div className="form-group">
            <label className="form-label">レベル時間</label>
            <div className="chip-config-grid">
              {durationPresets.map((min) => (
                <button
                  key={min}
                  className={`chip-config-btn ${settings.tournament.levelDurationMin === min ? 'active' : ''}`}
                  onClick={() => selectDuration(min)}
                >
                  <span className="chip-config-amount">{min}分</span>
                </button>
              ))}
            </div>
          </div>

          {/* 開始レベル */}
          <div className="form-group">
            <label className="form-label">開始レベル (FT用)</label>
            <div className="start-level-selector">
              <button
                className="level-nav-btn"
                disabled={settings.tournament.startLevel <= 1}
                onClick={() => selectStartLevel(settings.tournament.startLevel - 1)}
              >−</button>
              <div className="level-display">
                <span className="level-number">Lv.{settings.tournament.startLevel}</span>
                <span className="level-blinds">
                  {settings.smallBlind.toLocaleString()}/{settings.bigBlind.toLocaleString()}
                </span>
                <span className="level-depth">{startBBDepth} BB</span>
              </div>
              <button
                className="level-nav-btn"
                disabled={settings.tournament.startLevel >= 30}
                onClick={() => selectStartLevel(settings.tournament.startLevel + 1)}
              >+</button>
            </div>
          </div>

          {/* スタック差 */}
          <div className="form-group">
            <label className="form-label">スタック差</label>
            <div className="variance-toggle">
              {([['none', 'なし'], ['small', '少し'], ['large', '大きい']] as [StackVariance, string][]).map(([val, label]) => (
                <button
                  key={val}
                  className={`variance-btn ${settings.stackVariance === val ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, stackVariance: val })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ストラクチャー表示 */}
          <button
            className="btn btn-small btn-ghost"
            style={{ width: '100%', marginTop: '4px' }}
            onClick={() => setShowStructure(!showStructure)}
          >
            {showStructure ? 'ストラクチャーを閉じる' : 'ストラクチャーを見る'}
          </button>

          {showStructure && (
            <div className="structure-table">
              <table>
                <thead>
                  <tr>
                    <th>Lv</th>
                    <th>SB/BB</th>
                    <th>Ante</th>
                  </tr>
                </thead>
                <tbody>
                  {BLIND_STRUCTURE.map((l, i) => {
                    if (l.isBreak) {
                      return (
                        <tr key={`break-${i}`} className="break-row">
                          <td colSpan={3}>Break</td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={l.level}
                        className={l.level === settings.tournament.startLevel ? 'current-level' : ''}
                      >
                        <td>{l.level}</td>
                        <td>{l.sb.toLocaleString()}/{l.bb.toLocaleString()}</td>
                        <td>{l.ante.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
