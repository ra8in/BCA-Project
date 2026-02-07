import React from 'react';

const Holdings = () => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-xl font-black mb-6 dark:text-white">Your Holdings</h3>
            <table className="w-full text-left">
                <thead>
                    <tr className="text-xs font-bold text-gray-400 uppercase border-b dark:border-gray-700">
                        <th className="pb-3">Symbol</th>
                        <th className="pb-3 text-right">Qty</th>
                        <th className="pb-3 text-right">LTP</th>
                        <th className="pb-3 text-right">Value</th>
                        <th className="pb-3 text-right">P/L</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    <tr className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="py-4 font-bold text-gray-800 dark:text-white">NABIL</td>
                        <td className="py-4 text-right text-gray-600 dark:text-gray-300">100</td>
                        <td className="py-4 text-right font-bold text-gray-800 dark:text-white">450.00</td>
                        <td className="py-4 text-right text-gray-600 dark:text-gray-300">45,000</td>
                        <td className="py-4 text-right font-bold text-green-500">+1,200</td>
                    </tr>
                    {/* Placeholder row */}
                    <tr>
                        <td colSpan="5" className="py-8 text-center text-gray-400 font-medium">
                            No more holdings found.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default Holdings;
