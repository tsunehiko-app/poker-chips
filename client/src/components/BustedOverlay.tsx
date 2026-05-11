interface BustedOverlayProps {
  rebuyCount: number;
  onRebuy: () => void;
}

function BustedOverlay({ rebuyCount, onRebuy }: BustedOverlayProps) {
  return (
    <div className="busted-overlay">
      <div className="busted-content">
        <div className="busted-text">BUSTED</div>
        <p className="busted-sub">チップがなくなりました</p>
        {rebuyCount > 0 && (
          <p className="busted-rebuy-count">
            リバイ回数: {rebuyCount}回
          </p>
        )}
        <button className="btn btn-primary btn-large" onClick={onRebuy}>
          リバイする
        </button>
        <p className="busted-rebuy-hint">
          初期チップで復帰します
        </p>
      </div>
    </div>
  );
}

export default BustedOverlay;
