import { useState, useEffect, useRef } from 'react';
import watchlistService from '../../services/watchlistService';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const WatchlistMarker = ({ stock, onUpdate }) => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [groups, setGroups] = useState([]);
    const [watchedItems, setWatchedItems] = useState([]); // Items where this stock exists
    const [showMenu, setShowMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const menuRef = useRef(null);

    useEffect(() => {
        if (isAuthenticated && stock?.id) {
            checkStatus();
        }
    }, [isAuthenticated, stock?.id]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const checkStatus = async () => {
        try {
            const items = await watchlistService.checkStockStatus(stock.id);
            setWatchedItems(items);
        } catch (err) {
            console.error("Failed to check watchlist status", err);
        }
    };

    const fetchGroups = async () => {
        try {
            const data = await watchlistService.getGroups();
            setGroups(data);
        } catch (err) {
            console.error("Failed to fetch groups", err);
        }
    };

    const handleClick = async (e) => {
        e.stopPropagation();
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        await fetchGroups();
        setShowMenu(!showMenu);
        setError('');
    };

    const handleToggleGroup = async (groupId) => {
        setLoading(true);
        setError('');
        try {
            const existingItem = watchedItems.find(item => item.group === groupId);

            if (existingItem) {
                // Remove from this group
                await watchlistService.removeItem(existingItem.id);
                setWatchedItems(watchedItems.filter(item => item.id !== existingItem.id));
            } else {
                // Add to this group
                const newItem = await watchlistService.addItem(groupId, stock.id);
                setWatchedItems([...watchedItems, newItem]);
            }
            if (onUpdate) onUpdate();
        } catch (err) {
            if (err.response?.status === 400) {
                setError('Already in this watchlist or limit reached');
            } else {
                setError('Failed to update');
            }
        } finally {
            setLoading(false);
        }
    };

    const isInAnyWatchlist = watchedItems.length > 0;
    const isInGroup = (groupId) => watchedItems.some(item => item.group === groupId);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={handleClick}
                disabled={loading}
                className={`p-1 rounded-full transition-all ${loading ? 'opacity-50' : ''} ${isInAnyWatchlist
                        ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                title={isInAnyWatchlist ? "In Watchlist" : "Add to Watchlist"}
            >
                {isInAnyWatchlist ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                )}
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
                <div className="absolute z-50 left-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Add to Watchlist</p>
                    </div>
                    {error && (
                        <div className="px-3 py-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20">{error}</div>
                    )}
                    {groups.length === 0 ? (
                        <div className="p-4 text-center">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No watchlists yet</p>
                            <button
                                onClick={(e) => { e.stopPropagation(); navigate('/dashboard'); setShowMenu(false); }}
                                className="text-blue-600 text-sm font-bold"
                            >
                                Create on Dashboard →
                            </button>
                        </div>
                    ) : (
                        <div className="max-h-48 overflow-y-auto">
                            {groups.map((group) => (
                                <button
                                    key={group.id}
                                    onClick={(e) => { e.stopPropagation(); handleToggleGroup(group.id); }}
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{group.name}</span>
                                    {isInGroup(group.id) ? (
                                        <span className="text-green-500 text-lg">✓</span>
                                    ) : (
                                        <span className="text-gray-300 text-lg">+</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WatchlistMarker;
