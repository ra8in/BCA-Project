import { useState, useEffect, useContext } from 'react';
import { MarketContext } from '../../context/MarketContext';
import { useNavigate, useParams } from 'react-router-dom';
import { stockService } from '../../services/stockService';
import { portfolioService } from '../../services/portfolioService';
import { useAuth } from '../../context/AuthContext';

const StockDetail = () => {
    const { symbol } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { updateSector, updateStock } = useContext(MarketContext);

    const [stock, setStock] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Live Data State
    const [livePrice, setLivePrice] = useState(null);
    const [marketDepth, setMarketDepth] = useState(null);
    const [loadingDepth, setLoadingDepth] = useState(false);
    const [showDepth, setShowDepth] = useState(false);
    const [isMarketOpen, setIsMarketOpen] = useState(false);

    // Fetch Stock Data (Static/Base)
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const stockData = await stockService.getDetail(symbol);
                setStock(stockData);
                // Initialize live price with static data
                setLivePrice({
                    ltp: stockData.last_price,
                    change: stockData.change,
                    change_percent: stockData.change_percent
                });
            } catch (err) {
                setError('Stock not found');
            } finally {
                setLoading(false);
            }
        };

        const fetchMarketStatus = async () => {
            try {
                const status = await stockService.getMarketStatus();
                setIsMarketOpen(status?.is_open || false);
            } catch (err) {
                console.error("Failed to fetch market status", err);
            }
        };

        fetchData();
        fetchMarketStatus();
    }, [symbol]);

    // Live Price Polling (adaptive: 15s when market open, none when closed)
    useEffect(() => {
        let intervalId;

        const fetchLivePrice = async () => {
            try {
                const data = await stockService.getLiveStockPrice(symbol);
                if (data && !data.error) {
                    setLivePrice(data);
                    // Also update main stock object slightly to reflect new price
                    setStock(prev => prev ? {
                        ...prev,
                        last_price: data.ltp,
                        change: data.change,
                        change_percent: data.change_percent,
                        total_trade_quantity: data.volume,
                        total_traded_value: data.turnover
                    } : null);
                }
            } catch (err) {
                console.error("Failed to fetch live price", err);
            }
        };

        // Always fetch once on mount/symbol change
        const initialTimer = setTimeout(fetchLivePrice, 2000);

        // Auto-refresh aligned to the minute (at :01 seconds) during market hours
        let timeoutId;

        const scheduleNextFetch = () => {
            if (!isMarketOpen) return;

            const now = new Date();
            // Wait until next minute exactly (HH:MM:00)
            const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

            timeoutId = setTimeout(() => {
                fetchLivePrice();
                scheduleNextFetch();
            }, msUntilNextMinute);
        };

        if (isMarketOpen) {
            scheduleNextFetch();
        }

        return () => {
            clearTimeout(initialTimer);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [symbol, isMarketOpen]);

    // Fetch Market Depth
    const handleDepthRefresh = async () => {
        setLoadingDepth(true);
        try {
            const data = await stockService.getMarketDepth(symbol);
            if (data && !data.error) {
                setMarketDepth(data);
                if (data._throttled) {
                    // Ideally show a toast here, but simple alert for now or just log
                    console.log("Showing cached data (updates every minute)");
                }
            }
        } catch (err) {
            console.error("Failed to update market depth");
        } finally {
            setLoadingDepth(false);
        }
    };

    // Load depth when toggled ON
    useEffect(() => {
        if (showDepth && !marketDepth) {
            handleDepthRefresh();
        }
    }, [showDepth]);


    // Update Global Sector & Stock Context
    useEffect(() => {
        if (stock) {
            if (stock.sector_name) {
                updateSector(stock.sector_name);
            }
            updateStock(stock);
        }
        return () => {
            updateSector(null);
            updateStock(null);
        };
    }, [stock, updateSector, updateStock]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-pulse text-gray-400 text-xl">Loading...</div>
            </div>
        );
    }

    if (error || !stock) {
        return (
            <div className="p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
                <div className="text-6xl mb-4">📉</div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">Stock Not Found</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">The symbol "{symbol}" doesn't exist or is no longer active.</p>
                <button onClick={() => navigate(-1)} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">
                    Go Back
                </button>
            </div>
        );
    }

    const price = livePrice || stock;
    const isPositive = parseFloat(price.change_percent) >= 0;

    // Stat Card Component
    const StatCard = ({ label, value, subLabel }) => (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">{label}</p>
            <p className="text-lg font-black text-gray-900 dark:text-white">{value}</p>
            {subLabel && <p className="text-xs text-gray-400">{subLabel}</p>}
        </div>
    );

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold uppercase">
                        {stock.sector_name || 'N/A'}
                    </span>
                </div>
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-1">{stock.symbol}</h1>
                <p className="text-lg text-gray-500 dark:text-gray-400 font-medium">{stock.name}</p>
            </div>

            {/* Price Section */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 p-6 md:p-8 mb-8 transition-all">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Last Traded Price</p>
                        <p className="text-5xl font-black text-gray-900 dark:text-white transition-all duration-300">
                            Rs. {parseFloat(price.ltp || price.last_price).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                            Last Updated: {price.last_updated ? new Date(price.last_updated).toLocaleTimeString() : 'Just now'}
                        </p>
                    </div>
                    <div className={`text-right ${parseFloat(price.change_percent) > 0
                        ? 'text-green-600'
                        : parseFloat(price.change_percent) < 0
                            ? 'text-red-500'
                            : 'text-blue-500'
                        }`}>
                        <p className="text-3xl font-black">
                            {parseFloat(price.change_percent) > 0 ? '+' : ''}{parseFloat(price.change || 0).toFixed(2)}
                        </p>
                        <p className="text-lg font-bold">
                            ({parseFloat(price.change_percent) > 0 ? '+' : ''}{parseFloat(price.change_percent).toFixed(2)}%)
                        </p>
                    </div>
                </div>
            </div>

            {/* Market Depth Toggle */}
            <div className="mb-8">
                <button
                    onClick={() => setShowDepth(!showDepth)}
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:underline mb-4"
                >
                    {showDepth ? 'Hide Market Depth' : 'Show Market Depth'}
                    <svg className={`w-4 h-4 transform transition-transform ${showDepth ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {showDepth && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 mb-8 animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Market Depth</h3>
                                {isMarketOpen ? (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-[10px] font-bold uppercase animate-pulse transition-all">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                        LIVE
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full text-[10px] font-bold uppercase transition-all">
                                        CLOSED
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={handleDepthRefresh}
                                disabled={loadingDepth}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors disabled:opacity-50"
                                title="Refresh Data"
                            >
                                <svg className={`w-5 h-5 ${loadingDepth ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        </div>

                        {loadingDepth && !marketDepth ? (
                            <div className="text-center py-8 text-gray-400">Loading order book...</div>
                        ) : marketDepth ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Buy Orders */}
                                <div>
                                    <h4 className="text-sm font-bold text-green-600 uppercase mb-3 flex justify-between">
                                        <span>Buy Orders</span>
                                        <span>Qty: {marketDepth.totalBuyQty?.toLocaleString()}</span>
                                    </h4>
                                    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                                <tr className="text-left text-gray-500 dark:text-gray-400">
                                                    <th className="p-2 font-medium">Qty</th>
                                                    <th className="p-2 font-medium text-right">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {marketDepth.marketDepth?.buyMarketDepthList?.map((order, i) => (
                                                    <tr key={i} className="hover:bg-green-50/50 dark:hover:bg-green-900/10">
                                                        <td className="p-2 font-medium text-gray-900 dark:text-white">{order.quantity}</td>
                                                        <td className="p-2 font-bold text-green-600 text-right">{order.orderBookOrderPrice}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Sell Orders */}
                                <div>
                                    <h4 className="text-sm font-bold text-red-500 uppercase mb-3 flex justify-between">
                                        <span>Sell Orders</span>
                                        <span>Qty: {marketDepth.totalSellQty?.toLocaleString()}</span>
                                    </h4>
                                    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                                <tr className="text-left text-gray-500 dark:text-gray-400">
                                                    <th className="p-2 font-medium text-right">Price</th>
                                                    <th className="p-2 font-medium text-right">Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {marketDepth.marketDepth?.sellMarketDepthList?.map((order, i) => (
                                                    <tr key={i} className="hover:bg-red-50/50 dark:hover:bg-red-900/10">
                                                        <td className="p-2 font-bold text-red-500 text-right">{order.orderBookOrderPrice}</td>
                                                        <td className="p-2 font-medium text-gray-900 dark:text-white text-right">{order.quantity}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400">No market depth data available</div>
                        )}
                    </div>
                )}
            </div>

            {/* Key Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <StatCard label="Open" value={`Rs. ${parseFloat(price.open || price.open_price || 0).toLocaleString()}`} />
                <StatCard label="High" value={`Rs. ${parseFloat(price.high || price.high_price || 0).toLocaleString()}`} />
                <StatCard label="Low" value={`Rs. ${parseFloat(price.low || price.low_price || 0).toLocaleString()}`} />
                <StatCard label="Prev. Close" value={`Rs. ${parseFloat(stock.previous_close || 0).toLocaleString()}`} />
                <StatCard
                    label="Upper Circuit (+10%)"
                    value={`Rs. ${parseFloat(stock.circuit_high || (stock.previous_close * 1.1)).toFixed(1)}`}
                    subLabel="Max Price"
                />
                <StatCard
                    label="Lower Circuit (-10%)"
                    value={`Rs. ${parseFloat(stock.circuit_low || (stock.previous_close * 0.9)).toFixed(1)}`}
                    subLabel="Min Price"
                />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <StatCard
                    label="Volume"
                    value={parseFloat(price.volume || price.total_trade_quantity || 0).toLocaleString()}
                    subLabel="Total Shares"
                />
                <StatCard
                    label="Turnover"
                    value={`Rs. ${(parseFloat(price.turnover || price.total_traded_value || 0) / 10000000).toFixed(2)}Cr`}
                    subLabel="Total Value"
                />
                <StatCard
                    label="Trades"
                    value={parseFloat(price.total_trades || stock.total_trades || 0).toLocaleString()}
                    subLabel="Total Transactions"
                />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={() => {
                        if (isAuthenticated) {
                            navigate('/trading', { state: { mode: 'buy', symbol: stock.symbol } });
                        } else {
                            navigate('/login');
                        }
                    }}
                    className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white font-black text-lg rounded-2xl transition-colors shadow-lg shadow-green-500/20"
                >
                    Buy {stock.symbol}
                </button>
                <button
                    onClick={() => {
                        if (isAuthenticated) {
                            navigate('/trading', { state: { mode: 'sell', symbol: stock.symbol } });
                        } else {
                            navigate('/login');
                        }
                    }}
                    className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-black text-lg rounded-2xl transition-colors shadow-lg shadow-red-500/20"
                >
                    Sell {stock.symbol}
                </button>
            </div>

            {/* Transaction History Section */}
            <TransactionHistory symbol={symbol} />

        </div>
    );
};

// Sub-component for Transaction History
const TransactionHistory = ({ symbol }) => {
    const navigate = useNavigate();
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const data = await portfolioService.getStockTransactions(symbol);
                setHistory(data);
            } catch (err) {
                console.error("Failed to fetch stock history", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [symbol]);

    if (loading) return <div className="text-center py-8">Loading history...</div>;
    if (!history || history.transactions.length === 0) return null;

    return (
        <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Position</h2>
                <button
                    onClick={() => navigate(`/portfolio/history/${symbol}`)}
                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                >
                    View Full History
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Traded Qty</p>
                    <p className="text-xl font-bold dark:text-white">{history.summary.total_traded_qty}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Current Holding</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{history.summary.current_holding_qty}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Net Invested</p>
                    <p className="text-xl font-bold dark:text-white">Rs. {parseFloat(history.summary.total_invested).toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Realized P/L</p>
                    <p className={`text-xl font-bold ${history.summary.realized_pl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        Rs. {parseFloat(history.summary.realized_pl).toLocaleString()}
                    </p>
                </div>
            </div>

        </div>
    );
};

export default StockDetail;
