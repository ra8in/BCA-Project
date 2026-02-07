import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isAuthenticated } = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Redirect if already authenticated
    React.useEffect(() => {
        if (isAuthenticated) {
            const from = location.state?.from?.pathname || '/';
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, navigate, location]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await login(username, password);

        if (result.success) {
            const from = location.state?.from?.pathname || '/';
            navigate(from, { replace: true });
        } else {
            setError(result.error);
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
                <h2 className="text-3xl font-black text-center text-gray-800 dark:text-gray-100 mb-8">Welcome Back</h2>
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">Username or Email</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all dark:text-white"
                            placeholder="Enter username"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all dark:text-white"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-blue-500/30"
                    >
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <p className="mt-8 text-center text-gray-500 text-sm">
                    Don't have an account? <Link to="/register" className="text-blue-500 font-bold hover:underline">Create one</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
