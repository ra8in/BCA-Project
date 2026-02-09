import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MarketStatusIndicator from '../common/MarketStatusIndicator';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, isAuthenticated } = useAuth();

    // Public menu items - visible to everyone
    const publicMenuItems = [
        { label: 'Dashboard', path: '/', icon: '🏠' },
        { label: 'Market', path: '/market', icon: '📊' },
        { label: 'Calculators', path: '/calculators', icon: '🧮' },
    ];

    // Protected menu items - only visible when logged in
    const protectedMenuItems = [
        { label: 'Trading', path: '/trading', icon: '⚡' },
        { label: 'Portfolio', path: '/portfolio', icon: '💼' },
        { label: 'Alerts', path: '/alerts', icon: '🔔' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <aside className="w-64 bg-gray-900 text-white h-screen sticky top-0 left-0 overflow-y-auto flex flex-col shadow-2xl z-50">
            <div className="p-6">
                <h1 className="text-2xl font-black mb-8 text-blue-400 tracking-tight">Paper Trader</h1>
            </div>
            <nav className="flex-1 px-4">
                <ul className="space-y-2">
                    {/* Public Menu Items */}
                    {publicMenuItems.map((item) => (
                        <li key={item.path}>
                            <Link
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${location.pathname === item.path
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`}
                            >
                                <span className="text-xl">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        </li>
                    ))}

                    {/* Protected Menu Items - Only show when logged in */}
                    {isAuthenticated && (
                        <>
                            <li className="pt-4">
                                <p className="px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Account</p>
                            </li>
                            {protectedMenuItems.map((item) => (
                                <li key={item.path}>
                                    <Link
                                        to={item.path}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${location.pathname === item.path
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                            }`}
                                    >
                                        <span className="text-xl">{item.icon}</span>
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </>
                    )}
                </ul>
            </nav>

            {/* Footer - Login/Logout */}
            <div className="p-6 mt-auto border-t border-gray-800">
                {isAuthenticated ? (
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-all font-bold"
                    >
                        <span className="text-xl">🚪</span>
                        <span>Logout</span>
                    </button>
                ) : (
                    <div className="space-y-2">
                        <Link
                            to="/login"
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all"
                        >
                            <span>🔐</span>
                            <span>Login</span>
                        </Link>
                        <Link
                            to="/register"
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white font-bold transition-all"
                        >
                            <span>✨</span>
                            <span>Register</span>
                        </Link>
                    </div>
                )}
                <MarketStatusIndicator />
            </div>
        </aside>
    );
};

export default Sidebar;
