import axios from 'axios';

const API_URL = '/api/portfolio';

// Get auth token from localStorage
const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const watchlistService = {
    // ==================== GROUP MANAGEMENT ====================

    // Get all user's watchlist groups
    getGroups: async () => {
        const response = await axios.get(`${API_URL}/watchlist/groups/`, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // Create a new watchlist group
    createGroup: async (name) => {
        const response = await axios.post(`${API_URL}/watchlist/groups/`, { name }, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // Delete a watchlist group
    deleteGroup: async (groupId) => {
        const response = await axios.delete(`${API_URL}/watchlist/groups/${groupId}/`, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // Rename a watchlist group
    updateGroup: async (groupId, name) => {
        const response = await axios.patch(`${API_URL}/watchlist/groups/${groupId}/`, { name }, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // ==================== ITEM MANAGEMENT ====================

    // Get items in a specific group
    getItems: async (groupId) => {
        const response = await axios.get(`${API_URL}/watchlist/items/?group=${groupId}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // Add stock to a specific group
    addItem: async (groupId, stockId, notes = '') => {
        const response = await axios.post(`${API_URL}/watchlist/items/`, {
            group: groupId,
            stock: stockId,
            notes
        }, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // Remove item from watchlist
    removeItem: async (itemId) => {
        const response = await axios.delete(`${API_URL}/watchlist/items/${itemId}/`, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // Check if stock is in any watchlist (returns list of items where this stock appears)
    checkStockStatus: async (stockId) => {
        const response = await axios.get(`${API_URL}/watchlist/items/?stock=${stockId}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    }
};

export default watchlistService;
