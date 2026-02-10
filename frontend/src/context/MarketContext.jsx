import { createContext, useState, useEffect } from 'react';
import { stockService } from '../services/stockService';

export const MarketContext = createContext();

export const MarketProvider = ({ children }) => {
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [nepseIndex, setNepseIndex] = useState(null);
    const [subIndices, setSubIndices] = useState([]);
    const [currentSector, setCurrentSector] = useState(null); // The specific sector index to display
    const [currentStock, setCurrentStock] = useState(null); // The specific stock to display

    // Function to update the displayed sector on the ribbon
    const updateSector = (sectorName) => {
        if (!sectorName || subIndices.length === 0) {
            setCurrentSector(null);
            return;
        }
        const found = subIndices.find(s => s.sector_name === sectorName);
        setCurrentSector(found || null);
    };

    // Function to update the displayed stock on the ribbon
    const updateStock = (stock) => {
        setCurrentStock(stock);
    };

    useEffect(() => {
        const fetchStocks = async () => {
            try {
                // Fetch real data from backend
                const [stocksData, indicesBig, indicesSmall] = await Promise.all([
                    stockService.getAllStocks(),
                    stockService.getMarketIndices(),
                    stockService.getSubIndices()
                ]);

                setStocks(stocksData);
                setSubIndices(indicesSmall);

                const nepse = indicesBig.find(i => i.symbol === 'NEPSE' || i.name.toLowerCase().includes('nepse'));
                setNepseIndex(nepse || null);
            } catch (err) {
                console.error("Failed to fetch market data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStocks();
    }, []);

    return (
        <MarketContext.Provider value={{
            stocks,
            loading,
            nepseIndex,
            currentSector,
            updateSector,
            currentStock,
            updateStock,
            subIndices // Expose full list if needed
        }}>
            {children}
        </MarketContext.Provider>
    );
};
