import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WatchlistMarker from '../../components/common/WatchlistMarker';

const StockDetail = () => {
    const { symbol } = useParams();
    const navigate = useNavigate();

    // Mock stock object for WatchlistMarker (since this page is mostly a stub currently)
    const stock = { symbol, id: symbol };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-6 flex items-center gap-2 font-bold">
                ← Back
            </button>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
                <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-4">
                        <WatchlistMarker stock={stock} />
                        <div>
                            <h1 className="text-4xl font-black text-gray-800 dark:text-white mb-2">{symbol}</h1>
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-lg text-sm font-bold">Commercial Bank</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-black text-green-500">Rs. 450.00</p>
                        <p className="font-bold text-green-600">+1.2%</p>
                    </div>
                </div>

                <div className="p-12 bg-gray-50 dark:bg-gray-900 rounded-2xl text-center text-gray-400 font-bold border-2 border-dashed border-gray-200 dark:border-gray-700">
                    Chart and detailed fundamentals will appear here.
                </div>

                <div className="mt-8 flex gap-4">
                    <button
                        onClick={() => navigate('/trading', { state: { mode: 'buy', symbol } })}
                        className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors"
                    >
                        Buy {symbol}
                    </button>
                    <button
                        onClick={() => navigate('/trading', { state: { mode: 'sell', symbol } })}
                        className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors"
                    >
                        Sell {symbol}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StockDetail;
