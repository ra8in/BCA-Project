import { useState, useContext } from 'react';
import { UserContext } from '../../context/UserContext';

const BuyModal = ({ stock, onClose }) => {
    const { buyStock, user } = useContext(UserContext);
    const [quantity, setQuantity] = useState(10);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const totalCost = stock.price * quantity;
    const canAfford = user.cash_balance >= totalCost;

    const handleBuy = () => {
        if (!canAfford) {
            setError("Insufficient funds");
            return;
        }

        const result = buyStock(stock, quantity);
        if (result.success) {
            setSuccess(result.message);
            setTimeout(() => {
                onClose();
            }, 1500);
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Buy {stock.symbol}</h3>
                <p className="text-sm text-gray-500 mb-6">{stock.name}</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price per Share</label>
                        <div className="text-lg font-bold dark:text-white">₹{stock.price}</div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
                        <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:text-white"
                        />
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>
                            <span className="font-bold text-xl dark:text-white">₹{totalCost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Available Balance:</span>
                            <span className={canAfford ? 'text-green-600' : 'text-red-500'}>
                                ₹{user.cash_balance.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    {success && <p className="text-green-500 text-sm text-center">{success}</p>}

                    <div className="flex gap-4 mt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleBuy}
                            disabled={!canAfford || quantity <= 0}
                            className={`flex-1 py-2 px-4 rounded-lg text-white font-medium ${canAfford ? 'bg-primary-600 hover:bg-primary-700' : 'bg-gray-400 cursor-not-allowed'
                                }`}
                        >
                            Confirm Buy
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuyModal;
