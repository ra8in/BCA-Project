import React, { useState, useEffect, useContext, useRef } from 'react';
import { MarketContext } from '../../context/MarketContext';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { calculatorService } from '../../services/calculatorService';
import { portfolioService } from '../../services/portfolioService';
import { stockService } from '../../services/stockService';
import watchlistService from '../../services/watchlistService';
import StockSearchInput from '../../components/common/StockSearchInput';
import WatchlistMarker from '../../components/common/WatchlistMarker';

// Debounce Hook (reused or imported)
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
};

const Trading = () => {
    const location = useLocation();
    const { symbol: routeSymbol } = useParams();
    const navigate = useNavigate();


    // State
    const [mode, setMode] = useState('buy'); // 'buy' or 'sell' (default 'buy')
    const [order, setOrder] = useState({
        symbol: '',
        qty: '',
        price: '',
        type: 'market', // 'market' or 'limit'
    });
    const [selectedStockData, setSelectedStockData] = useState(null);

    const [holdings, setHoldings] = useState([]);
    const [cashBalance, setCashBalance] = useState(0);
    const { updateSector, updateStock } = useContext(MarketContext);

    // Order History State
    const [activeOrders, setActiveOrders] = useState([]);
    const [pastOrders, setPastOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [ordersTab, setOrdersTab] = useState('active'); // 'active' or 'history'

    // Market Depth State
    const [marketDepth, setMarketDepth] = useState(null);

    // Filtering State
    const [filterType, setFilterType] = useState('all'); // 'all', 'buy', 'sell'
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'executed', 'pending', 'cancelled'
    const [activePage, setActivePage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);
    const pageSize = 10;

    // Watchlist State
    const [wlGroups, setWlGroups] = useState([]);
    const [wlSelectedGroup, setWlSelectedGroup] = useState(null);
    const [wlItems, setWlItems] = useState([]);
    const [wlLoading, setWlLoading] = useState(false);

    // Watchlist Search State
    const [wlShowSearch, setWlShowSearch] = useState(false);
    const [wlSearchQuery, setWlSearchQuery] = useState('');
    const [wlSearchResults, setWlSearchResults] = useState([]);
    const [wlSearchLoading, setWlSearchLoading] = useState(false);
    const wlSearchRef = useRef(null);

    // Derived Filtered Orders
    const getFilteredOrders = (orders) => {
        return orders.filter(o => {
            const matchesType = filterType === 'all' || o.order_type.toLowerCase() === filterType;
            const matchesStatus = filterStatus === 'all' || o.status.toLowerCase() === filterStatus;
            return matchesType && matchesStatus;
        });
    };

    const displayedOrders = getFilteredOrders(ordersTab === 'active' ? activeOrders : pastOrders);

    // Reset pages when filters or tab change
    useEffect(() => {
        setActivePage(1);
        setHistoryPage(1);
    }, [filterType, filterStatus, ordersTab]);

    const currentPage = ordersTab === 'active' ? activePage : historyPage;
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedOrders = displayedOrders.slice(startIndex, startIndex + pageSize);
    const totalPages = Math.ceil(displayedOrders.length / pageSize);

    const handlePageChange = (newPage) => {
        if (ordersTab === 'active') {
            setActivePage(newPage);
        } else {
            setHistoryPage(newPage);
        }
    };
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [holdingsData, portfolioData] = await Promise.all([
                    portfolioService.getHoldings(),
                    portfolioService.getPortfolio()
                ]);
                setHoldings(holdingsData);
                if (portfolioData?.cash_balance != null) {
                    setCashBalance(parseFloat(portfolioData.cash_balance));
                }
            } catch (err) {
                console.error("Failed to fetch initial data", err);
            }
        };
        fetchInitialData();
        fetchOrders();
        fetchWatchlistGroups();
    }, []);

    // Watchlist Fetch Logic
    const fetchWatchlistGroups = async () => {
        setWlLoading(true);
        try {
            const data = await watchlistService.getGroups();
            setWlGroups(data);
            if (data.length > 0) {
                setWlSelectedGroup(data[0]);
                fetchWatchlistItems(data[0].id);
            }
        } catch (err) {
            console.error("Failed to fetch watchlist groups", err);
        } finally {
            setWlLoading(false);
        }
    };

    const fetchWatchlistItems = async (groupId) => {
        try {
            const data = await watchlistService.getItems(groupId);
            setWlItems(data);
        } catch (err) {
            console.error("Failed to fetch watchlist items", err);
        }
    };

    // Watchlist Add/Remove/Search
    const wlHandleSearch = async (query) => {
        setWlSearchQuery(query);
        if (query.length < 2) { setWlSearchResults([]); return; }
        setWlSearchLoading(true);
        try {
            const results = await stockService.search(query);
            setWlSearchResults(results);
        } catch (err) { console.error("Search failed", err); }
        finally { setWlSearchLoading(false); }
    };

    const wlHandleAdd = async (stock) => {
        if (!wlSelectedGroup) return;
        try {
            await watchlistService.addItem(wlSelectedGroup.id, stock.id);
            fetchWatchlistItems(wlSelectedGroup.id);
            setWlSearchQuery('');
            setWlSearchResults([]);
            setWlShowSearch(false);
        } catch (err) {
            console.error("Failed to add stock", err);
        }
    };

    const wlHandleRemove = async (e, itemId) => {
        e.stopPropagation();
        try {
            await watchlistService.removeItem(itemId);
            setWlItems(prev => prev.filter(i => i.id !== itemId));
        } catch (err) {
            console.error("Failed to remove item", err);
        }
    };

    // Close watchlist search on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (wlSearchRef.current && !wlSearchRef.current.contains(e.target)) {
                setWlShowSearch(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Fetch Orders
    const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
            const active = await portfolioService.getOrders('active');
            const history = await portfolioService.getOrders('history');
            setActiveOrders(active);
            setPastOrders(history);
        } catch (err) {
            console.error("Failed to fetch orders", err);
        } finally {
            setLoadingOrders(false);
        }
    };

    // Update Global Sector & Stock Context
    useEffect(() => {
        if (selectedStockData) {
            if (selectedStockData.sector_name) {
                updateSector(selectedStockData.sector_name);
            }
            updateStock(selectedStockData);
        } else {
            updateSector(null);
            updateStock(null);
        }
        return () => {
            updateSector(null);
            updateStock(null);
        };
    }, [selectedStockData, updateSector, updateStock]);

    // Get available quantity for current symbol
    const availableQty = React.useMemo(() => {
        if (!order.symbol) return 0;
        const holding = holdings.find(h => h.stock_symbol === order.symbol);
        return holding ? holding.quantity : 0;
    }, [order.symbol, holdings]);



    // Calculation State
    const [calcResult, setCalcResult] = useState(null);
    const [calcLoading, setCalcLoading] = useState(false);

    const [showConfirm, setShowConfirm] = useState(false);

    const [editingOrder, setEditingOrder] = useState(null);
    const [isMarketOpen, setIsMarketOpen] = useState(false);

    // Market Status Check (Clock-Aligned)
    useEffect(() => {
        const fetchMarketStatus = async () => {
            try {
                const status = await stockService.getMarketStatus();
                setIsMarketOpen(status?.is_open || false);
            } catch (err) {
                console.error("Failed to fetch market status", err);
            }
        };

        fetchMarketStatus();

        // Align check to the minute (at :01 seconds)
        let timeoutId;

        const scheduleNextCheck = () => {
            const now = new Date();
            // Wait until next minute exactly (HH:MM:00)
            const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

            timeoutId = setTimeout(() => {
                fetchMarketStatus();
                scheduleNextCheck();
            }, msUntilNextMinute);
        };

        scheduleNextCheck();

        return () => { if (timeoutId) clearTimeout(timeoutId); };
    }, []);

    // Toast notification
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 5000);
    };

    // Initial Load - Check for navigation state
    // Initial Load - Check for navigation state OR random stock
    useEffect(() => {
        const init = async () => {
            if (routeSymbol) {
                // 1. URL Param Selection (Highest Priority)
                try {
                    const stockDetails = await stockService.getDetail(routeSymbol);
                    setSelectedStockData(stockDetails);
                    setOrder(prev => ({ ...prev, symbol: stockDetails.symbol, price: stockDetails.last_price }));

                    // Also handle incoming state if mode is passed (e.g. from Buy button elsewhere)
                    if (location.state?.mode) {
                        setMode(location.state.mode);
                    }
                } catch (err) {
                    console.log("Could not fetch stock details from URL", err);
                    showToast("Stock not found", "error");
                }
            } else if (location.state?.symbol) {
                // 1.5. Check Navigation State (If coming from Market/Portfolio with a symbol but no route param yet)
                // This fixes the issue where clicking "Trade" redirected to a random stock instead of the selected one
                navigate(`/trading/${location.state.symbol}`, { state: location.state, replace: true });
            } else {
                // 2. Root Route (/trading) -> Redirect to Random Stock
                try {
                    const response = await stockService.getAllStocks();
                    const allStocks = Array.isArray(response) ? response : (response.results || []);

                    if (allStocks && allStocks.length > 0) {
                        const randomStock = allStocks[Math.floor(Math.random() * allStocks.length)];
                        // Redirect to the distinct URL
                        navigate(`/trading/${randomStock.symbol}`, { replace: true });
                    }
                } catch (e) {
                    console.log("Failed to load random stock", e);
                }
            }
        };
        init();
    }, [routeSymbol, navigate, location.state]);
    // Market Depth Polling
    useEffect(() => {
        let depthInterval;

        const fetchDepth = async () => {
            if (!routeSymbol) return;
            try {
                const data = await stockService.getMarketDepth(routeSymbol);
                if (data && !data.error) {
                    setMarketDepth(data);
                } else if (data && data.error) {
                    // Handle market closed or not found
                    setMarketDepth(null);
                }
            } catch (err) {
                console.error("Failed to fetch market depth for trading", err);
            }
        };

        if (routeSymbol) {
            // Fetch immediately
            fetchDepth();

            // Poll every 5s if market is open
            if (isMarketOpen) {
                depthInterval = setInterval(fetchDepth, 5000);
            }
        } else {
            setMarketDepth(null);
        }

        return () => {
            if (depthInterval) clearInterval(depthInterval);
        };
    }, [routeSymbol, isMarketOpen]);



    // Handle Real-time Cost Calculation
    // Debounce primitives to avoid object reference loop
    const debouncedQty = useDebounce(order.qty, 500);
    const debouncedPrice = useDebounce(order.price, 500);
    // Mode doesn't need strict debounce as it changes rarely, but we can include it in effect

    useEffect(() => {
        const calculate = async () => {
            // Only calculate if we have valid inputs
            if (!mode || !debouncedQty || !debouncedPrice || debouncedQty <= 0) {
                setCalcResult(null);
                setCalcLoading(false);
                return;
            }

            setCalcLoading(true);

            // Safety timeout to prevent infinite loading
            const timeoutId = setTimeout(() => {
                setCalcLoading(false);
            }, 5000);

            try {
                const payload = {
                    mode: mode,
                    qty: parseInt(debouncedQty),
                    price: parseFloat(debouncedPrice),
                    is_wacc_entry: false,
                    purchase_price: 0,
                    investor_type: 'individual',
                    holding_period: 'short'
                };

                const res = await calculatorService.calculateBuySell(payload);
                clearTimeout(timeoutId); // Clear timeout if successful
                if (res) {
                    setCalcResult(res);
                }
            } catch (err) {
                console.error("Calculation Error", err);
                setCalcResult(null);
            } finally {
                clearTimeout(timeoutId); // Ensure timeout is cleared
                setCalcLoading(false);
            }
        };
        calculate();
    }, [debouncedQty, debouncedPrice, mode]);

    const selectStock = (stock) => {
        navigate(`/trading/${stock.symbol}`);
    };

    // Use real stock price for LTP, fallback to order price only if no stock data (shouldn't happen)
    const LTP = selectedStockData?.last_price ? parseFloat(selectedStockData.last_price) : (order.price ? parseFloat(order.price) : 0);

    // Helper: Calculate Estimated Net Amount (Sync)
    const calculateEstimatedNet = (order) => {
        if (order.net_amount) return parseFloat(order.net_amount);

        const qty = parseInt(order.quantity);
        // Use order price if set, otherwise use LTP from market data if available (for Market orders estimation)
        // Note: For history table, 'selectedStockData' might be unrelated stock. 
        // Ideally we should use LTP from the order object if backend provided it, or just use order price.
        // If order.price is null (Market), we can't easily estimate without fetching LTP for that specific stock.
        // BUT, for Pending Limit orders, price is set. For Pending Market, it's 0 usually?
        // Let's stick to using order.price. If 0/null, return 0 or show '-'
        const price = order.price ? parseFloat(order.price) : 0;

        if (!qty || !price) return 0;

        const amount = price * qty;
        const commission = Math.max(10, amount * 0.004);
        const sebon = amount * 0.00015;
        const dp = 25;

        const totalFees = commission + sebon + dp;

        if (order.order_type === 'BUY') {
            return amount + totalFees;
        } else {
            // For Pending Sells, we show Net Receivable BEFORE CGT 
            return amount - totalFees;
        }
    };

    const updateOrder = (field, value) => {
        setOrder(prev => {
            const newOrder = { ...prev, [field]: value };
            return newOrder;
        });
    };

    const handleModeSelect = (selectedMode) => {
        if (mode === selectedMode) {
            setMode(null);
            setCalcResult(null);
        } else {
            setMode(selectedMode);
        }
    };

    const handleCancelOrder = async (orderToCancel) => {
        if (!window.confirm("Are you sure you want to cancel this order?")) return;

        try {
            const result = await portfolioService.cancelOrder(orderToCancel.id);
            showToast(result.message, 'success');
            fetchOrders();
        } catch (error) {
            console.error("Cancel Failed:", error);
            showToast(error.response?.data?.error || "Failed to cancel order", 'error');
        }
    };

    const handleEditOrder = async (orderToEdit) => {
        // Just populate form and set editing state
        setMode(orderToEdit.order_type.toLowerCase());
        setOrder({
            symbol: orderToEdit.stock_symbol,
            qty: orderToEdit.quantity,
            price: orderToEdit.price ? parseFloat(orderToEdit.price) : '',
            type: parseFloat(orderToEdit.price) > 0 ? 'limit' : 'market'
        });
        setEditingOrder(orderToEdit);

        // Fetch and set stock data for the edit
        try {
            const stockDetails = await stockService.getDetail(orderToEdit.stock_symbol);
            setSelectedStockData(stockDetails);
        } catch (e) {
            console.error("Failed to fetch stock details for edit", e);
            // Non-blocking, just toast
            showToast("Warning: Could not load latest market data", 'orange');
        }

        showToast("Edit mode: Update details and click 'Update Order'", 'info');
    };

    const handleConfirm = async () => {
        setShowConfirm(false);
        setCalcLoading(true);
        let result = null;

        try {
            // Ensure type is correct based on price presence (safety check)
            const finalType = order.price && parseFloat(order.price) > 0 ? 'LIMIT' : 'MARKET';

            if (editingOrder) {
                // UPDATE Existing Order Logic
                result = await portfolioService.updateOrder(editingOrder.id, {
                    quantity: order.qty,
                    price: order.price,
                    type: finalType
                });
                showToast(result.message, 'success');
                if (result.new_balance) {
                    showToast(`New Balance: Rs. ${result.new_balance.toLocaleString()}`, 'success');
                }
            } else {
                // NEW Order Logic
                if (mode === 'buy') {
                    result = await portfolioService.buyStock(order.symbol, order.qty, finalType, order.price);
                } else if (mode === 'sell') {
                    result = await portfolioService.sellStock(order.symbol, order.qty, finalType, order.price);
                }
                showToast(`${result.message} | New Balance: Rs. ${result.new_balance.toLocaleString()}`, 'success');
            }

            console.log("Transaction Result:", result);

            // Update balance from API response
            if (result?.new_balance != null) {
                setCashBalance(result.new_balance);
            }

            // Refresh Data
            fetchOrders();
            const holdingsData = await portfolioService.getHoldings();
            setHoldings(holdingsData);

            // Reset Form (Partially)
            setOrder(prev => ({ ...prev, qty: '', price: prev.type === 'market' ? prev.price : '' }));
            setCalcResult(null);
            setEditingOrder(null); // Clear editing state

        } catch (error) {
            console.error("Transaction Failed:", error);
            const errorMsg = error.response?.data?.error || "Transaction failed. Please try again.";
            showToast(errorMsg, 'error');
            // If edit failed, we might want to keep editing mode? 
            // For now, let's keep editingOrder set so user can retry.
            // setEditingOrder(null); 
        } finally {
            setCalcLoading(false);
        }
    };



    return (
        <div className="max-w-7xl mx-auto px-4 py-8 relative">
            {/* Toast Notification */}
            {toast.show && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg font-bold text-sm animate-in fade-in slide-in-from-right-4 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                    }`}>
                    {toast.message}
                </div>
            )}


            <h2 className="text-3xl font-black mb-8 text-gray-800 dark:text-gray-100 tracking-tight">Trading Center</h2>
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-6 items-start mb-8">
                {/* LEFT COLUMN: Main Broker Card */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                    {/* Header Phase */}
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Place Order</h2>
                            <span className={`text-[10px] font-bold uppercase ${isMarketOpen ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'} px-2 py-0.5 rounded-full flex items-center gap-1.5`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                                {isMarketOpen ? 'Live' : 'Closed'}
                            </span>
                        </div>

                        {/* Trade Toggle Capsule */}
                        <div className="flex relative bg-gray-100 dark:bg-gray-900 rounded-full p-1 w-24 border border-gray-200 dark:border-gray-700">
                            {/* Slider background */}
                            <div
                                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-300 z-0 shadow-sm ${!mode ? 'opacity-0' : 'opacity-100'
                                    } ${mode === 'sell' ? 'translate-x-[calc(100%+4px)] bg-red-500' : 'translate-x-0 bg-blue-600'
                                    }`}
                            ></div>

                            <button
                                onClick={() => handleModeSelect('buy')}
                                className={`flex-1 relative z-10 py-1 text-xs font-bold transition-colors ${mode === 'buy' ? 'text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                BUY
                            </button>
                            <button
                                onClick={() => handleModeSelect('sell')}
                                className={`flex-1 relative z-10 py-1 text-xs font-bold transition-colors ${mode === 'sell' ? 'text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                SELL
                            </button>
                        </div>
                    </div>

                    {/* Form & Actions Phase */}
                    <div className="p-4">
                        <div className="animate-in fade-in slide-in-from-top-2">
                            {/* Row 1: Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-[2fr_1.2fr_1.2fr] gap-3 mb-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Scrip</label>
                                    <div className="relative">
                                        <StockSearchInput
                                            placeholder="Type Scrip & Enter"
                                            initialValue={order.symbol}
                                            onSelect={selectStock}
                                            className="!py-1.5 !px-3"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-gray-400 uppercase flex justify-between">
                                        Quantity
                                        {mode === 'sell' && order.symbol && (
                                            <span
                                                className="text-blue-500 cursor-pointer hover:underline"
                                                onClick={() => updateOrder('qty', availableQty)}
                                            >
                                                Max: {availableQty}
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="number"
                                        value={order.qty}
                                        onChange={(e) => updateOrder('qty', e.target.value)}
                                        placeholder="0"
                                        className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors placeholder-gray-400"
                                    />
                                    {mode === 'sell' && order.qty > availableQty && (
                                        <span className="text-[10px] text-red-500 font-bold absolute -bottom-4">Exceeds available</span>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1.5 md:col-span-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Price</label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="number"
                                            value={order.price}
                                            onChange={(e) => updateOrder('price', e.target.value)}
                                            disabled={order.type === 'market'}
                                            placeholder="Price"
                                            className={`flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none transition-colors placeholder-gray-400 ${order.type === 'market' ? 'opacity-50 cursor-not-allowed' : 'focus:border-blue-500'}`}
                                        />
                                        <div className="flex flex-col gap-1.5 shrink-0">
                                            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="orderType"
                                                    className="hidden peer"
                                                    checked={order.type === 'limit'}
                                                    onChange={() => updateOrder('type', 'limit')}
                                                />
                                                <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center peer-checked:border-blue-500 after:content-[''] after:w-1.5 after:h-1.5 after:bg-blue-500 after:rounded-full after:scale-0 peer-checked:after:scale-100 after:transition-transform transition-colors"></div>
                                                LMT
                                            </label>
                                            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="orderType"
                                                    className="hidden peer"
                                                    checked={order.type === 'market'}
                                                    onChange={() => {
                                                        updateOrder('type', 'market');
                                                        updateOrder('price', '');
                                                    }}
                                                />
                                                <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center peer-checked:border-blue-500 after:content-[''] after:w-1.5 after:h-1.5 after:bg-blue-500 after:rounded-full after:scale-0 peer-checked:after:scale-100 after:transition-transform transition-colors"></div>
                                                MKT
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Action Row */}
                            <div className="flex flex-col md:flex-row items-center justify-end pb-4 border-b border-gray-100 dark:border-gray-700 gap-3 mb-4">

                                {/* Info Blocks */}
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{mode === 'sell' ? 'Net Receivable' : 'Total Payable'}</span>
                                        <strong className="text-sm text-gray-900 dark:text-white font-black">
                                            {calcResult ? `Rs. ${mode === 'sell' ? parseFloat(calcResult.net_receivable).toLocaleString() : parseFloat(calcResult.total_cost).toLocaleString()}` : '0.00'}
                                        </strong>
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Avail. Balance</span>
                                        <strong className="text-sm text-green-600 dark:text-green-400 font-black">
                                            Rs. {cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </strong>
                                    </div>
                                    <div className="flex flex-col items-center gap-1 hidden sm:flex">
                                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">LTP</span>
                                        <strong className="text-sm text-gray-900 dark:text-white font-black">
                                            {LTP ? `Rs. ${LTP.toLocaleString()}` : '---'}
                                        </strong>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowConfirm(true)}
                                        disabled={calcLoading || !order.symbol || !order.qty || (!order.price && order.type === 'limit') || (mode === 'sell' && order.qty > availableQty) || !mode}
                                        className={`w-32 py-2 rounded-xl font-bold text-sm text-white shadow-lg transition-transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'sell' ? 'bg-red-500 shadow-red-500/20' : mode === 'buy' ? 'bg-blue-600 shadow-blue-600/20' : 'bg-gray-400 dark:bg-gray-700 shadow-none text-gray-600 dark:text-gray-300'}`}
                                    >
                                        {calcLoading ? 'CALCULATING...' : mode ? mode.toUpperCase() : 'SELECT ACTION'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setOrder({ symbol: '', qty: '', price: '', type: 'market' });
                                            setMode('buy');
                                        }}
                                        className="px-6 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        RESET
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Row 3: Market Depth & Info */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Top 5 Buy Table */}
                            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col">
                                <div className="py-1.5 text-center text-[10px] font-black uppercase text-blue-600 bg-blue-50 dark:bg-blue-900/20 tracking-wider">
                                    Top 5 Buy
                                </div>
                                {order.symbol && isMarketOpen && marketDepth?.marketDepth?.buyMarketDepthList ? (
                                    <table className="w-full text-[11px]">
                                        <thead>
                                            <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400">
                                                <th className="py-1.5 px-3 text-left font-bold">Orders</th>
                                                <th className="py-1.5 text-right font-bold">Qty</th>
                                                <th className="py-1.5 px-3 text-right font-bold">Price</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {marketDepth.marketDepth.buyMarketDepthList.map((row, i) => (
                                                <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={() => { setOrder({ ...order, price: row.orderBookOrderPrice || 0 }); setMode('buy'); }}>
                                                    <td className="py-1.5 px-3 text-left font-bold text-blue-600">{row.orderCount ?? '-'}</td>
                                                    <td className="py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">{row.quantity ?? '-'}</td>
                                                    <td className="py-1.5 px-3 text-right font-medium text-gray-900 dark:text-white">{row.orderBookOrderPrice != null ? row.orderBookOrderPrice.toFixed(2) : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-50 dark:bg-gray-800 font-bold border-t border-gray-200 dark:border-gray-700 text-blue-600">
                                                <td className="py-1.5 px-3 text-left">Total Qty</td>
                                                <td colSpan="2" className="py-1.5 px-3 text-right">
                                                    {marketDepth.marketDepth.buyMarketDepthList.reduce((acc, row) => acc + (row.quantity || 0), 0)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-[10px] font-bold text-gray-400 p-8">No Data</div>
                                )}
                            </div>

                            {/* Top 5 Sell Table */}
                            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col">
                                <div className="py-1.5 text-center text-[10px] font-black uppercase text-red-500 bg-red-50 dark:bg-red-900/10 tracking-wider">
                                    Top 5 Sell
                                </div>
                                {order.symbol && isMarketOpen && marketDepth?.marketDepth?.sellMarketDepthList ? (
                                    <table className="w-full text-[11px]">
                                        <thead>
                                            <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400">
                                                <th className="py-1.5 px-3 text-left font-bold">Price</th>
                                                <th className="py-1.5 text-right font-bold">Qty</th>
                                                <th className="py-1.5 px-3 text-right font-bold">Orders</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {marketDepth.marketDepth.sellMarketDepthList.map((row, i) => (
                                                <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={() => { setOrder({ ...order, price: row.orderBookOrderPrice || 0 }); setMode('sell'); }}>
                                                    <td className="py-1.5 px-3 text-left font-medium text-gray-900 dark:text-white">{row.orderBookOrderPrice != null ? row.orderBookOrderPrice.toFixed(2) : '-'}</td>
                                                    <td className="py-1.5 text-right font-medium text-gray-600 dark:text-gray-300">{row.quantity ?? '-'}</td>
                                                    <td className="py-1.5 px-3 text-right font-bold text-red-500">{row.orderCount ?? '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-50 dark:bg-gray-800 font-bold border-t border-gray-200 dark:border-gray-700 text-red-500">
                                                <td className="py-1.5 px-3 text-left">Total Qty</td>
                                                <td colSpan="2" className="py-1.5 px-3 text-right">
                                                    {marketDepth.marketDepth.sellMarketDepthList.reduce((acc, row) => acc + (row.quantity || 0), 0)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-[10px] font-bold text-gray-400 p-8">No Data</div>
                                )}
                            </div>

                            {/* Stock Information List */}
                            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col">
                                <div className="py-1.5 text-center text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 tracking-wider">
                                    Stock Information
                                </div>
                                {order.symbol && selectedStockData ? (
                                    <ul className="flex flex-col flex-1 pb-1">
                                        {[
                                            { label: 'D.High', value: selectedStockData.high_price },
                                            { label: 'D.Low', value: selectedStockData.low_price },
                                            { label: 'P.Close', value: selectedStockData.previous_close },
                                            { label: 'Volume', value: selectedStockData.total_trade_quantity?.toLocaleString() },
                                            { label: 'Turnover', value: selectedStockData.total_trade_value ? `Rs. ${(selectedStockData.total_trade_value / 1000000).toFixed(1)}M` : '-' },
                                        ].map((item, idx) => (
                                            <li key={idx} className={`flex justify-between items-center px-4 py-2 text-xs border-b border-gray-100 dark:border-gray-700 last:border-0`}>
                                                <span className="text-gray-500 font-bold">{item.label}</span>
                                                <strong className="text-gray-900 dark:text-white font-black">{item.value || '-'}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-[10px] font-bold text-gray-400 p-8">No Data</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Watchlist */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden sticky top-24">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <i className="fas fa-list text-blue-500"></i> Watchlist
                        </h2>
                        {wlSelectedGroup && (
                            <div className="relative" ref={wlSearchRef}>
                                <button
                                    onClick={() => { setWlShowSearch(!wlShowSearch); if (!wlShowSearch) setTimeout(() => document.getElementById('wl-trading-search')?.focus(), 100); }}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                >
                                    <i className="fas fa-plus text-[8px]"></i> Add
                                </button>
                                {wlShowSearch && (
                                    <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                                        <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                                            <input
                                                id="wl-trading-search"
                                                type="text"
                                                value={wlSearchQuery}
                                                onChange={(e) => wlHandleSearch(e.target.value)}
                                                placeholder="Search symbol..."
                                                className="w-full px-3 py-1.5 bg-gray-100 dark:bg-gray-900 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                                                autoComplete="off"
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            {wlSearchLoading ? (
                                                <div className="p-3 text-center text-[10px] text-gray-400">Searching...</div>
                                            ) : wlSearchQuery.length < 2 ? (
                                                <div className="p-3 text-center text-[10px] text-gray-400">Type 2+ chars</div>
                                            ) : wlSearchResults.length === 0 ? (
                                                <div className="p-3 text-center text-[10px] text-gray-400">No results</div>
                                            ) : (
                                                wlSearchResults.map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => wlHandleAdd(s)}
                                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700/50 last:border-0 flex justify-between items-center group"
                                                    >
                                                        <div>
                                                            <span className="block font-bold text-gray-800 dark:text-white text-xs">{s.symbol}</span>
                                                            <span className="block text-[10px] text-gray-500 truncate max-w-[120px]">{s.name}</span>
                                                        </div>
                                                        <span className="text-blue-600 opacity-0 group-hover:opacity-100 text-[10px] font-bold">+ ADD</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Group Tabs */}
                    {wlGroups.length > 1 && (
                        <div className="flex gap-1 p-2 overflow-x-auto border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/20">
                            {wlGroups.map((group) => (
                                <button
                                    key={group.id}
                                    onClick={() => { setWlSelectedGroup(group); fetchWatchlistItems(group.id); }}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${wlSelectedGroup?.id === group.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {group.name}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col">
                        {wlLoading ? (
                            <div className="p-6 text-center text-xs text-gray-400">Loading...</div>
                        ) : wlGroups.length === 0 ? (
                            <div className="p-6 text-center">
                                <p className="text-xs text-gray-400">No watchlists yet.</p>
                                <p className="text-[10px] text-gray-400 mt-1">Create one from the Dashboard.</p>
                            </div>
                        ) : wlItems.length === 0 ? (
                            <div className="p-6 text-center">
                                <p className="text-xs text-gray-400">No stocks in "{wlSelectedGroup?.name}"</p>
                            </div>
                        ) : (
                            wlItems.map((item) => {
                                const stock = item.stock_details;
                                if (!stock) return null;
                                const changePct = parseFloat(stock.change_percent || 0);
                                return (
                                    <div
                                        key={item.id}
                                        className="flex justify-between items-center p-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-colors last:border-b-0 group"
                                        onClick={() => selectStock({ symbol: stock.symbol })}
                                    >
                                        <div className="flex flex-col">
                                            <strong className="text-sm font-bold text-gray-900 dark:text-white">{stock.symbol}</strong>
                                            <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{stock.name}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <strong className="text-sm font-bold text-gray-900 dark:text-white">{parseFloat(stock.last_price || 0).toLocaleString()}</strong>
                                            <span className={`text-[10px] font-bold ${changePct > 0 ? 'text-green-500' : changePct < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                                {changePct > 0 ? '+' : ''}{changePct.toFixed(2)}%
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => wlHandleRemove(e, item.id)}
                                            className="ml-1 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                            title="Remove"
                                        >
                                            <i className="fas fa-times text-[10px]"></i>
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* ORDERS SECTION */}
            <div className="lg:col-span-12 mt-12 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="flex border-b border-gray-100 dark:border-gray-700">
                    <button
                        onClick={() => setOrdersTab('active')}
                        className={`px-8 py-4 font-bold text-sm uppercase tracking-wider transition-colors ${ordersTab === 'active'
                            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                    >
                        Active Orders ({activeOrders.length})
                    </button>
                    <button
                        onClick={() => setOrdersTab('history')}
                        className={`px-8 py-4 font-bold text-sm uppercase tracking-wider transition-colors ${ordersTab === 'history'
                            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                    >
                        Order History
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs font-bold text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">
                                <th className="pb-4 pl-4 pt-4">Date</th>
                                <th className="pb-4 pt-4">
                                    <select
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value)}
                                        className="bg-transparent uppercase font-bold outline-none cursor-pointer hover:text-blue-500 tracking-wider"
                                        style={{ appearance: 'none' }} // Optional: minimalist style
                                    >
                                        <option value="all">Type</option>
                                        <option value="buy">BUY</option>
                                        <option value="sell">SELL</option>
                                    </select>
                                    {/* Optional: Add a small icon if desired, or rely on hover */}
                                    <span className="ml-1 text-[10px]">▼</span>
                                </th>
                                <th className="pb-4 pt-4">Stock</th>
                                <th className="pb-4 text-right pt-4">Qty</th>
                                <th className="pb-4 text-right pt-4">Price</th>
                                <th className="pb-4 text-right pt-4">Net Amt</th>
                                <th className="pb-4 text-right pt-4">
                                    {ordersTab === 'history' ? (
                                        <div className="flex justify-end items-center gap-1">
                                            <select
                                                value={filterStatus}
                                                onChange={(e) => setFilterStatus(e.target.value)}
                                                className="bg-transparent uppercase font-bold outline-none cursor-pointer hover:text-blue-500 text-right tracking-wider"
                                                style={{ appearance: 'none', textAlignLast: 'right' }}
                                            >
                                                <option value="all">Status</option>
                                                <option value="executed">EXECUTED</option>
                                                <option value="cancelled">CANCELLED</option>
                                            </select>
                                            <span className="text-[10px]">▼</span>
                                        </div>
                                    ) : (
                                        'Status'
                                    )}
                                </th>
                                {ordersTab === 'active' && <th className="pb-4 text-right pt-4 pr-4">Action</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loadingOrders ? (
                                <tr>
                                    <td colSpan="8" className="text-center py-8 text-gray-400">
                                        Loading orders...
                                    </td>
                                </tr>
                            ) : paginatedOrders.length > 0 ? (
                                paginatedOrders.map((o) => (
                                    <tr key={o.id} className="border-b border-dashed border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                        <td className="py-4 pl-4 text-sm font-medium text-gray-500">
                                            {new Date(o.created_at).toLocaleString()}
                                        </td>
                                        <td className="py-4">
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${o.order_type === 'BUY'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                {o.order_type}
                                            </span>
                                        </td>
                                        <td className="py-4 font-bold text-gray-800 dark:text-white">{o.stock_symbol}</td>
                                        <td className="py-4 text-right font-medium text-gray-600 dark:text-gray-300">{o.quantity}</td>
                                        <td className="py-4 text-right font-bold text-gray-800 dark:text-white">
                                            Rs. {o.price ? parseFloat(o.price).toLocaleString() : 'MKT'}
                                        </td>
                                        <td className="py-4 text-right font-medium text-gray-600 dark:text-gray-300">
                                            Rs. {(calculateEstimatedNet(o) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-4 text-right">
                                            <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${o.status === 'EXECUTED' ? 'bg-blue-100 text-blue-600' :
                                                o.status === 'PENDING' ? 'bg-yellow-100 text-yellow-600' :
                                                    o.status === 'CANCELLED' ? 'bg-gray-100 text-gray-600' :
                                                        'bg-red-100 text-red-600'
                                                }`}>
                                                {o.status}
                                            </span>
                                        </td>
                                        {ordersTab === 'active' && (
                                            <td className="py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditOrder(o)}
                                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelOrder(o)}
                                                        className="text-xs font-bold text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="py-8 text-center text-gray-400 italic">
                                        No {ordersTab} orders found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-sm text-gray-500 font-medium">
                            Showing <span className="font-bold dark:text-gray-300">{startIndex + 1}</span> to <span className="font-bold dark:text-gray-300">{Math.min(startIndex + pageSize, displayedOrders.length)}</span> of <span className="font-bold dark:text-gray-300">{displayedOrders.length}</span> results
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${currentPage === 1
                                    ? 'text-gray-300 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
                                    : 'text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50'
                                    }`}
                            >
                                Previous
                            </button>
                            <div className="flex items-center gap-1 px-2">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => handlePageChange(p)}
                                        className={`w-8 h-8 text-xs font-bold rounded-lg transition-all ${currentPage === p
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${currentPage === totalPages
                                    ? 'text-gray-300 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
                                    : 'text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50'
                                    }`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {
                showConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-gray-100 dark:border-gray-700 transform transition-all scale-100">
                            <h3 className="text-xl font-black mb-4 dark:text-white">Confirm Order</h3>

                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl space-y-3 mb-6">
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">Action</span>
                                    <span className={`font-bold uppercase ${mode === 'buy' ? 'text-green-500' : 'text-red-500'}`}>{mode}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">Stock</span>
                                    <span className="font-bold dark:text-white">{order.symbol}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">Quantity</span>
                                    <span className="font-bold dark:text-white">{order.qty}</span>
                                </div>
                                {calcResult && (
                                    <>
                                        <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                                            <span className="text-gray-500 text-sm">Commission</span>
                                            <span className="font-bold dark:text-gray-300">Rs. {calcResult.commission}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500 text-sm">SEBON/DP</span>
                                            <span className="font-bold dark:text-gray-300">Rs. {(parseFloat(calcResult.sebon_fee) + parseFloat(calcResult.dp_fee)).toFixed(2)}</span>
                                        </div>
                                        <div className="pt-2 mt-1 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                                            <span className="text-gray-800 dark:text-white font-bold text-sm">Net Amount</span>
                                            <span className="font-black text-blue-600 dark:text-blue-400">Rs. {
                                                mode === 'buy'
                                                    ? parseFloat(calcResult.total_cost).toLocaleString()
                                                    : parseFloat(calcResult.net_receivable).toLocaleString()
                                            }</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className={`py-3 rounded-xl font-bold text-white transition-colors ${mode === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                                        }`}
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Trading;
