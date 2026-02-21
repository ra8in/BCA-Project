import React, { useState, useEffect, useContext } from 'react';
import { MarketContext } from '../../context/MarketContext';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { calculatorService } from '../../services/calculatorService';
import { portfolioService } from '../../services/portfolioService';
import { stockService } from '../../services/stockService';
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
    const [mode, setMode] = useState(null); // 'buy', 'sell', or null (view only)
    const [order, setOrder] = useState({
        symbol: '',
        qty: '',
        price: '',
        type: 'market', // 'market' or 'limit'
    });
    const [selectedStockData, setSelectedStockData] = useState(null);

    const [holdings, setHoldings] = useState([]);
    const { updateSector, updateStock } = useContext(MarketContext);

    // Order History State
    const [activeOrders, setActiveOrders] = useState([]);
    const [pastOrders, setPastOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [ordersTab, setOrdersTab] = useState('active'); // 'active' or 'history'

    // Filtering State
    const [filterType, setFilterType] = useState('all'); // 'all', 'buy', 'sell'
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'executed', 'pending', 'cancelled'
    const [activePage, setActivePage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);
    const pageSize = 10;

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
        const fetchHoldings = async () => {
            try {
                const data = await portfolioService.getHoldings();
                setHoldings(data);
            } catch (err) {
                console.error("Failed to fetch holdings", err);
            }
        };
        fetchHoldings();
        fetchOrders(); // Fetch orders on mount
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
    const [refreshDepthTrigger, setRefreshDepthTrigger] = useState(0);

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

    // Mock Depth based on real LTP
    const buyDepth = React.useMemo(() => Array.from({ length: 5 }, (_, i) => ({
        qty: Math.floor(Math.random() * 500) + 10,
        price: (LTP - ((i + 1) * 0.1)).toFixed(2),
        orders: Math.floor(Math.random() * 5) + 1
    })), [LTP, refreshDepthTrigger]);

    const sellDepth = React.useMemo(() => Array.from({ length: 5 }, (_, i) => ({
        qty: Math.floor(Math.random() * 500) + 10,
        price: (LTP + ((i + 1) * 0.1)).toFixed(2),
        orders: Math.floor(Math.random() * 5) + 1
    })), [LTP, refreshDepthTrigger]);

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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT COLUMN: Market Depth & Info (Always Visible) */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Market Data Card */}
                    <div className="bg-white dark:bg-gray-700 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-600 p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                {selectedStockData && <WatchlistMarker stock={selectedStockData} />}
                                <div>
                                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase">{selectedStockData?.symbol || '---'}</h2>
                                    <p className="text-sm font-bold text-gray-400 dark:text-gray-400 uppercase tracking-tighter">{selectedStockData?.name || ''}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-black text-blue-600 dark:text-blue-400">
                                    {order.symbol ? `Rs. ${parseFloat(selectedStockData?.last_price || 0).toLocaleString()}` : '---'}
                                </p>
                                <p className={`text-sm font-black ${parseFloat(selectedStockData?.change || 0) > 0
                                    ? 'text-green-500'
                                    : parseFloat(selectedStockData?.change || 0) < 0
                                        ? 'text-red-500'
                                        : 'text-blue-500'
                                    }`}>
                                    {order.symbol && selectedStockData?.change !== undefined ? (
                                        `${parseFloat(selectedStockData.change || 0) > 0 ? '+' : ''}${parseFloat(selectedStockData.change || 0).toFixed(2)} (${parseFloat(selectedStockData.change_percent || 0).toFixed(2)}%)`
                                    ) : ''}
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-between items-end border-t border-gray-100 dark:border-gray-600 pt-4 mt-4">
                            <div>
                                <p className="text-gray-400 text-sm font-bold uppercase tracking-tighter">Volume</p>
                                <p className="text-xl font-black dark:text-gray-200">
                                    {order.symbol && selectedStockData ? (selectedStockData.total_trade_quantity?.toLocaleString() || '0') : '---'}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold uppercase mr-2">Lower:</span>
                                        <span className="text-lg font-black text-gray-800 dark:text-white">
                                            {order.symbol && selectedStockData ? selectedStockData.circuit_low : '---'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold uppercase mr-2">Upper:</span>
                                        <span className="text-lg font-black text-gray-800 dark:text-white">
                                            {order.symbol && selectedStockData ? selectedStockData.circuit_high : '---'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Market Depth Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold text-gray-700 dark:text-gray-300">Market Depth</h3>
                                {isMarketOpen ? (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-[10px] font-bold uppercase animate-pulse">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                        LIVE
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full uppercase">CLOSED</span>
                                )}
                            </div>
                            <button
                                onClick={() => setRefreshDepthTrigger(prev => prev + 1)}
                                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500"
                                title="Refresh Depth"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        </div>
                        {!isMarketOpen ? (
                            <div className="p-6 text-center text-gray-400 dark:text-gray-500 text-sm font-bold">
                                Market Closed, Depth unavailable
                            </div>
                        ) : order.symbol ? (
                            <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-700">
                                {/* BUY SIDE */}
                                <div>
                                    <div className="grid grid-cols-3 gap-2 p-2 px-4 text-xs font-bold text-gray-400 uppercase border-b dark:border-gray-700">
                                        <span>Orders</span>
                                        <span className="text-right">Qty</span>
                                        <span className="text-right">Bid</span>
                                    </div>
                                    {buyDepth.map((row, i) => (
                                        <div key={i} className="grid grid-cols-3 gap-2 p-2 px-4 text-sm font-medium border-b border-dashed border-gray-100 dark:border-gray-800 last:border-0 hover:bg-blue-50 dark:hover:bg-blue-900/10">
                                            <span className="text-blue-500 font-bold">{row.orders}</span>
                                            <span className="text-gray-600 dark:text-gray-300 text-right">{row.qty}</span>
                                            <span className="text-green-600 dark:text-green-400 font-bold text-right">{row.price}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* SELL SIDE */}
                                <div>
                                    <div className="grid grid-cols-3 gap-2 p-2 px-4 text-xs font-bold text-gray-400 uppercase border-b dark:border-gray-700">
                                        <span className="text-right">Ask</span>
                                        <span className="text-right">Qty</span>
                                        <span className="text-right">Orders</span>
                                    </div>
                                    {sellDepth.map((row, i) => (
                                        <div key={i} className="grid grid-cols-3 gap-2 p-2 px-4 text-sm font-medium border-b border-dashed border-gray-100 dark:border-gray-800 last:border-0 hover:bg-red-50 dark:hover:bg-red-900/10">
                                            <span className="text-red-500 font-bold text-right">{row.price}</span>
                                            <span className="text-gray-600 dark:text-gray-300 text-right">{row.qty}</span>
                                            <span className="text-blue-500 font-bold text-right">{row.orders}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-400">
                                <p className="mb-2">Select a stock to view market depth</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Action & Forms */}
                <div className="lg:col-span-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 sticky top-24">

                        {/* 1. Mode Selection */}
                        <div className="p-4 grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleModeSelect('buy')}
                                className={`py-4 rounded-2xl font-black text-lg transition-all transform hover:scale-[1.02] ${mode === 'buy'
                                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                    : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400'
                                    }`}
                            >
                                BUY
                            </button>
                            <button
                                onClick={() => handleModeSelect('sell')}
                                className={`py-4 rounded-2xl font-black text-lg transition-all transform hover:scale-[1.02] ${mode === 'sell'
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                    : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                                    }`}
                            >
                                SELL
                            </button>
                        </div>

                        {/* 2. Order Form (Only Visible if Mode Selected) */}
                        {mode && (
                            <div className="px-6 pb-6 pt-2 space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className={`p-3 rounded-xl text-center text-sm font-bold ${mode === 'buy' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    You are placing a {mode.toUpperCase()} order
                                </div>

                                {/* Stock Symbol Search */}
                                <StockSearchInput
                                    placeholder="Search e.g. NABIL or Nabil Bank"
                                    initialValue={order.symbol}
                                    onSelect={selectStock}
                                />

                                {/* Order Type */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Order Type</label>
                                    <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
                                        {['market', 'limit'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => updateOrder('type', type)}
                                                className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize transition-all ${order.type === type
                                                    ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                                                    : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Quantity */}
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="block text-xs font-bold text-gray-400 uppercase">Quantity</label>
                                        {mode === 'sell' && order.symbol && (
                                            <span className="text-xs font-bold text-blue-500">
                                                Available: {availableQty}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={order.qty}
                                            onChange={(e) => updateOrder('qty', e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 font-bold text-gray-800 dark:text-white focus:border-blue-500 outline-none"
                                        />
                                        {mode === 'sell' && order.symbol && (
                                            <button
                                                onClick={() => updateOrder('qty', availableQty)}
                                                className="absolute right-2 top-2 px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs font-bold hover:bg-blue-200"
                                            >
                                                MAX
                                            </button>
                                        )}
                                    </div>
                                    {mode === 'sell' && order.qty > availableQty && (
                                        <p className="text-xs text-red-500 font-bold mt-1">Exceeds available quantity!</p>
                                    )}
                                </div>

                                {/* Price */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Price</label>
                                    <input
                                        type="number"
                                        value={order.price}
                                        onChange={(e) => updateOrder('price', e.target.value)}
                                        disabled={order.type === 'market'}
                                        className={`w-full border-2 rounded-xl px-4 py-3 font-bold outline-none transition-colors ${order.type === 'market'
                                            ? 'bg-gray-100 dark:bg-gray-800 border-transparent text-gray-400 cursor-not-allowed'
                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-800 dark:text-white focus:border-blue-500'
                                            }`}
                                    />
                                </div>

                                {/* CALCULATED SUMMARY */}
                                {calcResult && (
                                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl space-y-2 border border-dashed border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Effective Rate</span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200">
                                                Rs. {mode === 'buy' ? parseFloat(calcResult.effective_price).toFixed(2) : parseFloat(calcResult.total_cost_basis / order.qty).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 font-bold">{mode === 'buy' ? 'Total Payable' : 'Net Receivable'}</span>
                                            <span className={`text-xl font-black ${mode === 'buy' ? 'text-blue-600' : 'text-green-600'}`}>
                                                Rs. {mode === 'buy'
                                                    ? parseFloat(calcResult.total_cost).toLocaleString()
                                                    : parseFloat(calcResult.net_receivable).toLocaleString()
                                                }
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {calcLoading && (
                                    <div className="text-center text-xs text-gray-400 animate-pulse">Calculating taxes & fees...</div>
                                )}

                                {/* Submit */}
                                <button
                                    onClick={() => setShowConfirm(true)}
                                    disabled={
                                        calcLoading || // Disable while calculating
                                        !order.symbol ||
                                        !order.qty ||
                                        (!order.price && order.type === 'limit') ||
                                        (mode === 'sell' && order.qty > availableQty)
                                    }
                                    className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'buy' ? 'bg-green-500 shadow-green-500/30' : 'bg-red-500 shadow-red-500/30'
                                        }`}
                                >
                                    {calcLoading ? 'Calculating...' : `Place ${mode.toUpperCase()} Order`}
                                </button>
                            </div>
                        )}

                        {/* Default Info State */}
                        {!mode && (
                            <div className="p-8 text-center text-gray-400">
                                <p className="text-4xl mb-4">👆</p>
                                <p className="font-bold">Select Buy or Sell to start trading.</p>
                            </div>
                        )}
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

            </div >

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
