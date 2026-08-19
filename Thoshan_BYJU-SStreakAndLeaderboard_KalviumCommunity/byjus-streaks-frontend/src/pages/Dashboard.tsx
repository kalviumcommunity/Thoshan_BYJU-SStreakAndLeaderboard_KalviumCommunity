import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard-container">
      <header>
        <p>Good Morning</p>
        <h2>Aarav 👋</h2>
      </header>

      {/* Stats Overview */}
      <section className="stats-row">
        <div className="stat-card streak">
          <span className="icon">🔥</span>
          <h3>15 Days</h3>
          <p>Daily Streak</p>
        </div>
        <div className="stat-card points">
          <span className="icon">⭐</span>
          <h3>200</h3>
          <p>Weekly Points</p>
        </div>
        {/* The rank card doubles as the shortcut to the full leaderboard. */}
        <div className="stat-card rank" onClick={() => navigate('/leaderboard')} style={{cursor: 'pointer'}}>
          <span className="icon">🏆</span>
          <h3>#14</h3>
          <p>Current Rank</p>
        </div>
      </section>

      {/* Progress Section */}
      <section className="progress-section">
        <div className="progress-header">
          <h3>Today's Progress</h3>
          <span>50%</span>
        </div>
        {/* Progress and task states are static until they are connected to user data. */}
        <div className="progress-bar"><div className="fill" style={{ width: '50%' }}></div></div>
        
        <ul className="task-list">
          <li className="task-item completed">📚 Lesson <span>Done</span></li>
          <li className="task-item pending">📝 Quiz <span>Pending</span></li>
          <li className="task-item pending">📋 Assignment <span>Pending</span></li>
          <li className="task-item pending">🎯 Mock Test <span>Pending</span></li>
        </ul>
      </section>

      <button className="btn-primary full-width">Continue Learning</button>
    </div>
  );
}