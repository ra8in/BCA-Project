import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockService } from '../../services/stockService';
import WatchlistWidget from '../../components/dashboard/WatchlistWidget';
import TurnoverWidget from '../../components/dashboard/TurnoverWidget';
import MarketTicker from '../../components/common/MarketTicker';

const Dashboard = () => {

    const [topGainers, setTopGainers] = useState([]);
    const [topLosers, setTopLosers] = useState([]);
    const [topTurnover, setTopTurnover] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [gainersData, losersData, turnoverData] = await Promise.all([
                stockService.getTopGainers(),
                stockService.getTopLosers(),
                stockService.getTopTurnover()
            ]);



            setTopGainers(gainersData);
            setTopLosers(losersData);
            setTopTurnover(turnoverData);
            setLoading(false);
        };
        fetchData();
    }, []);

    if (loading) return <div className="p-8 text-center text-xl">Loading Market Data...</div>;

    // Generic Table Container
    const TableContainer = ({ title, titleColor, onViewAll, children }) => (
        <div className="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 p-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <h3 className={`text-lg font-bold ${titleColor} dark:text-white`}>{title}</h3>
                <button
                    onClick={onViewAll}
                    className="text-xs font-bold text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                >
                    View All →
                </button>
            </div>
            <div className="flex-grow flex flex-col">
                <table className="w-full text-left text-sm relative border-collapse">
                    {children}
                </table>
            </div>
        </div>
    );

    // Standard Row for Gainers/Losers
    const StockRow = ({ stock }) => (
        <tr
            className="hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-600/50 last:border-0"
            onClick={() => navigate(`/stock/${stock.symbol}`)}
        >
            <td className="py-3 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{stock.symbol}</td>
            <td className="py-3 font-medium dark:text-white whitespace-nowrap">Rs. {parseFloat(stock.last_price).toLocaleString()}</td>
            <td className={`py-3 font-bold whitespace-nowrap text-right ${parseFloat(stock.change_percent) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {parseFloat(stock.change || 0).toFixed(1)} ({parseFloat(stock.change_percent).toFixed(1)}%)
            </td>
        </tr>
    );

    // Specific Row for Turnover
    const TurnoverRow = ({ stock }) => (
        <tr
            className="hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-600/50 last:border-0"
            onClick={() => navigate(`/stock/${stock.symbol}`)}
        >
            <td className="py-3 font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">{stock.symbol}</td>
            <td className="py-3 font-medium dark:text-white whitespace-nowrap">
                Rs. {(parseFloat(stock.total_traded_value || 0) / 10000000).toFixed(2)}Cr
            </td>
            <td className="py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap text-right">
                Rs. {parseFloat(stock.last_price).toLocaleString()}
            </td>
        </tr>
    );

    return (
        <div>
            <MarketTicker />
            <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">Market Overview</h2>



            {/* Top Gainers, Losers, Turnover Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 items-start">

                {/* Top Gainers */}
                <TableContainer
                    title="🚀 Top Gainers"
                    titleColor="text-green-600"
                    onViewAll={() => navigate('/market/gainers')}
                >
                    <thead className="sticky top-0 bg-white dark:bg-gray-700 z-10 shadow-sm">
                        <tr>
                            <th className="pb-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Symbol</th>
                            <th className="pb-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">LTP</th>
                            <th className="pb-3 text-gray-500 dark:text-gray-400 font-medium text-right whitespace-nowrap">Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        {topGainers.slice(0, 10).map(stock => (
                            <StockRow key={stock.id} stock={stock} />
                        ))}
                    </tbody>
                </TableContainer>

                {/* Top Losers */}
                <TableContainer
                    title="📉 Top Losers"
                    titleColor="text-red-600"
                    onViewAll={() => navigate('/market/losers')}
                >
                    <thead className="sticky top-0 bg-white dark:bg-gray-700 z-10 shadow-sm">
                        <tr>
                            <th className="pb-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Symbol</th>
                            <th className="pb-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">LTP</th>
                            <th className="pb-3 text-gray-500 dark:text-gray-400 font-medium text-right whitespace-nowrap">Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        {topLosers.slice(0, 10).map(stock => (
                            <StockRow key={stock.id} stock={stock} />
                        ))}
                    </tbody>
                </TableContainer>

                {/* Top Turnover */}
                <TableContainer
                    title="💰 Top Turnover"
                    titleColor="text-blue-600"
                    onViewAll={() => navigate('/market/turnover')}
                >
                    <thead className="sticky top-0 bg-white dark:bg-gray-700 z-10 shadow-sm">
                        <tr>
                            <th className="pb-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Symbol</th>
                            <th className="pb-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Turnover</th>
                            <th className="pb-3 text-gray-500 dark:text-gray-400 font-medium text-right whitespace-nowrap">LTP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {topTurnover.slice(0, 10).map(stock => (
                            <TurnoverRow key={stock.id} stock={stock} />
                        ))}
                    </tbody>
                </TableContainer>

            </div>

            {/* Watchlist Section */}
            <WatchlistWidget />
        </div>
    );
};



export default Dashboard;
