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

    // Fetch Stock Data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const stockData = await stockService.getDetail(symbol);
                setStock(stockData);
            } catch (err) {
                setError('Stock not found');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [symbol]);

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

    const isPositive = parseFloat(stock.change_percent) >= 0;

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
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 p-6 md:p-8 mb-8">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Last Traded Price</p>
                        <p className="text-5xl font-black text-gray-900 dark:text-white">
                            Rs. {parseFloat(stock.last_price).toLocaleString()}
                        </p>
                    </div>
                    <div className={`text-right ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        <p className="text-3xl font-black">
                            {isPositive ? '+' : ''}{parseFloat(stock.change || 0).toFixed(2)}
                        </p>
                        <p className="text-lg font-bold">
                            ({isPositive ? '+' : ''}{parseFloat(stock.change_percent).toFixed(2)}%)
                        </p>
                    </div>
                </div>
            </div>

            {/* Key Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <StatCard label="Open" value={`Rs. ${parseFloat(stock.open_price || 0).toLocaleString()}`} />
                <StatCard label="High" value={`Rs. ${parseFloat(stock.high_price || 0).toLocaleString()}`} />
                <StatCard label="Low" value={`Rs. ${parseFloat(stock.low_price || 0).toLocaleString()}`} />
                <StatCard label="Prev. Close" value={`Rs. ${parseFloat(stock.previous_close || 0).toLocaleString()}`} />
                <StatCard
                    label="Upper Circuit (+10%)"
                    value={`Rs. ${parseFloat(stock.circuit_high || 0).toFixed(1)}`}
                    subLabel="Max Price"
                />
                <StatCard
                    label="Lower Circuit (-10%)"
                    value={`Rs. ${parseFloat(stock.circuit_low || 0).toFixed(1)}`}
                    subLabel="Min Price"
                />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <StatCard
                    label="Volume"
                    value={parseFloat(stock.total_trade_quantity || 0).toLocaleString()}
                    subLabel="Total Shares"
                />
                <StatCard
                    label="Turnover"
                    value={`Rs. ${(parseFloat(stock.total_traded_value || 0) / 10000000).toFixed(2)}Cr`}
                    subLabel="Total Value"
                />
                <StatCard
                    label="Trades"
                    value={parseFloat(stock.total_trades || 0).toLocaleString()}
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
