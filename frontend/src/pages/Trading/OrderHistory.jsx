import React from 'react';

const OrderHistory = () => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mt-8">
            <h3 className="text-xl font-black mb-6 dark:text-white">Order History</h3>
            <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">BUY</span>
                            <span className="font-bold text-gray-800 dark:text-white">NABIL</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Today, 10:23 AM</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-gray-800 dark:text-white">10 @ 450</p>
                        <p className="text-xs text-gray-500">Completed</p>
                    </div>
                </div>
                {/* Placeholder items */}
                <div className="text-center py-6 text-gray-400 font-medium border-t border-dashed border-gray-200 dark:border-gray-800 mt-4">
                    Showing last 30 days
                </div>
            </div>
        </div>
    );
};

export default OrderHistory;
