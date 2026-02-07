import axios from 'axios';

const API_URL = '/api/alerts';

const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const alertService = {
    // Get all alerts for current user
    getAlerts: async () => {
        const response = await axios.get(`${API_URL}/`, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // Create a new price alert
    createAlert: async (stockSymbol, targetPrice, alertType) => {
        const response = await axios.post(`${API_URL}/`, {
            stock_symbol: stockSymbol,
            target_price: targetPrice,
            alert_type: alertType
        }, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // Delete an alert
    deleteAlert: async (alertId) => {
        await axios.delete(`${API_URL}/${alertId}/`, {
            headers: getAuthHeaders()
        });
    },

    // Update an alert
    updateAlert: async (alertId, targetPrice, alertType) => {
        const response = await axios.patch(`${API_URL}/${alertId}/`, {
            target_price: targetPrice,
            alert_type: alertType
        }, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // Get notifications
    getNotifications: async () => {
        const response = await axios.get(`${API_URL}/notifications/`, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // Mark notifications as read
    markNotificationsRead: async (ids = []) => {
        const response = await axios.post(`${API_URL}/notifications/read/`, { ids }, {
            headers: getAuthHeaders()
        });
        return response.data;
    }
};
