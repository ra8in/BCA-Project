import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MarketStatusIndicator from '../common/MarketStatusIndicator';
import logo from '../../assets/sidebar.png';

const NavLink = ({ item, collapsed, location }) => {
    const isActive = location.pathname === item.path ||
        (item.path !== '/' && location.pathname.startsWith(item.path));

    return (
        <Link
            to={item.path}
            title={collapsed ? item.label : ''}
            className={`flex items-center gap-6 px-6 h-12 rounded-xl transition-all font-bold overflow-hidden ${isActive
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`}
        >
            <span className="text-xl w-6 flex items-center justify-center flex-shrink-0 h-full">{item.icon}</span>
            {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
        </Link>
    );
};

const Sidebar = ({ collapsed, onToggle }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, isAuthenticated } = useAuth();

    // Initialise from localStorage; fallback to system preference
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('theme');
        if (saved) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    // Apply .dark class to <html> and persist choice
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // Menu group
    const mainMenuItems = [
        { label: 'Dashboard', path: '/', icon: <i className="fas fa-house"></i> },
        { label: 'Market', path: '/market', icon: <i className="fas fa-compass"></i> },
    ];

    const toolItems = [
        { label: 'Calculators', path: '/calculators', icon: <i className="fas fa-calculator"></i> },
        { label: 'Alerts', path: '/alerts', icon: <i className="fas fa-bell"></i>, protected: true },
    ];

    const protectedItems = [
        { label: 'Trading', path: '/trading', icon: <i className="fas fa-exchange-alt"></i> },
        { label: 'Portfolio', path: '/portfolio', icon: <i className="fas fa-wallet"></i> },
    ];

    return (
        <aside
            className={`${collapsed ? 'w-[72px]' : 'w-64'} bg-white dark:bg-gray-900 text-gray-800 dark:text-white h-screen sticky top-0 left-0 overflow-y-auto flex flex-col shadow-xl border-r border-gray-200 dark:border-gray-800 z-50 transition-all duration-200`}
        >
            {/* Header: Hamburger + Logo */}
            <div className={`flex items-center gap-6 px-6 h-[72px] overflow-hidden border-b border-gray-100 dark:border-gray-800`}>
                <button
                    onClick={onToggle}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full w-6 h-10 flex items-center justify-center transition-all flex-shrink-0"
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <i className="fas fa-bars"></i>
                </button>
                {!collapsed && (
                    <Link to="/" className="flex items-center">
                        <img src={logo} alt="Nepse Paper Trading Logo" className="h-8 object-contain" />
                    </Link>
                )}
            </div>

            <nav className="flex-1 px-0 overflow-x-hidden">
                {/* Main Menu */}
                <ul className="space-y-1">
                    {mainMenuItems.map((item) => (
                        <li key={item.path}>
                            <NavLink item={item} collapsed={collapsed} location={location} />
                        </li>
                    ))}
                    {isAuthenticated && protectedItems.map((item) => (
                        <li key={item.path}>
                            <NavLink item={item} collapsed={collapsed} location={location} />
                        </li>
                    ))}
                </ul>

                <div className="border-t border-gray-200 dark:border-gray-800 my-3"></div>

                {/* Tools */}
                <ul className="space-y-1">
                    {toolItems.map((item) => {
                        if (item.protected && !isAuthenticated) return null;
                        return (
                            <li key={item.path}>
                                <NavLink item={item} collapsed={collapsed} location={location} />
                            </li>
                        );
                    })}
                </ul>

                <div className="border-t border-gray-800 my-3"></div>

                {/* Dark Mode Toggle */}
                <div className="space-y-1">
                    <div
                        className={`flex items-center gap-6 px-6 h-12 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-pointer transition-all overflow-hidden`}
                        onClick={() => setIsDark(!isDark)}
                        title={collapsed ? (isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode') : ''}
                    >
                        <span className="text-xl w-6 flex items-center justify-center flex-shrink-0 h-full">
                            {/* Sun icon in dark mode (click to go light), Moon in light mode (click to go dark) */}
                            <i className={isDark ? 'fas fa-sun text-yellow-400' : 'fas fa-moon text-primary-400'}></i>
                        </span>
                        {!collapsed && (
                            <>
                                <span className="font-bold whitespace-nowrap">
                                    {isDark ? 'Light Mode' : 'Dark Mode'}
                                </span>
                                <label className="ml-auto relative inline-flex items-center cursor-pointer pointer-events-none">
                                    <input type="checkbox" className="sr-only peer" checked={isDark} readOnly />
                                    <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:bg-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                                </label>
                            </>
                        )}
                    </div>

                    {isAuthenticated && (
                        <NavLink item={{ label: 'Settings', path: '/settings', icon: <i className="fas fa-cog"></i> }} collapsed={collapsed} location={location} />
                    )}
                </div>
            </nav>

            {/* Footer */}
            <div className={`py-4 mt-auto border-t border-gray-200 dark:border-gray-800`}>
                <MarketStatusIndicator collapsed={collapsed} />
                {isAuthenticated ? (
                    <button
                        onClick={handleLogout}
                        title={collapsed ? 'Logout' : ''}
                        className={`w-full flex items-center gap-6 px-6 h-12 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-300 transition-all font-bold mt-2 overflow-hidden`}
                    >
                        <span className="text-xl w-6 flex items-center justify-center flex-shrink-0 h-full">
                            <i className="fas fa-sign-out-alt"></i>
                        </span>
                        {!collapsed && <span className="whitespace-nowrap">Logout</span>}
                    </button>
                ) : (
                    <div className="space-y-2 mt-2">
                        <Link
                            to="/login"
                            className={`w-full flex items-center gap-6 px-6 h-12 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold transition-all overflow-hidden`}
                            title={collapsed ? 'Login' : ''}
                        >
                            <span className="text-xl w-6 flex items-center justify-center flex-shrink-0 h-full"><i className="fas fa-lock"></i></span>
                            {!collapsed && <span className="whitespace-nowrap">Login</span>}
                        </Link>
                        <Link
                            to="/register"
                            className={`w-full flex items-center gap-6 px-6 h-12 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white font-bold transition-all overflow-hidden`}
                            title={collapsed ? 'Register' : ''}
                        >
                            <span className="text-xl w-6 flex items-center justify-center flex-shrink-0 h-full"><i className="fas fa-user-plus"></i></span>
                            {!collapsed && <span className="whitespace-nowrap">Register</span>}
                        </Link>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
