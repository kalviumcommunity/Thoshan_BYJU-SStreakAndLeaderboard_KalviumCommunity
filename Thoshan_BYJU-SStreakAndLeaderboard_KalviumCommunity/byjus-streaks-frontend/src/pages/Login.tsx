import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="brand-mark">B</div>
        <p className="eyebrow">BYJU'S LEARNING STREAKS</p>
        <h1>Small steps.<br /><span>Big momentum.</span></h1>
        <p className="hero-copy">Keep your daily rhythm, celebrate every win, and see how far your learning can take you.</p>

        <div className="login-preview" aria-label="Learning streak preview">
          <div className="preview-heading">
            <span>THIS WEEK</span>
            <strong>+24 pts</strong>
          </div>
          <div className="week-dots" aria-hidden="true">
            <span className="active">M</span><span className="active">T</span><span className="active">W</span>
            <span className="active">T</span><span className="active">F</span><span>S</span><span>S</span>
          </div>
          <div className="preview-streak"><span>🔥</span><strong>15 day streak</strong><small>Keep it going</small></div>
        </div>
      </section>

      <section className="login-panel">
        <div className="panel-heading">
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Ready to pick up<br />where you left off?</h2>
          <p>Log in to continue your learning streak.</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" placeholder="you@example.com" autoComplete="email" required />
          </div>
          <div className="input-group">
            <div className="label-row">
              <label htmlFor="password">Password</label>
              <a href="mailto:support@byjus.com">Forgot password?</a>
            </div>
            <div className="password-field">
              <input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" required />
              <button type="button" className="text-button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary full-width">Log in <span aria-hidden="true">→</span></button>
        </form>

        <div className="divider"><span>or continue with</span></div>
        <button type="button" className="btn-google"><span className="google-mark">G</span> Continue with Google</button>
        <p className="signup-prompt">New here? <a href="mailto:support@byjus.com?subject=Create%20account">Create an account</a></p>
      </section>
    </main>
  );
}