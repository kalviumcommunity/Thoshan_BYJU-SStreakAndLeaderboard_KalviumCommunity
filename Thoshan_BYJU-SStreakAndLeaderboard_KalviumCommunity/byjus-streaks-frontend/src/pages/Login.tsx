import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Add authentication logic here
    navigate('/dashboard');
  };

  return (
    <div className="login-container">
      <div className="branding">
        <h1>BYJU'S</h1>
        {/* Placeholder for illustration */}
        <div className="illustration-box"></div> 
      </div>
      
      <h2>Welcome Back 👋</h2>
      <p>Log in to continue your learning streak</p>
      
      <form onSubmit={handleLogin}>
        <div className="input-group">
          <label>Email</label>
          <input type="email" placeholder="you@example.com" required />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input type="password" placeholder="••••••••" required />
          <a href="#" className="forgot-password">Forgot Password?</a>
        </div>
        
        <button type="submit" className="btn-primary">Log In</button>
      </form>
      
      <div className="divider">OR</div>
      
      <button className="btn-google">Continue with Google</button>
      <p>New here? <a href="#">Create Account</a></p>
    </div>
  );
}