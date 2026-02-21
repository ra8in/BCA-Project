import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { portfolioService } from '../../services/portfolioService';
import { stockService } from '../../services/stockService';


const PortfolioHistory = () => {
    const navigate = useNavigate();
    const [portfolio, setPortfolio] = useState(null);
    const [allTransactions, setAllTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showPast, setShowPast] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const portfolioData = await portfolioService.getPortfolio();
                setPortfolio(portfolioData);

                // Fetch transactions for all stocks (past + current holdings)
                const holdings = portfolioData.holdings || [];
                const pastHoldings = await portfolioService.getPastHoldings();

                // Get all unique symbols
                const allSymbols = [
                    ...holdings.map(h => h.stock_symbol),
                    ...pastHoldings.map(h => h.stock_symbol)
                ];
                const uniqueSymbols = [...new Set(allSymbols)];

                // Fetch transactions for each symbol
                const transactionPromises = uniqueSymbols.map(symbol =>
                    portfolioService.getStockTransactions(symbol).catch(() => ({ transactions: [] }))
                );
                const results = await Promise.all(transactionPromises);

                // Combine all transactions with stock info
                const combined = [];
                results.forEach((result, idx) => {
                    if (result.transactions) {
                        result.transactions.forEach(tx => {
                            combined.push({
                                ...tx,
                                stock_symbol: uniqueSymbols[idx]
                            });
                        });
                    }
                });

                // Sort by date descending
                combined.sort((a, b) => new Date(b.date) - new Date(a.date));
                setAllTransactions(combined);
            } catch (err) {
                console.error('Failed to fetch portfolio history:', err);
                setError('Failed to load portfolio history');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

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

    // Calculate totals and stock-wise summary
    let totalInvested = 0;
    let totalRealizedPL = 0;
    let totalCurrentValue = 0; // We might not have current price here for all past stocks easily without fetching
    let totalCurrentHolding = 0;

    // Group by stock
    const stockSummary = {};

    allTransactions.forEach(tx => {
        if (!stockSummary[tx.stock_symbol]) {
            stockSummary[tx.stock_symbol] = {
                symbol: tx.stock_symbol,
                totalBuyQty: 0,
                totalSellQty: 0,
                totalInvested: 0,
                realizedPL: 0,
                // We'll calculate holding from buy - sell
            };
        }

        if (tx.type === 'BUY') {
            stockSummary[tx.stock_symbol].totalBuyQty += tx.quantity;
            stockSummary[tx.stock_symbol].totalInvested += parseFloat(tx.total);
            totalInvested += parseFloat(tx.total);
        } else {
            stockSummary[tx.stock_symbol].totalSellQty += tx.quantity;
            stockSummary[tx.stock_symbol].realizedPL += parseFloat(tx.realized_pl || 0);
            totalRealizedPL += parseFloat(tx.realized_pl || 0);
        }

        // Track last transaction date
        const txDate = new Date(tx.date);
        if (!stockSummary[tx.stock_symbol].lastTransactionDate || txDate > new Date(stockSummary[tx.stock_symbol].lastTransactionDate)) {
            stockSummary[tx.stock_symbol].lastTransactionDate = tx.date;
        }
    });

    // Filter and prepare display list
    const summaryList = Object.values(stockSummary)
        .map(stock => {
            const holding = stock.totalBuyQty - stock.totalSellQty;
            totalCurrentHolding += holding;
            return {
                ...stock,
                currentHolding: holding,
                isPast: holding <= 0
            };
        })
        .filter(stock => showPast ? true : !stock.isPast)
        .sort((a, b) => new Date(b.lastTransactionDate) - new Date(a.lastTransactionDate));

    return (
        <div>


            {/* Header */}
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
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Portfolio History</h1>
                    <p className="text-gray-500 dark:text-gray-400">Summary of all your trading activity</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Stocks Traded</p>
                    <p className="text-2xl font-bold dark:text-white">{summaryList.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Current Holding</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalCurrentHolding}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Invested (Lifetime)</p>
                    <p className="text-2xl font-bold dark:text-white">Rs. {totalInvested.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Realized P/L</p>
                    <p className={`text-2xl font-bold ${totalRealizedPL > 0 ? 'text-green-500' : totalRealizedPL < 0 ? 'text-red-500' : 'text-blue-500'
                        }`}>
                        Rs. {totalRealizedPL.toLocaleString()}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Cash Balance</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        Rs. {parseFloat(portfolio?.cash_balance || 0).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Past Transactions Toggle */}
            <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showPast}
                        onChange={(e) => setShowPast(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">Show Past Transactions (Fully Sold)</span>
                </label>
            </div>

            {/* Stock Summary Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <h3 className="px-6 py-4 font-bold text-lg text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
                    Stock Summary
                </h3>
                {summaryList.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        No trading history found
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Stock</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Current Holding</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Net Invested</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Realized P/L</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Last Transaction</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {summaryList.map((stock) => (
                                    <tr key={stock.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                            {stock.symbol}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-blue-600 dark:text-blue-400">
                                            {stock.currentHolding}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium dark:text-white">
                                            Rs. {stock.totalInvested.toLocaleString()}
                                        </td>
                                        <td className={`px-6 py-4 text-sm font-bold ${stock.realizedPL > 0 ? 'text-green-500' : stock.realizedPL < 0 ? 'text-red-500' : 'text-blue-500'
                                            }`}>
                                            {stock.realizedPL ? `Rs. ${stock.realizedPL.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(stock.lastTransactionDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => navigate(`/portfolio/history/${stock.symbol}`)}
                                                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
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
            </div>
        </div>
    );
};

export default PortfolioHistory;
