import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { stockService } from '../../services/stockService';


const MarketMovers = () => {
    const { tab } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Get tab from URL param, default to 'gainers'
    const activeTab = tab || 'gainers';
    const currentPage = parseInt(searchParams.get('page') || '1', 10);

    const [data, setData] = useState({ results: [], count: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [activeTab, currentPage]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = { limit: 20, page: currentPage };
            let response;

            if (activeTab === 'gainers') {
                response = await stockService.getTopGainers(params);
            } else if (activeTab === 'losers') {
                response = await stockService.getTopLosers(params);
            } else if (activeTab === 'turnover') {
                response = await stockService.getTopTurnover(params);
            }

            // Handle both pagination response and simple array fallback
            if (response.results) {
                setData(response);
            } else {
                setData({ results: response || [], count: (response || []).length });
            }
        } catch (err) {
            console.error("Failed to fetch market movers", err);
            setData({ results: [], count: 0 });
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (newTab) => {
        navigate(`/market/${newTab}`);
    };

    const handlePageChange = (newPage) => {
        setSearchParams({ page: newPage });
    };

    const tabs = [
        { id: 'gainers', label: '🚀 Top Gainers' },
        { id: 'losers', label: '📉 Top Losers' },
        { id: 'turnover', label: '💰 Top Turnover' },
    ];

    const hasNext = data.next !== null;
    const hasPrev = data.previous !== null;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">


            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-black text-gray-900 dark:text-white">Market Movers</h2>

                <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="p-12 text-center text-gray-400 animate-pulse">Loading...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">Rank & Symbol</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">LTP</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Change</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Turnover</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                {data.results.map((stock, index) => (
                                    <tr
                                        key={stock.id}
                                        onClick={() => navigate(`/stock/${stock.symbol}`)}
                                        className="hover:bg-blue-50/30 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-bold text-gray-400">
                                                    #{(currentPage - 1) * 20 + index + 1}
                                                </span>
                                                <span className="font-black text-blue-600 dark:text-blue-400 text-lg">
                                                    {stock.symbol}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                                            Rs. {parseFloat(stock.last_price).toLocaleString()}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-bold ${parseFloat(stock.change_percent) >= 0 ? 'text-green-600' : 'text-red-500'
                                            }`}>
                                            Rs. {parseFloat(stock.change || 0).toFixed(2)} ({parseFloat(stock.change_percent).toFixed(2)}%)
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">
                                            Rs. {(parseFloat(stock.total_traded_value || 0) / 10000000).toFixed(2)}Cr
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/30">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!hasPrev || loading}
                        className={`px-4 py-2 rounded-lg text-sm font-bold ${!hasPrev ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-white shadow-sm hover:bg-gray-50'
                            }`}
                    >
                        ← Previous
                    </button>

                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Page {currentPage}
                    </span>

                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!hasNext || loading}
                        className={`px-4 py-2 rounded-lg text-sm font-bold ${!hasNext ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-white shadow-sm hover:bg-gray-50'
                            }`}
                    >
                        Next →
                    </button>
                </div>

            </div>
        </div>
    );
};

export default MarketMovers;
