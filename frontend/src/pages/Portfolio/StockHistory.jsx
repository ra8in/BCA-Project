import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MarketContext } from '../../context/MarketContext';
import { portfolioService } from '../../services/portfolioService';
import { stockService } from '../../services/stockService';

const StockHistory = () => {
    const { symbol } = useParams();
    const navigate = useNavigate();
    const { updateSector, updateStock } = useContext(MarketContext);
    const [history, setHistory] = useState(null);
    const [stock, setStock] = useState(null);
    const [nepseIndex, setNepseIndex] = useState(null);
    const [sectorIndex, setSectorIndex] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [historyData, stockData, indicesData] = await Promise.all([
                    portfolioService.getStockTransactions(symbol),
                    stockService.getDetail(symbol),
                    stockService.getMarketIndices()
                ]);
                setHistory(historyData);
                setStock(stockData);

                // Find NEPSE index
                const nepse = indicesData.find(idx => idx.symbol === 'NEPSE' || idx.name === 'NEPSE');
                setNepseIndex(nepse);

                // Find sector index based on stock's sector name
                if (stockData?.sector_name) {
                    const sector = indicesData.find(idx =>
                        idx.name?.toLowerCase().includes(stockData.sector_name.toLowerCase()) ||
                        stockData.sector_name.toLowerCase().includes(idx.name?.toLowerCase())
                    );
                    setSectorIndex(sector);
                }
            } catch (err) {
                console.error('Failed to fetch history:', err);
                setError('Failed to load history');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [symbol]);

    // Update Global Ribbon
    useEffect(() => {
        if (stock) {
            if (stock.sector_name) {
                updateSector(stock.sector_name);
            }
            updateStock(stock);
        } else {
            updateSector(null);
            updateStock(null);
        }
        return () => {
            updateSector(null);
            updateStock(null);
        };
    }, [stock, updateSector, updateStock]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-xl text-red-500">{error}</p>
                <button
                    onClick={() => navigate('/portfolio')}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Back to Portfolio
                </button>
            </div>
        );
    }

    return (
        <div>
            {/* Local Index Bar Removed - Using Global Ribbon */}

            {/* Header with Sector Badge */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/portfolio')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                    <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{symbol}</h1>
                        {stock?.sector_name && (
                            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold uppercase">
                                {stock.sector_name}
                            </span>
                        )}
                    </div>
                    {stock && <p className="text-gray-500 dark:text-gray-400">{stock.name}</p>}
                </div>
            </div>

            {/* Summary Cards - Now with 6 columns */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Buy Qty</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{history?.summary?.total_buy_qty || 0}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Sell Qty</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{history?.summary?.total_sell_qty || 0}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Holding</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{history?.summary?.current_holding_qty || 0}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Invested</p>
                    <p className="text-2xl font-bold dark:text-white">Rs. {parseFloat(history?.summary?.total_invested || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Realized P/L</p>
                    <p className={`text-2xl font-bold ${(history?.summary?.realized_pl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        Rs. {parseFloat(history?.summary?.realized_pl || 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current LTP</p>
                    <p className="text-2xl font-bold dark:text-white">Rs. {parseFloat(stock?.last_price || 0).toLocaleString()}</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mb-8">
                <button
                    onClick={() => navigate('/trading', { state: { mode: 'buy', symbol } })}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors"
                >
                    Buy More
                </button>
                {(history?.summary?.current_holding_qty || 0) > 0 && (
                    <button
                        onClick={() => navigate('/trading', { state: { mode: 'sell', symbol } })}
                        className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors"
                    >
                        Sell
                    </button>
                )}
                <button
                    onClick={() => navigate(`/stock/${symbol}`)}
                    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl transition-colors"
                >
                    View Stock Details
                </button>
            </div>

            {/* Transactions Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <h3 className="px-6 py-4 font-bold text-lg text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                    All Transactions
                </h3>
                {!history?.transactions?.length ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        No transactions found for {symbol}
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Quantity</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Price</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Total Amount</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">P/L</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {history.transactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {new Date(tx.date).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${tx.type === 'BUY' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium dark:text-white">{tx.quantity}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">Rs. {parseFloat(tx.price).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm font-medium dark:text-white">Rs. {parseFloat(tx.total).toLocaleString()}</td>
                                    <td className={`px-6 py-4 text-sm font-bold ${tx.realized_pl > 0 ? 'text-green-500' : tx.realized_pl < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                        {tx.realized_pl ? `Rs. ${parseFloat(tx.realized_pl).toLocaleString()}` : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div >
    );
};

export default StockHistory;
