import { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * MarketStatusIndicator - Shows a green/red dot indicating market open/close status
 */
const MarketStatusIndicator = ({ collapsed = false }) => {
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
        <div className={`flex items-center gap-6 px-6 h-[54px] transition-all overflow-hidden`} title={status?.message}>
            {/* Pulsing dot container (aligned tightly but wrapped in 24px box) */}
            <div className="w-6 flex justify-center flex-shrink-0">
                <div className="relative">
                    <div className={`w-3 h-3 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    {isOpen && (
                        <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-75"></div>
                    )}
                </div>
            </div>

            {/* Status text */}
            {!collapsed && (
                <div className="flex flex-col flex-1 overflow-hidden">
                    <span className={`text-xs font-bold whitespace-nowrap overflow-hidden text-ellipsis ${isOpen ? 'text-green-400' : 'text-red-400'}`}>
                        {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
                    </span>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">
                        {status?.trading_hours}
                    </span>
                </div>
            )}
        </div>
    );
};

export default MarketStatusIndicator;
