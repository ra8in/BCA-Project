import { useState, useRef, useEffect, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MarketContext } from '../../context/MarketContext';
import { portfolioService } from '../../services/portfolioService';
import { useNavigate } from 'react-router-dom';

const Topbar = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const { stocks } = useContext(MarketContext);
    const navigate = useNavigate();

    const [query, setQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [cashBalance, setCashBalance] = useState(null);

    const searchRef = useRef(null);
    const profileRef = useRef(null);

    // Fetch balance when dropdown opens
    useEffect(() => {
        if (showProfileDropdown && isAuthenticated && cashBalance === null) {
            portfolioService.getPortfolio()
                .then(data => {
                    if (data?.cash_balance != null) {
                        setCashBalance(parseFloat(data.cash_balance));
                    }
                })
                .catch(err => console.error('Failed to fetch balance', err));
        }
    }, [showProfileDropdown, isAuthenticated, cashBalance]);

    // Filter stocks based on query, show max 5
    const searchResults = query.trim() === '' ? [] : stocks.filter(stock =>
        (stock.symbol && stock.symbol.toLowerCase().includes(query.toLowerCase())) ||
        (stock.security_name && stock.security_name.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, 5);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsSearchFocused(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setShowProfileDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectStock = (symbol) => {
        setQuery('');
        setIsSearchFocused(false);
        navigate(`/stock/${symbol}`);
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-14 flex items-center px-8 justify-between flex-shrink-0 sticky top-0 z-40">
            <div className="flex-1"></div>

            <div className="flex-[2] flex justify-center px-4">
                <div ref={searchRef} className="relative w-full max-w-[500px] transition-all duration-300 focus-within:max-w-[552px]">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
                        <i className="fas fa-search"></i>
                    </span>
                    <input
                        type="text"
                        placeholder="Search stocks..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        className="w-full bg-white dark:bg-[#1E1E24] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-full py-2 pl-12 pr-4 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-500/10 transition-all text-sm placeholder-gray-500 font-normal"
                    />

                    {/* Search Results Dropdown */}
                    {isSearchFocused && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden z-50">
                            <ul className="py-2">
                                {searchResults.map((stock) => (
                                    <li
                                        key={stock.symbol}
                                        onClick={() => handleSelectStock(stock.symbol)}
                                        className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer flex justify-between items-center transition-colors"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-900 dark:text-white">{stock.symbol}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[300px]">{stock.security_name}</span>
                                        </div>
                                        {stock.last_price && (
                                            <span className="font-bold text-sm text-gray-900 dark:text-white">
                                                Rs {parseFloat(stock.last_price).toFixed(2)}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {isSearchFocused && query.trim() !== '' && searchResults.length === 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 p-4 text-center">
                            <p className="text-sm text-gray-500">No stocks found for "{query}"</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex justify-end">
                <div ref={profileRef} className="relative">
                    {isAuthenticated ? (
                        <div
                            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 py-1 px-2.5 rounded-full transition-all"
                        >
                            <img src={user?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || user?.username || 'User')}&background=C388F7&color=fff`} alt="User Avatar" className="w-8 h-8 rounded-full object-cover" />
                            <span className="font-bold text-sm hidden md:block">{user?.name || user?.username || 'User'}</span>
                            <i className={`fas fa-chevron-down text-gray-500 text-xs hidden md:block ml-1 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`}></i>
                        </div>
                    ) : (
                        <div
                            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 py-1 px-2.5 rounded-full transition-all"
                        >
                            <img src={`https://ui-avatars.com/api/?name=Guest+User&background=C388F7&color=fff`} alt="Guest Avatar" className="w-8 h-8 rounded-full" />
                            <span className="font-bold text-sm hidden md:block">Guest User</span>
                            <i className={`fas fa-chevron-down text-gray-500 text-xs hidden md:block ml-1 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`}></i>
                        </div>
                    )}

                    {/* Profile Dropdown */}
                    {showProfileDropdown && (
                        <div className="absolute top-[calc(100%+8px)] right-0 w-[280px] bg-white dark:bg-[#1E1E24] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:shadow-none z-[1001] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2">
                            <div className="p-5 flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50">
                                <img
                                    src={isAuthenticated ? (user?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || user?.username || 'User')}&background=C388F7&color=fff`) : `https://ui-avatars.com/api/?name=Guest+User&background=C388F7&color=fff`}
                                    alt="User Avatar"
                                    className="w-14 h-14 rounded-full object-cover"
                                />
                                <div className="flex flex-col">
                                    <span className="font-bold text-base text-gray-900 dark:text-white">
                                        {isAuthenticated ? (user?.name || user?.username || 'User') : 'Guest User'}
                                    </span>
                                    {isAuthenticated && <span className="text-xs text-gray-500 dark:text-gray-400">@{user?.username || user?.id}</span>}
                                </div>
                            </div>

                            {isAuthenticated && (
                                <div className="m-3 p-3 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex flex-col text-white shadow-md shadow-primary-900/20">
                                    <span className="text-[10px] uppercase tracking-wider opacity-90 font-semibold mb-1">Total Balance</span>
                                    <span className="text-lg font-bold">
                                        {cashBalance != null ? `Rs. ${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Loading...'}
                                    </span>
                                </div>
                            )}

                            <ul className="p-2 list-none">
                                {isAuthenticated && (
                                    <>
                                        <li>
                                            <a href="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-bold transition-all hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400">
                                                <i className="fas fa-user-circle w-5 text-center text-lg"></i>
                                                <span>My Profile</span>
                                            </a>
                                        </li>
                                        <li>
                                            <a href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-bold transition-all hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400">
                                                <i className="fas fa-cog w-5 text-center text-lg"></i>
                                                <span>Settings</span>
                                            </a>
                                        </li>
                                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1 mx-3"></div>
                                    </>
                                )}

                                <li>
                                    {isAuthenticated ? (
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 text-sm font-bold transition-all hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            <i className="fas fa-sign-out-alt w-5 text-center text-lg"></i>
                                            <span>Logout</span>
                                        </button>
                                    ) : (
                                        <a href="/login" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-500 text-sm font-bold transition-all hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                            <i className="fas fa-sign-in-alt w-5 text-center text-lg"></i>
                                            <span>Login</span>
                                        </a>
                                    )}
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Topbar;
