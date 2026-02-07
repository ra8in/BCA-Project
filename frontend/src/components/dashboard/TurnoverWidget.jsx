import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockService } from '../../services/stockService';

const TurnoverWidget = () => {
    const navigate = useNavigate();
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTopTurnover = async () => {
            try {
                const data = await stockService.getTopTurnover();
                setStocks(data);
            } catch (err) {
                console.error("Failed to fetch top turnover", err);
            } finally {
                setLoading(false);
            }
        };

        fetchTopTurnover();
    }, []);

    if (loading) return <div className="animate-pulse h-64 bg-gray-100 dark:bg-gray-800 rounded-3xl"></div>;

    return (
        <div className="mt-8">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="bg-purple-600 text-white p-2 rounded-lg text-sm">🔥</span>
                Top Turnover
            </h3>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Symbol</th>
                            <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Turnover</th>
                            <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">LTP</th>
                            <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Change</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                        {stocks.map((stock, index) => (
                            <tr
                                key={stock.id}
                                onClick={() => navigate('/market')}
                                className="hover:bg-purple-50/30 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                                        <span className="font-black text-purple-600 dark:text-purple-400 block">{stock.symbol}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className="font-bold text-gray-900 dark:text-white">
                                        Rs. {(parseFloat(stock.total_traded_value || 0) / 10000000).toFixed(2)}Cr
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className="font-medium text-gray-600 dark:text-gray-300">
                                        {parseFloat(stock.last_price).toLocaleString()}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className={`text-xs font-bold ${parseFloat(stock.change_percent) >= 0
                                            ? 'text-green-600 dark:text-green-400'
                                            : 'text-red-600 dark:text-red-400'
                                        }`}>
                                        Rs. {parseFloat(stock.change || 0).toFixed(2)} ({parseFloat(stock.change_percent).toFixed(2)}%)
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/30 text-center border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => navigate('/market')} className="text-sm font-bold text-purple-600 hover:text-purple-800">
                        View All Market Data →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TurnoverWidget;
