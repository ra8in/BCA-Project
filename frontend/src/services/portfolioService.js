import axios from 'axios';

const API_URL = '/api/portfolio';

// Get auth token from localStorage
const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const portfolioService = {
    // Get complete portfolio with summary
    getPortfolio: async () => {
        try {
            const response = await axios.get(`${API_URL}/`, {
                headers: getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error("Get Portfolio Error:", error);
            throw error;
        }
    },

    // Get holdings list only
    getHoldings: async () => {
        try {
            const response = await axios.get(`${API_URL}/holdings/`, {
                headers: getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error("Get Holdings Error:", error);
            throw error;
        }
    },

    // Buy stock
    buyStock: async (symbol, quantity, type = 'MARKET', price = null) => {
        try {
            const response = await axios.post(`${API_URL}/buy/`,
                { symbol, quantity, type, price },
                { headers: getAuthHeaders() }
            );
            return response.data;
        } catch (error) {
            console.error("Buy Stock Error:", error);
            throw error;
        }
    },

    // Sell stock
    sellStock: async (symbol, quantity, type = 'MARKET', price = null) => {
        try {
            const response = await axios.post(`${API_URL}/sell/`,
                { symbol, quantity, type, price },
                { headers: getAuthHeaders() }
            );
            return response.data;
        } catch (error) {
            console.error("Sell Stock Error:", error);
            throw error;
        }
    },

    // Get orders
    getOrders: async (status = 'active') => {
        try {
            const response = await axios.get(`${API_URL}/orders/?status=${status}`, {
                headers: getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error("Get Orders Error:", error);
            throw error;
        }
    },

    // Update order
    updateOrder: async (orderId, updates) => {
        try {
            const response = await axios.post(`${API_URL}/orders/${orderId}/update/`, updates, {
                headers: getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error("Update Order Error:", error);
            throw error;
        }
    },

    // Cancel order
    cancelOrder: async (orderId) => {
        try {
            const response = await axios.post(`${API_URL}/orders/${orderId}/cancel/`, {}, {
                headers: getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error("Cancel Order Error:", error);
            throw error;
        }
    },

    // Get portfolio history
    getHistory: async () => {
        try {
            const response = await axios.get(`${API_URL}/history/`, {
                headers: getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error("Get History Error:", error);
            throw error;
        }
    },

    // Get past holdings (stocks completely sold)
    getPastHoldings: async () => {
        try {
            const response = await axios.get(`${API_URL}/past-holdings/`, {
                headers: getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error("Get Past Holdings Error:", error);
            throw error;
        }
    },

    // Get specific stock transaction history
    getStockTransactions: async (symbol) => {
        try {
            const response = await axios.get(`${API_URL}/transactions/${symbol}/`, {
                headers: getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error("Get Stock Transactions Error:", error);
            throw error;
        }
    }
};
