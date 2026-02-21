import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockService } from '../../services/stockService';
import StockSearchInput from '../../components/common/StockSearchInput';
import WatchlistMarker from '../../components/common/WatchlistMarker';
import { MarketContext } from '../../context/MarketContext';


const Market = () => {
    const [stocks, setStocks] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [indices, setIndices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSector, setSelectedSector] = useState(null);
    const [viewMode, setViewMode] = useState('stocks'); // 'stocks', 'sectors', 'indices'
    const [isMarketOpen, setIsMarketOpen] = useState(false);
    const navigate = useNavigate();
    const { updateSector } = useContext(MarketContext);

    // Fetch market status on mount
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
    }, []);

    // Fetch sectors and indices on mount + auto-refresh aligned to the clock
    useEffect(() => {
        const fetchData = async () => {
            const [sectorsData, indicesData] = await Promise.all([
                stockService.getSectors(),
                stockService.getMarketIndices()
            ]);
            setSectors(sectorsData);
            setIndices(indicesData);
        };
        fetchData();

        // Auto-refresh indices/sectors aligned to the minute (at :01 seconds) during market hours
        let timeoutId;

        const scheduleNextFetch = () => {
            if (!isMarketOpen) return;

            const now = new Date();
            // Wait until next minute exactly (HH:MM:00)
            // If we are currently at 14:00:00.005, this waits ~59995ms
            const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

            timeoutId = setTimeout(() => {
                fetchData();
                scheduleNextFetch(); // Schedule the next one recursively
            }, msUntilNextMinute);
        };

        if (isMarketOpen) {
            scheduleNextFetch();
        }

        return () => { if (timeoutId) clearTimeout(timeoutId); };
    }, [isMarketOpen]);

    // Fetch stocks when sector filter changes + auto-refresh aligned to the clock
    useEffect(() => {
        const fetchStocks = async () => {
            setLoading(true);
            const data = await stockService.getAllStocks(selectedSector);
            setStocks(data);
            setLoading(false);
        };
        fetchStocks();

        // Auto-refresh stocks aligned to the minute (at :01 seconds) during market hours
        let timeoutId;

        const scheduleNextFetch = () => {
            if (!isMarketOpen) return;

            const now = new Date();
            // Wait until next minute exactly (HH:MM:00)
            const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

            timeoutId = setTimeout(() => {
                fetchStocks();
                scheduleNextFetch();
            }, msUntilNextMinute);
        };

        if (isMarketOpen) {
            scheduleNextFetch();
        }

        return () => { if (timeoutId) clearTimeout(timeoutId); };
    }, [selectedSector, isMarketOpen]);
    // Sync selected sector with Global Ribbon
    useEffect(() => {
        if (selectedSector) {
            const sector = sectors.find(s => s.id === parseInt(selectedSector));
            if (sector) {
                updateSector(sector.name);
            }
        } else {
            updateSector(null);
        }
        return () => updateSector(null);
    }, [selectedSector, sectors, updateSector]);

    const handleStockClick = (symbol) => {
        navigate(`/stock/${symbol}`);
    };

    const handleSectorClick = (sectorId) => {
        setSelectedSector(sectorId);
        setViewMode('stocks');
    };

    if (loading && stocks.length === 0) return <div className="p-8 text-center text-xl">Loading Market Data...</div>;

    return (
        <div>


            <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">Market</h2>

            {/* Controls Row */}
            <div className="flex flex-wrap gap-4 mb-6 items-center">
                {/* View Mode Toggle - Always first, fixed position */}
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <button
                        onClick={() => { setViewMode('indices'); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'indices' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}
                    >
                        Indices
                    </button>
                    <button
                        onClick={() => setViewMode('sectors')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'sectors' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}
                    >
                        Sub-Indices
                    </button>
                    <button
                        onClick={() => { setViewMode('stocks'); setSelectedSector(null); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'stocks' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}
                    >
                        Stocks
                    </button>
                </div>

                {/* Search - Only shows in Stocks view */}
                {viewMode === 'stocks' && (
                    <div className="flex-1 min-w-[250px] max-w-md">
                        <StockSearchInput
                            placeholder="Search by symbol or name..."
                            disablePopup={true}
                            onSelect={(stock) => {
                                // Click on item → Navigate to stock detail
                                navigate(`/stock/${stock.symbol}`);
                            }}
                            onTypingFilter={async (filteredResults) => {
                                // Live filter while typing
                                if (filteredResults === null) {
                                    // Reset to all stocks (or current sector)
                                    setLoading(true);
                                    const data = await stockService.getAllStocks(selectedSector);
                                    setStocks(data);
                                    setLoading(false);
                                } else {
                                    setStocks(filteredResults);
                                }
                            }}
                        />
                    </div>
                )}

                {/* Sector Filter Dropdown (visible in stocks view) */}
                {viewMode === 'stocks' && (
                    <select
                        value={selectedSector || ''}
                        onChange={(e) => setSelectedSector(e.target.value || null)}
                        className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
                    >
                        <option value="">All Sectors</option>
                        {sectors.map(sector => (
                            <option key={sector.id} value={sector.id}>{sector.name}</option>
                        ))}
                    </select>
                )}

                {/* Manual Refresh Button */}
                <button
                    onClick={async () => {
                        setLoading(true);
                        const data = await stockService.getAllStocks(selectedSector);
                        setStocks(data);
                        // Also refresh indices and sectors if in those modes
                        if (viewMode === 'indices') {
                            const indicesData = await stockService.getMarketIndices();
                            setIndices(indicesData);
                        } else if (viewMode === 'sectors') {
                            const sectorsData = await stockService.getSectors();
                            setSectors(sectorsData);
                        }
                        setLoading(false);
                    }}
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-500"
                    title="Refresh Data"
                >
                    <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* Main Market Indices View */}
            {viewMode === 'indices' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {indices.map(index => (
                        <div
                            key={index.id}
                            className="bg-white dark:bg-gray-700 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-600"
                        >
                            <div className="flex flex-col">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">{index.name}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{index.symbol}</p>
                                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                    {parseFloat(index.current_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                                <p className={`text-sm font-bold ${parseFloat(index.change) > 0 ? 'text-green-500' : parseFloat(index.change) < 0 ? 'text-red-500' : 'text-blue-500'
                                    }`}>
                                    {parseFloat(index.change) > 0 ? '+' : ''}{parseFloat(index.change).toFixed(2)} ({parseFloat(index.change_percent).toFixed(2)}%)
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Sub-Indices (Sectors) View */}
            {viewMode === 'sectors' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sectors.map(sector => {
                        const subindex = sector.subindex;
                        return (
                            <div
                                key={sector.id}
                                onClick={() => handleSectorClick(sector.id)}
                                className="bg-white dark:bg-gray-700 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-600 cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
                            >
                                <div className="flex flex-col h-full justify-between">
                                    <div className="mb-4">
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
                                            {subindex ? subindex.name : sector.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {sector.name} • {sector.stock_count} Stocks
                                        </p>
                                    </div>
                                    {subindex ? (
                                        <div className="flex items-center justify-between mt-auto">
                                            <div>
                                                <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                                    {parseFloat(subindex.current_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </p>
                                                <p className={`text-xs font-bold ${parseFloat(subindex.change) > 0 ? 'text-green-500' : parseFloat(subindex.change) < 0 ? 'text-red-500' : 'text-blue-500'
                                                    }`}>
                                                    {parseFloat(subindex.change) > 0 ? '+' : ''}{parseFloat(subindex.change).toFixed(2)} ({parseFloat(subindex.change_percent).toFixed(2)}%)
                                                </p>
                                            </div>
                                            <div className="bg-blue-50 dark:bg-blue-900/50 p-2 rounded-lg">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400">No sub-index data</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Stocks Table */}
            {viewMode === 'stocks' && (
                <div className="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden">
                    {selectedSector && (
                        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/30 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                                Filtering by: {sectors.find(s => s.id === parseInt(selectedSector))?.name || 'Sector'}
                            </span>
                            <button
                                onClick={() => setSelectedSector(null)}
                                className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                            >
                                Clear Filter
                            </button>
                        </div>
                    )}
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-4 py-4 text-gray-600 dark:text-gray-300 font-medium text-sm w-12"></th>
                                <th className="px-4 py-4 text-gray-600 dark:text-gray-300 font-medium text-sm">Symbol</th>
                                <th className="px-4 py-4 text-gray-600 dark:text-gray-300 font-medium text-sm">Company</th>
                                <th className="px-4 py-4 text-gray-600 dark:text-gray-300 font-medium text-sm">Sector</th>
                                <th className="px-4 py-4 text-gray-600 dark:text-gray-300 font-medium text-sm">Price</th>
                                <th className="px-4 py-4 text-gray-600 dark:text-gray-300 font-medium text-sm">Change</th>
                                <th className="px-4 py-4 text-gray-600 dark:text-gray-300 font-medium text-sm">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-600">
                            {stocks.map(stock => (
                                <tr key={stock.id} className="hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                                    <td className="px-4 py-4">
                                        <WatchlistMarker stock={stock} />
                                    </td>
                                    <td
                                        className="px-4 py-4 font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                                        onClick={() => handleStockClick(stock.symbol)}
                                    >
                                        {stock.symbol}
                                    </td>
                                    <td
                                        className="px-4 py-4 text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                                        onClick={() => handleStockClick(stock.symbol)}
                                    >
                                        {stock.name}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{stock.sector_name || '-'}</td>
                                    <td className="px-4 py-4 font-medium dark:text-white">Rs. {parseFloat(stock.last_price).toLocaleString()}</td>
                                    <td className={`px-4 py-4 font-medium ${parseFloat(stock.change) > 0 ? 'text-green-500' : parseFloat(stock.change) < 0 ? 'text-red-500' : 'text-blue-500'
                                        }`}>
                                        {parseFloat(stock.change) > 0 ? '+' : ''}{parseFloat(stock.change_percent).toFixed(2)}%
                                    </td>
                                    <td className="px-4 py-4">
                                        <button
                                            onClick={() => navigate('/trading', { state: { mode: 'buy', symbol: stock.symbol } })}
                                            className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Trade
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {stocks.length === 0 && !loading && (
                        <div className="text-center py-12 text-gray-500">No stocks found for this sector.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Market;
