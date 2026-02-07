import { createContext, useState, useEffect } from 'react';
import { stockService } from '../services/stockService';

export const MarketContext = createContext();

export const MarketProvider = ({ children }) => {
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStocks = async () => {
            try {
                // Fetch real data from backend
                const data = await stockService.getAllStocks();
                setStocks(data);
            } catch (err) {
                console.error("Failed to fetch market data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStocks();
    }, []);

    return (
        <MarketContext.Provider value={{ stocks, loading }}>
            {children}
        </MarketContext.Provider>
    );
};
