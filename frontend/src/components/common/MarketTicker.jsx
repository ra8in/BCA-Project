import { useState, useEffect, useMemo } from 'react';
import { stockService } from '../../services/stockService';

const MarketTicker = ({ selectedSectorId = null }) => {
    const [sectors, setSectors] = useState([]);
    const [indices, setIndices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [sectorsData, indicesData] = await Promise.all([
                    stockService.getSectors(),
                    stockService.getMarketIndices()
                ]);
                setSectors(sectorsData);
                setIndices(indicesData);
            } catch (err) {
                console.error("Failed to load ticker data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Prepare ticker items
    const nepseIndex = useMemo(() =>
        indices.find(i => i.symbol === 'NEPSE' || i.name.toLowerCase().includes('nepse')),
        [indices]
    );

    // Sort sectors by change_percent (highest to lowest)
    const sortedSectors = useMemo(() =>
        [...sectors]
            .filter(s => s.subindex)
            .sort((a, b) => parseFloat(b.subindex.change_percent) - parseFloat(a.subindex.change_percent)),
        [sectors]
    );

    // Filter sectors based on selectedSectorId
    const displayedSectors = useMemo(() => {
        if (selectedSectorId) {
            return sortedSectors.filter(s => s.id === parseInt(selectedSectorId));
        }
        return sortedSectors;
    }, [sortedSectors, selectedSectorId]);

    if (loading) {
        return (
            <div className="flex gap-3 animate-pulse mb-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded-lg h-14 w-44"></div>
                ))}
            </div>
        );
    }

    // Ticker Item Component
    const TickerItem = ({ label, value, change, changePercent }) => {
        const val = parseFloat(changePercent);
        const colorClass = val > 0 ? 'text-green-600' : val < 0 ? 'text-red-500' : 'text-blue-500';

        return (
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow-sm border border-gray-100 dark:border-gray-700 min-w-[160px]">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase truncate">{label}</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-black text-gray-900 dark:text-white text-sm">
                        {parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`text-xs font-bold ${colorClass}`}>
                        {val > 0 ? '+' : ''}{val.toFixed(2)}%
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex overflow-x-auto gap-3 pb-2 mb-4 scrollbar-hide">
            {nepseIndex && (
                <TickerItem
                    label="NEPSE"
                    value={nepseIndex.current_value}
                    change={nepseIndex.change}
                    changePercent={nepseIndex.change_percent}
                />
            )}
            {displayedSectors.map(sector => (
                <TickerItem
                    key={sector.id}
                    label={sector.subindex?.name || sector.name}
                    value={sector.subindex?.current_value || 0}
                    change={sector.subindex?.change || 0}
                    changePercent={sector.subindex?.change_percent || 0}
                />
            ))}
        </div>
    );
};

export default MarketTicker;
