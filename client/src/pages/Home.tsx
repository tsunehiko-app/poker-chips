import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="page home-page">
      <div className="home-hero">
        <div className="home-logo">
          <span className="home-logo-icon">&#9827;</span>
          <h1 className="home-title">Poker Chips</h1>
          <p className="home-subtitle">カードは本物、チップはスマホ</p>
        </div>

        <div className="home-buttons">
          <button
            className="btn btn-primary btn-large"
            onClick={() => navigate('/create')}
          >
            <span className="btn-icon">+</span>
            ルームを作成
          </button>
          <button
            className="btn btn-secondary btn-large"
            onClick={() => navigate('/join')}
          >
            <span className="btn-icon">&#8594;</span>
            ルームに参加
          </button>
        </div>
      </div>

      <div className="home-footer">
        <p className="home-footer-text">
          友達とリアルカードでポーカーを楽しもう
        </p>
      </div>
    </div>
  );
}

export default Home;
