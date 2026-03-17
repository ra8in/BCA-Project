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
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // Menu group – matches new_frontend order
    const mainMenuItems = [
        { label: 'Dashboard', path: '/', icon: <i className="fas fa-house"></i> },
        { label: 'Market', path: '/market', icon: <i className="fas fa-compass"></i> },
    ];

    // Tools group
    const toolItems = [
        { label: 'Calculators', path: '/calculators', icon: <i className="fas fa-calculator"></i> },
        { label: 'Alerts', path: '/alerts', icon: <i className="fas fa-bell"></i>, protected: true },
    ];

    // Protected items shown between menu and tools
    const protectedItems = [
        { label: 'Trading', path: '/trading', icon: <i className="fas fa-exchange-alt"></i> },
        { label: 'Portfolio', path: '/portfolio', icon: <i className="fas fa-wallet"></i> },
    ];



    return (
        <aside
            className={`${collapsed ? 'w-[72px]' : 'w-64'} bg-gray-900 text-white h-screen sticky top-0 left-0 overflow-y-auto flex flex-col shadow-2xl z-50 transition-all duration-200`}
        >
            {/* Header: Hamburger + Logo */}
            <div className={`flex items-center gap-6 px-6 h-[72px] overflow-hidden`}>
                <button
                    onClick={onToggle}
                    className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-6 h-10 flex items-center justify-center transition-all flex-shrink-0"
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <i className="fas fa-bars"></i>
                </button>
                {!collapsed && (
                    <img src={logo} alt="Nepse Paper Trading Logo" className="h-8 object-contain" />
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

                <div className="border-t border-gray-800 my-3"></div>

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

                {/* Preferences: Dark Mode & Settings */}
                <div className="space-y-1">
                    <div
                        className={`flex items-center gap-6 px-6 h-12 rounded-xl hover:bg-gray-800 text-gray-400 cursor-pointer transition-all overflow-hidden`}
                        onClick={() => setIsDark(!isDark)}
                        title={collapsed ? 'Toggle Dark Mode' : ''}
                    >
                        <span className="text-xl w-6 flex items-center justify-center flex-shrink-0 h-full">
                            <i className="fas fa-moon"></i>
                        </span>
                        {!collapsed && (
                            <>
                                <span className="font-bold whitespace-nowrap">Dark Mode</span>
                                <label className="ml-auto relative inline-flex items-center cursor-pointer pointer-events-none">
                                    <input type="checkbox" className="sr-only peer" checked={isDark} readOnly />
                                    <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:bg-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
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
            <div className={`py-4 mt-auto border-t border-gray-800`}>
                <MarketStatusIndicator collapsed={collapsed} />
                {isAuthenticated ? (
                    <button
                        onClick={handleLogout}
                        title={collapsed ? 'Logout' : ''}
                        className={`w-full flex items-center gap-6 px-6 h-12 rounded-xl text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-all font-bold mt-2 overflow-hidden`}
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
                            className={`w-full flex items-center gap-6 px-6 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all overflow-hidden`}
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
