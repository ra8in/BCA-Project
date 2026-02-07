import axios from 'axios';

// Create a configured axios instance (or reuse existing one in api.js if you have it)
const API_URL = '/api/calculators';

// Helper to handle API errors
const handleApiError = (error) => {
    if (error.response) {
        console.error('Data Error:', error.response.data);
        throw error.response.data;
    } else {
        console.error('API Error:', error.message);
        throw new Error("Network Error or Server Down");
    }
};

export const calculatorService = {
    calculateBuySell: async (data) => {
        try {
            const response = await axios.post(`${API_URL}/buy-sell/`, data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    calculateAdjustment: async (data) => {
        try {
            const response = await axios.post(`${API_URL}/adjustment/`, data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    calculateDividend: async (data) => {
        try {
            const response = await axios.post(`${API_URL}/dividend/`, data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    calculateAveraging: async (rows) => {
        try {
            const response = await axios.post(`${API_URL}/averaging/`, { rows });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    }
};
