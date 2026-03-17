import { useState, useEffect } from 'react';
import StockSearchInput from '../../components/common/StockSearchInput';
import { alertService } from '../../services/alertService';
import MarketTicker from '../../components/common/MarketTicker';

const Alerts = () => {
    const [alerts, setAlerts] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [selectedStock, setSelectedStock] = useState(null);
    const [targetPrice, setTargetPrice] = useState('');
    const [alertType, setAlertType] = useState('ABOVE');
    const [creating, setCreating] = useState(false);

    // Inline popup state
    const [activePopup, setActivePopup] = useState({ id: null, type: null });
    const [editPrice, setEditPrice] = useState('');
    const [editType, setEditType] = useState('ABOVE');

    // Toast notification
    const [toast, setToast] = useState({ show: false, message: '', type: 'error' });

    const showToast = (message, type = 'error') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 5000);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [alertsData, notificationsData] = await Promise.all([
                    alertService.getAlerts(),
                    alertService.getNotifications()
                ]);
                setAlerts(alertsData);
                setNotifications(notificationsData);
            } catch (err) {
                console.error('Failed to fetch alerts:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleCreateAlert = async () => {
        if (!selectedStock || !targetPrice) return;

        const price = parseFloat(targetPrice);
        const currentPrice = parseFloat(selectedStock.last_price);

        // Validation
        if (alertType === 'BELOW' && price >= currentPrice) {
            showToast(`Target must be BELOW Rs. ${currentPrice}`, 'error');
            return;
        }
        if (alertType === 'ABOVE' && price <= currentPrice) {
            showToast(`Target must be ABOVE Rs. ${currentPrice}`, 'error');
            return;
        }

        setCreating(true);
        try {
            const newAlert = await alertService.createAlert(selectedStock.symbol, price, alertType);
            setAlerts(prev => [newAlert, ...prev]);
            setSelectedStock(null);
            setTargetPrice('');
            showToast('Alert created successfully!', 'success');
        } catch (err) {
            console.error('Failed to create alert:', err);
            showToast('Failed to create alert', 'error');
        } finally {
            setCreating(false);
        }
    };

    const openEdit = (alert) => {
        setEditPrice(alert.target_price);
        setEditType(alert.alert_type);
        setActivePopup({ id: alert.id, type: 'edit' });
    };

    const openDelete = (alertId) => {
        setActivePopup({ id: alertId, type: 'delete' });
    };

    const closePopup = () => setActivePopup({ id: null, type: null });

    const handleUpdate = async (alertId) => {
        try {
            const updated = await alertService.updateAlert(alertId, parseFloat(editPrice), editType);
            setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));
            closePopup();
        } catch (err) {
            console.error('Update failed:', err);
        }
    };

    const handleDelete = async (alertId) => {
        try {
            await alertService.deleteAlert(alertId);
            setAlerts(prev => prev.filter(a => a.id !== alertId));
            closePopup();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 relative">
            {/* Toast Notification */}
            {toast.show && (
                <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg font-bold text-sm animate-in fade-in slide-in-from-right-4 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                    }`}>
                    {toast.message}
                </div>
            )}

            <h2 className="text-3xl font-black mb-8 text-gray-800 dark:text-gray-100">Price Alerts</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Create Alert Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">Create New Alert</h3>
                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Stock</label>
                            <StockSearchInput
                                placeholder="Search Symbol"
                                initialValue={selectedStock?.symbol || ''}
                                onSelect={(stock) => setSelectedStock(stock)}
                            />
                            {/* Show LTP prominently after selection */}
                            {selectedStock && (
                                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Current LTP</span>
                                        <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                                            Rs. {parseFloat(selectedStock.last_price).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Type</label>
                            <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
                                {['ABOVE', 'BELOW'].map(t => (
                                    <button key={t} onClick={() => setAlertType(t)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold ${alertType === t ? 'bg-white dark:bg-gray-700 shadow' : 'text-gray-400'}`}>
                                        {t === 'ABOVE' ? 'Above' : 'Below'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Target Price</label>
                            <input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)}
                                placeholder="Enter Price" className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 font-bold outline-none" />
                        </div>
                        <button onClick={handleCreateAlert} disabled={creating || !selectedStock || !targetPrice}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">
                            {creating ? 'Creating...' : 'Set Alert'}
                        </button>
                    </div>
                </div>

                {/* Alerts List */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">Your Alerts</h3>
                    {alerts.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">No alerts set</div>
                    ) : (
                        <div className="space-y-3">
                            {alerts.map(alert => (
                                <div key={alert.id} className="relative">
                                    {/* Small inline popup */}
                                    {activePopup.id === alert.id && (
                                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-700 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 p-3 z-10">
                                            {activePopup.type === 'delete' ? (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm text-gray-600 dark:text-gray-300">Delete?</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={closePopup} className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 rounded-lg font-bold">No</button>
                                                        <button onClick={() => handleDelete(alert.id)} className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg font-bold">Yes</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="flex gap-2">
                                                        <select value={editType} onChange={(e) => setEditType(e.target.value)}
                                                            className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-600 font-bold">
                                                            <option value="ABOVE">Above</option>
                                                            <option value="BELOW">Below</option>
                                                        </select>
                                                        <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                                                            className="w-24 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-600 font-bold" />
                                                    </div>
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={closePopup} className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 rounded font-bold">Cancel</button>
                                                        <button onClick={() => handleUpdate(alert.id)} className="px-3 py-1 text-sm bg-blue-500 text-white rounded font-bold">Save</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Alert card */}
                                    <div className={`flex justify-between items-center p-3 rounded-xl border ${alert.is_active ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 bg-gray-50 dark:bg-gray-900/50'}`}>
                                        <div>
                                            <span className="font-black">{alert.symbol}</span>
                                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-bold ${alert.alert_type === 'ABOVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {alert.alert_type}
                                            </span>
                                            <span className="ml-2 text-sm text-gray-500">Rs. {alert.target_price}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            {alert.is_active && (
                                                <button onClick={() => openEdit(alert)} className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-blue-500 transition-colors" title="Edit Alert">
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                            )}
                                            <button onClick={() => openDelete(alert.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-red-500 transition-colors" title="Delete Alert">
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Notifications */}
            {notifications.length > 0 && (
                <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-bold mb-4">Notifications</h3>
                    <div className="space-y-2">
                        {notifications.slice(0, 5).map(n => (
                            <div key={n.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/30 text-sm">
                                <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 mr-2">{n.notification_type}</span>
                                {n.message}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Alerts;
