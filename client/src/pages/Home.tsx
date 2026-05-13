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
        <a
          href="https://x.com/QYxxat/status/2053749302510690377"
          target="_blank"
          rel="noopener noreferrer"
          className="feedback-link"
        >
          <svg className="feedback-x-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          バグ報告・ご要望はこちら
        </a>
      </div>
    </div>
  );
}

export default Home;
