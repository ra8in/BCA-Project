import axios from 'axios';

const API_URL = '/api/stocks';

export const stockService = {
    search: async (query) => {
        try {
            if (!query) return [];
            const response = await axios.get(`${API_URL}/search/?q=${query}`);
            return response.data;
        } catch (error) {
            console.error("Stock Search Error:", error);
            return [];
        }
    },

    getDetail: async (symbol) => {
        try {
            const response = await axios.get(`${API_URL}/${symbol}/`);
            return response.data;
        } catch (error) {
            console.error("Stock Detail Error:", error);
            throw error;
        }
    },

    getAllStocks: async (sectorId = null) => {
        try {
            const url = sectorId ? `${API_URL}/?sector=${sectorId}` : `${API_URL}/`;
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            console.error("Get All Stocks Error:", error);
            return [];
        }
    },

    getSectors: async () => {
        try {
            const response = await axios.get(`${API_URL}/sectors/`);
            return response.data;
        } catch (error) {
            console.error("Get Sectors Error:", error);
            return [];
        }
    },

    getSubIndices: async () => {
        try {
            const response = await axios.get(`${API_URL}/sub-indices/`);
            return response.data;
        } catch (error) {
            console.error("Get Sub-Indices Error:", error);
            return [];
        }
    },

    getMarketIndices: async () => {
        try {
            const response = await axios.get(`${API_URL}/indices/`);
            return response.data;
        } catch (error) {
            console.error("Get Market Indices Error:", error);
            return [];
        }
    },

    getTopGainers: async (params = {}) => {
        try {
            const response = await axios.get(`${API_URL}/top-gainers/`, { params });
            return response.data;
        } catch (error) {
            console.error("Get Top Gainers Error:", error);
            return [];
        }
    },

    getTopLosers: async (params = {}) => {
        try {
            const response = await axios.get(`${API_URL}/top-losers/`, { params });
            return response.data;
        } catch (error) {
            console.error("Get Top Losers Error:", error);
            return [];
        }
    },

    getTopTurnover: async (params = {}) => {
        try {
            const response = await axios.get(`${API_URL}/top-turnover/`, { params });
            return response.data;
        } catch (error) {
            console.error("Get Top Turnover Error:", error);
            return [];
        }
    }
};
