import { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * MarketStatusIndicator - Shows a green/red dot indicating market open/close status
 */
const MarketStatusIndicator = () => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                // Use relative path since proxy is likely configured in vite, or valid relative path
                const response = await axios.get('/api/stocks/market-status/');
                setStatus(response.data);
            } catch (error) {
                console.error('Failed to fetch market status:', error);
                setStatus({ is_open: false, message: 'Unable to fetch status' });
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();

        // Refresh every minute
        const interval = setInterval(fetchStatus, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-3 h-3 rounded-full bg-gray-500 animate-pulse"></div>
                <span className="text-xs text-gray-400">Loading...</span>
            </div>
        );
    }

    const isOpen = status?.is_open;

    return (
        <div className="flex items-center gap-2 px-3 py-2" title={status?.message}>
            {/* Pulsing dot */}
            <div className="relative">
                <div className={`w-3 h-3 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
                {isOpen && (
                    <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-75"></div>
                )}
            </div>

            {/* Status text */}
            <div className="flex flex-col">
                <span className={`text-xs font-bold ${isOpen ? 'text-green-400' : 'text-red-400'}`}>
                    {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
                </span>
                <span className="text-[10px] text-gray-500">
                    {status?.trading_hours}
                </span>
            </div>
        </div>
    );
};

export default MarketStatusIndicator;
