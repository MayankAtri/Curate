import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Form fields
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        // Redirect if already logged in
        if (authService.isAuthenticated()) {
            navigate('/feed');
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isLogin) {
                // Login
                await authService.login({ email, password });
                navigate('/feed');
            } else {
                // Register
                if (password.length < 8) {
                    setError('Password must be at least 8 characters');
                    setLoading(false);
                    return;
                }
                await authService.register({ email, username, password });
                navigate('/onboarding');
            }
        } catch (err) {
            const message = err.response?.data?.message || 'Something went wrong. Please try again.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="logo-lg">Curate</div>
                    <p className="auth-subtitle">
                        {isLogin
                            ? 'Welcome back to your personalized feed.'
                            : 'Join to discover stories that matter to you.'}
                    </p>
                </div>

                {error && (
                    <div className="auth-error">
                        {error}
                    </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="form-group">
                            <label>Username</label>
                            <input
                                type="text"
                                placeholder="johndoe"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                minLength={2}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={isLogin ? 1 : 8}
                        />
                        {!isLogin && (
                            <span className="form-hint">At least 8 characters</span>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="auth-submit-btn"
                        disabled={loading}
                    >
                        {loading
                            ? <div className="spinner-sm" />
                            : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button
                            className="toggle-auth-btn"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError('');
                            }}
                        >
                            {isLogin ? 'Sign Up' : 'Log In'}
                        </button>
                    </p>
                </div>
            </div>
        </main>
    );
}

export default LoginPage;
