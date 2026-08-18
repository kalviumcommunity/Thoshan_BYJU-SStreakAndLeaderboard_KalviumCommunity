import { useNavigate } from 'react-router-dom';

export default function Leaderboard() {
  const navigate = useNavigate();

  return (
    <div className="leaderboard-container">
      <header>
        <button onClick={() => navigate(-1)} className="back-btn">←</button>
        <h2>Leaderboard</h2>
        <p>Last Updated: 2:00 PM</p>
      </header>

      {/* Top 3 Podium */}
      <section className="podium">
        <div className="podium-place second">
          <div className="avatar">Meera</div>
          <div className="rank">#2</div>
        </div>
        <div className="podium-place first">
          <div className="avatar">Aarav</div>
          <div className="rank">#1</div>
        </div>
        <div className="podium-place third">
          <div className="avatar">Chirag</div>
          <div className="rank">#3</div>
        </div>
      </section>

      {/* Leaderboard List */}
      <section className="leaderboard-list">
        <h3>This Week</h3>
        <ul>
          <li className="list-item">
            <span>#4</span>
            <span className="name">Ishaan</span>
            <span className="points">320 pts</span>
          </li>
          <li className="list-item">
            <span>#5</span>
            <span className="name">Priya</span>
            <span className="points">301 pts</span>
          </li>
          {/* Current User Highlight */}
          <li className="list-item current-user">
            <span>#14</span>
            <span className="name">You (Aarav)</span>
            <span className="points">200 pts</span>
          </li>
        </ul>
      </section>
    </div>
  );
}