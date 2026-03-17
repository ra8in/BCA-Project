import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { portfolioService } from '../../services/portfolioService';


const Portfolio = () => {
    const navigate = useNavigate();
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showPastHoldings, setShowPastHoldings] = useState(false);
    const [pastHoldings, setPastHoldings] = useState([]);
    const [loadingPast, setLoadingPast] = useState(false);

    useEffect(() => {
        fetchPortfolio();
    }, []);

    useEffect(() => {
        if (showPastHoldings && pastHoldings.length === 0) {
            fetchPastHoldings();
        }
    }, [showPastHoldings]);

    const fetchPortfolio = async () => {
        try {
            setLoading(true);
            const data = await portfolioService.getPortfolio();
            setPortfolio(data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch portfolio:', err);
            setError('Failed to load portfolio');
        } finally {
            setLoading(false);
        }
    };

    const fetchPastHoldings = async () => {
        try {
            setLoadingPast(true);
            const data = await portfolioService.getPastHoldings();
            setPastHoldings(data);
        } catch (err) {
            console.error('Failed to fetch past holdings:', err);
        } finally {
            setLoadingPast(false);
        }
    };

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
                    onClick={fetchPortfolio}
                    className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    const { cash_balance, invested_amount, current_value, total_profit_loss, total_realized_profit, total_profit_loss_percent, holdings } = portfolio;

    return (
        <div>

            <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">My Portfolio</h2>

            {/* Portfolio Summary */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-8 mb-8 text-white shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    <div>
                        <p className="text-blue-100 text-sm font-medium mb-1">Cash Balance</p>
                        <p className="text-2xl font-bold">₹{parseFloat(cash_balance).toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-blue-100 text-sm font-medium mb-1">Invested</p>
                        <p className="text-2xl font-bold">₹{parseFloat(invested_amount).toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-blue-100 text-sm font-medium mb-1">Current Value</p>
                        <p className="text-2xl font-bold">₹{parseFloat(current_value).toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-blue-100 text-sm font-medium mb-1">Unrealized P/L</p>
                        <p className={`text-2xl font-bold ${parseFloat(total_profit_loss) > 0 ? 'text-green-300' : parseFloat(total_profit_loss) < 0 ? 'text-red-300' : 'text-white'
                            }`}>
                            ₹{parseFloat(total_profit_loss).toLocaleString()}
                        </p>
                        <p className={`text-xs ${parseFloat(total_profit_loss_percent) > 0 ? 'text-green-200' : parseFloat(total_profit_loss_percent) < 0 ? 'text-red-200' : 'text-gray-200'
                            }`}>
                            ({parseFloat(total_profit_loss_percent).toFixed(2)}%)
                        </p>
                    </div>
                    <div>
                        <p className="text-blue-100 text-sm font-medium mb-1">Realized Profit</p>
                        <div className="flex items-baseline gap-2">
                            <p className={`text-2xl font-bold ${parseFloat(total_realized_profit) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                ₹{parseFloat(total_realized_profit || 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
                {/* View All History Button */}
                <div className="mt-6 pt-6 border-t border-blue-500/30">
                    <button
                        onClick={() => navigate('/portfolio/history')}
                        className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition-colors"
                    >
                        View All Transaction History →
                    </button>
                </div>
            </div>

            {/* Show Past Holdings Checkbox */}
            <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showPastHoldings}
                        onChange={(e) => setShowPastHoldings(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">Show Past Holdings</span>
                </label>
            </div>

            {holdings.length === 0 && !showPastHoldings ? (
                <div className="text-center py-12 bg-white dark:bg-gray-700 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                    <p className="text-xl text-gray-500 dark:text-gray-400">You don't have any stocks yet.</p>
                    <p className="text-gray-400 dark:text-gray-500 mt-2">Go to Market to start trading!</p>
                </div>
            ) : (
                <>
                    {/* Current Holdings */}
                    {holdings.length > 0 && (
                        <div className="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden mb-6">
                            <h3 className="px-6 py-4 font-bold text-lg text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                                Current Holdings
                            </h3>
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">Symbol</th>
                                        <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">Name</th>
                                        <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">Qty</th>
                                        <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">WACC</th>
                                        <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">LTP</th>
                                        <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">Current Value</th>
                                        <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">P/L</th>
                                        <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-600">
                                    {holdings.map((holding) => (
                                        <tr
                                            key={holding.id}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            <td
                                                className="px-6 py-4 font-bold text-primary-600 dark:text-primary-400 cursor-pointer hover:underline"
                                                onClick={() => navigate(`/stock/${holding.stock_symbol}`)}
                                            >
                                                {holding.stock_symbol}
                                            </td>
                                            <td
                                                className="px-6 py-4 text-gray-700 dark:text-gray-300 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400"
                                                onClick={() => navigate(`/stock/${holding.stock_symbol}`)}
                                            >
                                                {holding.stock_name}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{holding.quantity}</td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400">₹{parseFloat(holding.average_buy_price).toFixed(2)}</td>
                                            <td className="px-6 py-4 font-medium dark:text-white">₹{parseFloat(holding.current_price).toFixed(2)}</td>
                                            <td className="px-6 py-4 font-medium dark:text-white">₹{parseFloat(holding.market_value).toLocaleString()}</td>
                                            <td className={`px-6 py-4 font-medium ${holding.profit_loss > 0 ? 'text-green-500' : holding.profit_loss < 0 ? 'text-red-500' : 'text-blue-500'
                                                }`}>
                                                ₹{parseFloat(holding.profit_loss).toLocaleString()}
                                                <span className="text-xs ml-1">({parseFloat(holding.profit_loss_percent).toFixed(2)}%)</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/portfolio/history/${holding.stock_symbol}`); }}
                                                    className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 text-sm font-medium rounded-lg transition-colors"
                                                >
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Past Holdings */}
                    {showPastHoldings && (
                        <div className="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden">
                            <h3 className="px-6 py-4 font-bold text-lg text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                                Past Holdings (Fully Sold)
                            </h3>
                            {loadingPast ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                </div>
                            ) : pastHoldings.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    No past holdings found.
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">Symbol</th>
                                            <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">Name</th>
                                            <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">Qty Sold</th>
                                            <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">Total Received</th>
                                            <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">Realized P/L</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-600">
                                        {pastHoldings.map((item, idx) => (
                                            <tr
                                                key={idx}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                            >
                                                <td
                                                    className="px-6 py-4 font-bold text-primary-600 dark:text-primary-400 cursor-pointer hover:underline"
                                                    onClick={() => navigate(`/stock/${item.stock_symbol}`)}
                                                >
                                                    {item.stock_symbol}
                                                </td>
                                                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{item.stock_name}</td>
                                                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{item.total_qty_sold}</td>
                                                <td className="px-6 py-4 font-medium dark:text-white">₹{parseFloat(item.total_sell_value).toLocaleString()}</td>
                                                <td className={`px-6 py-4 font-bold ${item.total_realized_pl > 0 ? 'text-green-500' : item.total_realized_pl < 0 ? 'text-red-500' : 'text-blue-500'
                                                    }`}>
                                                    ₹{parseFloat(item.total_realized_pl).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Portfolio;
