import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Check authentication status on mount
    useEffect(() => {
        checkAuth();

        // Add axios interceptor for 401 responses
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // Prevent interception on login or refresh endpoints to avoid infinite loops
                if (originalRequest.url?.includes('/login') || originalRequest.url?.includes('/refresh')) {
                    return Promise.reject(error);
                }

                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;
                    const refreshToken = localStorage.getItem('refresh_token');

                    if (refreshToken) {
                        try {
                            const response = await axios.post('/api/accounts/token/refresh/', {
                                refresh: refreshToken
                            });

                            const newAccessToken = response.data.access;
                            localStorage.setItem('access_token', newAccessToken);

                            // Update Authorization header for the retried request
                            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                            return axios(originalRequest);
                        } catch (refreshError) {
                            console.error('Token refresh failed', refreshError);
                            logout();
                            return Promise.reject(refreshError);
                        }
                    } else {
                        logout();
                    }
                } else if (error.response?.status === 401) {
                    // It was 401, but we already tried to retry or no refresh logic applies
                    logout();
                }

                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []);

    const checkAuth = async () => {
        const accessToken = localStorage.getItem('access_token');
        if (accessToken) {
            try {
                const payload = JSON.parse(atob(accessToken.split('.')[1]));

                // Check if token is expired
                const currentTime = Date.now() / 1000;
                if (payload.exp && payload.exp < currentTime) {
                    console.warn('Token expired');
                    logout();
                    setIsLoading(false);
                    return;
                }

                // Fetch full profile info
                try {
                    const response = await axios.get('/api/accounts/profile/', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    setUser(response.data);
                    setIsAuthenticated(true);
                } catch (err) {
                    console.error('Failed to fetch profile', err);
                    // Fallback to minimal info if profile fetch fails
                    setUser({ id: payload.user_id });
                    setIsAuthenticated(true);
                }
            } catch (e) {
                console.error('Invalid token', e);
                logout();
            }
        }
        setIsLoading(false);
    };

    const login = async (username, password) => {
        try {
            const response = await axios.post('/api/accounts/login/', { username, password });
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);

            // Fetch profile info immediately after login
            const profileResponse = await axios.get('/api/accounts/profile/', {
                headers: { Authorization: `Bearer ${response.data.access}` }
            });
            setUser(profileResponse.data);
            setIsAuthenticated(true);

            return { success: true };
        } catch (error) {
            console.error('Login error', error);
            return {
                success: false,
                error: error.response?.data?.detail || 'Invalid credentials'
            };
        }
    };

    const register = async (name, username, email, password) => {
        try {
            await axios.post('/api/accounts/register/', { name, username, email, password });
            return { success: true };
        } catch (error) {
            console.error('Register error', error);
            return {
                success: false,
                error: error.response?.data || 'Registration failed'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        setIsAuthenticated(false);
    };

    const getAccessToken = () => {
        return localStorage.getItem('access_token');
    };

    const refreshProfile = async () => {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) return;
        try {
            const response = await axios.get('/api/accounts/profile/', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setUser(response.data);
        } catch (err) {
            console.error('Failed to refresh profile', err);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            isLoading,
            login,
            register,
            logout,
            getAccessToken,
            refreshProfile
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
