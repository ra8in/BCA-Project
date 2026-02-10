import React, { useContext, useMemo } from 'react';
import { MarketContext } from '../../context/MarketContext';

const TickerItem = ({ label, data }) => {
    if (!data) return null;
    const isUp = parseFloat(data.change) >= 0;
    return (
        <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
            <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-sm text-gray-900 dark:text-white">
                    {parseFloat(data.current_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-[10px] font-bold ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isUp ? '+' : ''}{parseFloat(data.change).toFixed(2)} <span className="opacity-75">({parseFloat(data.change_percent).toFixed(2)}%)</span>
                </span>
            </div>
        </div>
    );
};

const MarketRibbon = () => {
    const { nepseIndex, currentSector, subIndices, currentStock } = useContext(MarketContext);

    // If no data yet, render empty or skeleton? Let's render empty to avoid layout shift if possible, or nothing.
    // User wants it "top 0". 
    // Sort sectors by performance (High to Low) to show Top Gaining first
    const sortedIndices = useMemo(() => {
        if (!subIndices) return [];
        return [...subIndices]
            .filter(s => s.symbol !== 'NEPSE' && !s.name?.toUpperCase().includes('NEPSE'))
            .sort((a, b) =>
                (parseFloat(b.change_percent) || 0) - (parseFloat(a.change_percent) || 0)
            );
    }, [subIndices]);

    if (!nepseIndex) return null;

    return (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-4 sticky top-0 z-50 shadow-sm mb-0 overflow-x-auto scrollbar-hide whitespace-nowrap">
            <div className="flex-shrink-0">
                <TickerItem label="NEPSE" data={nepseIndex} />
            </div>

            {currentSector ? (
                <>
                    <div className="hidden md:block w-px h-3 bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>
                    <div className="flex-shrink-0 animate-in fade-in slide-in-from-left-2">
                        <TickerItem label={currentSector.sector_name || 'Sector'} data={currentSector} />
                    </div>
                    {currentStock && (
                        <>
                            <div className="hidden md:block w-px h-3 bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>
                            <div className="flex-shrink-0 animate-in fade-in slide-in-from-left-2">
                                <TickerItem
                                    label={currentStock.symbol}
                                    data={{ ...currentStock, current_value: currentStock.last_price }}
                                />
                            </div>
                        </>
                    )}
                </>
            ) : (
                // Show All Sectors (Sorted)
                sortedIndices.length > 0 && sortedIndices.map((sector, i) => (
                    <React.Fragment key={sector.id || i}>
                        <div className="hidden md:block w-px h-3 bg-gray-300 dark:bg-gray-600 flex-shrink-0 opacity-50"></div>
                        <div className="flex-shrink-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors cursor-default relative group py-0.5 px-1">
                            {i === 0 && (
                                <span className="absolute -top-1.5 left-0 right-0 text-[8px] text-center text-green-600 font-extrabold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                    Top
                                </span>
                            )}
                            <TickerItem
                                label={sector.sector_name || sector.name}
                                data={sector}
                            />
                        </div>
                    </React.Fragment>
                ))
            )}
        </div>
    );
};

export default MarketRibbon;
