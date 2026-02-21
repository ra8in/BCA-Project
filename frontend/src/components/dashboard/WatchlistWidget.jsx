import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import watchlistService from '../../services/watchlistService';
import { stockService } from '../../services/stockService';

const WatchlistWidget = () => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    // Create Group State
    const [newGroupName, setNewGroupName] = useState('');
    const [showCreateInput, setShowCreateInput] = useState(false);
    const [error, setError] = useState('');

    // Search Stock State
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
        if (isAuthenticated) {
            fetchGroups();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (selectedGroup) {
            fetchItems(selectedGroup.id);
        } else {
            setItems([]);
        }
    }, [selectedGroup]);

    // Close search when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowSearch(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const data = await watchlistService.getGroups();
            setGroups(data);
            if (data.length > 0 && !selectedGroup) {
                setSelectedGroup(data[0]);
            }
        } catch (err) {
            console.error("Failed to fetch groups", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchItems = async (groupId) => {
        try {
            const data = await watchlistService.getItems(groupId);
            setItems(data);
        } catch (err) {
            console.error("Failed to fetch items", err);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        setError('');
        try {
            const newGroup = await watchlistService.createGroup(newGroupName.trim());
            setGroups([...groups, newGroup]);
            setSelectedGroup(newGroup);
            setNewGroupName('');
            setShowCreateInput(false);
        } catch (err) {
            if (err.response?.data?.name) {
                setError('A watchlist with this name already exists');
            } else {
                setError('Failed to create watchlist');
            }
        }
    };

    const handleDeleteGroup = async (e, groupId) => {
        e.stopPropagation();
        if (!confirm('Delete this watchlist and all its stocks?')) return;
        try {
            await watchlistService.deleteGroup(groupId);
            const remaining = groups.filter(g => g.id !== groupId);
            setGroups(remaining);
            if (selectedGroup?.id === groupId) {
                setSelectedGroup(remaining.length > 0 ? remaining[0] : null);
            }
        } catch (err) {
            console.error("Failed to delete group", err);
        }
    };

    const handleRemoveItem = async (e, itemId) => {
        e.stopPropagation();
        try {
            await watchlistService.removeItem(itemId);
            setItems(items.filter(item => item.id !== itemId));

            // Update group count locally
            if (selectedGroup) {
                const updatedGroups = groups.map(g =>
                    g.id === selectedGroup.id
                        ? { ...g, items_count: Math.max(0, (g.items_count || 0) - 1) }
                        : g
                );
                setGroups(updatedGroups);
                setSelectedGroup(prev => ({ ...prev, items_count: Math.max(0, (prev.items_count || 0) - 1) }));
            }
        } catch (err) {
            console.error("Failed to remove item", err);
        }
    };

    // Search Logic
    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearchLoading(true);
        try {
            const results = await stockService.search(query);
            setSearchResults(results);
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleAddFromSearch = async (stock) => {
        if (!selectedGroup) return;
        try {
            await watchlistService.addItem(selectedGroup.id, stock.id);
            fetchItems(selectedGroup.id); // Refresh items
            setSearchQuery('');
            setSearchResults([]);
            setShowSearch(false);

            // Update group count locally
            const updatedGroups = groups.map(g =>
                g.id === selectedGroup.id
                    ? { ...g, items_count: (g.items_count || 0) + 1 }
                    : g
            );
            setGroups(updatedGroups);
            setSelectedGroup(prev => ({ ...prev, items_count: (prev.items_count || 0) + 1 }));

        } catch (err) {
            if (err.response?.status === 400) {
                setError('Stock already in watchlist or limit reached');
                setTimeout(() => setError(''), 3000);
            } else {
                console.error("Failed to add item", err);
            }
        }
    };

    if (!isAuthenticated) return null;

    return (
        <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="bg-blue-600 text-white p-2 rounded-lg text-sm">⭐</span>
                    My Watchlists
                </h3>
                <button
                    onClick={() => setShowCreateInput(!showCreateInput)}
                    className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                    <span className="text-xl">+</span> New Watchlist
                </button>
            </div>

            {/* Create Group Input */}
            {showCreateInput && (
                <form onSubmit={handleCreateGroup} className="mb-4 flex gap-2">
                    <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Watchlist name..."
                        className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                    />
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">Create</button>
                    <button type="button" onClick={() => { setShowCreateInput(false); setError(''); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl">Cancel</button>
                </form>
            )}
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            {/* Group Tabs */}
            {groups.length > 0 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {groups.map((group) => (
                        <button
                            key={group.id}
                            onClick={() => setSelectedGroup(group)}
                            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${selectedGroup?.id === group.id
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            {group.name}
                            <span className="ml-2 text-xs opacity-70">({group.items_count})</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Stock List with Search Integration */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden relative min-h-[200px]">

                {/* Search Header inside the card */}
                {selectedGroup && (
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/30">
                        <h4 className="font-bold text-gray-700 dark:text-gray-300">
                            Stocks in <span className="text-blue-600">"{selectedGroup.name}"</span>
                        </h4>

                        <div className="relative" ref={searchRef}>
                            <button
                                onClick={() => { setShowSearch(!showSearch); if (!showSearch) setTimeout(() => document.getElementById('watchlist-search')?.focus(), 100); }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                            >
                                <span>+ Add Stock</span>
                            </button>

                            {/* Search Popover */}
                            {showSearch && (
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                                        <input
                                            id="watchlist-search"
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => handleSearch(e.target.value)}
                                            placeholder="Search symbol (e.g. NABIL)..."
                                            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                                            autoComplete="off"
                                        />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {searchLoading ? (
                                            <div className="p-4 text-center text-xs text-gray-400">Searching...</div>
                                        ) : searchQuery.length < 2 ? (
                                            <div className="p-4 text-center text-xs text-gray-400">Type 2+ chars to search</div>
                                        ) : searchResults.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-gray-400">No stocks found</div>
                                        ) : (
                                            searchResults.map(stock => (
                                                <button
                                                    key={stock.id}
                                                    onClick={() => handleAddFromSearch(stock)}
                                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700/50 last:border-0 flex justify-between items-center group"
                                                >
                                                    <div>
                                                        <span className="block font-bold text-gray-800 dark:text-white text-sm">{stock.symbol}</span>
                                                        <span className="block text-xs text-gray-500 truncate max-w-[150px]">{stock.name}</span>
                                                    </div>
                                                    <span className="text-blue-600 opacity-0 group-hover:opacity-100 text-xs font-bold">+ ADD</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="p-12 text-center text-gray-400">Loading...</div>
                ) : groups.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">📁</span>
                        </div>
                        <h4 className="text-gray-900 dark:text-white font-bold mb-1">No watchlists yet</h4>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Create your first watchlist to start tracking stocks.</p>
                        <button onClick={() => setShowCreateInput(true)} className="text-blue-600 font-bold hover:underline">
                            + Create Watchlist
                        </button>
                    </div>
                ) : !selectedGroup ? (
                    <div className="p-12 text-center text-gray-400">Select a watchlist</div>
                ) : items.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">🔍</span>
                        </div>
                        <h4 className="text-gray-900 dark:text-white font-bold mb-1">No stocks in "{selectedGroup.name}"</h4>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Use the "+ Add Stock" button above to add stocks.</p>
                    </div>
                ) : (
                    <>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Symbol</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Price</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Change</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                {items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-blue-50/30 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group"
                                        onClick={() => navigate(`/stock/${item.stock_details?.symbol}`)}
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-black text-blue-600 dark:text-blue-400">{item.stock_details?.symbol}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                                                {item.stock_details?.name}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-black text-gray-900 dark:text-white">
                                                Rs. {parseFloat(item.stock_details?.last_price || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {(() => {
                                                const changePct = parseFloat(item.stock_details?.change_percent || 0);
                                                let badgeClass = '';
                                                let icon = '';

                                                if (changePct > 0) {
                                                    badgeClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                                                    icon = '↑';
                                                } else if (changePct < 0) {
                                                    badgeClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                                                    icon = '↓';
                                                } else {
                                                    badgeClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                                                    icon = '-';
                                                }

                                                return (
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}>
                                                        {icon} {Math.abs(changePct).toFixed(2)}%
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-3 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigate('/trading', { state: { mode: 'buy', symbol: item.stock_details?.symbol } }); }}
                                                    className="text-xs font-black text-blue-600 hover:text-blue-800 uppercase tracking-tighter"
                                                >
                                                    Trade
                                                </button>
                                                <button
                                                    onClick={(e) => handleRemoveItem(e, item.id)}
                                                    className="text-xs font-black text-red-500 hover:text-red-700 uppercase tracking-tighter"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {/* Delete Group Button */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                            <button
                                onClick={(e) => handleDeleteGroup(e, selectedGroup.id)}
                                className="text-xs font-bold text-red-500 hover:text-red-700"
                            >
                                Delete "{selectedGroup.name}" Watchlist
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default WatchlistWidget;
