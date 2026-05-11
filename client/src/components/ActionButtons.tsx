import type { AvailableActions, PlayerAction } from '../../../shared/types';

interface ActionButtonsProps {
  availableActions: AvailableActions;
  onAction: (action: PlayerAction, amount?: number) => void;
  onRaise: () => void;
}

function ActionButtons({ availableActions, onAction, onRaise }: ActionButtonsProps) {
  // チェックできる = まだ誰もベットしていない → 「ベット」表記
  // コールできる = 既にベットがある → 「レイズ」表記
  const raiseLabel = availableActions.canCheck ? 'ベット' : 'レイズ';

  return (
    <div className="action-buttons">
      <div className="action-row-top">
        {availableActions.canFold && (
          <button
            className="btn btn-action btn-fold"
            onClick={() => onAction('fold')}
          >
            フォールド
          </button>
        )}

        {availableActions.canCheck && (
          <button
            className="btn btn-action btn-check"
            onClick={() => onAction('check')}
          >
            チェック
          </button>
        )}

        {availableActions.canCall && (
          <button
            className="btn btn-action btn-call"
            onClick={() => onAction('call', availableActions.callAmount)}
          >
            コール
            <span className="action-amount">{availableActions.callAmount}</span>
          </button>
        )}
      </div>

      <div className="action-row-bottom">
        {availableActions.canRaise && (
          <button className="btn btn-action btn-raise" onClick={onRaise}>
            {raiseLabel}
          </button>
        )}

        {availableActions.canAllIn && (
          <button
            className="btn btn-action btn-allin"
            onClick={() => onAction('allin', availableActions.allInAmount)}
          >
            オールイン
            <span className="action-amount">{availableActions.allInAmount}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default ActionButtons;
