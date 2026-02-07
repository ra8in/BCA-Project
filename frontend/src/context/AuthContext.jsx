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
            (error) => {
                if (error.response?.status === 401) {
                    logout();
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []);

    const checkAuth = () => {
        const accessToken = localStorage.getItem('access_token');
        if (accessToken) {
            try {
                const payload = JSON.parse(atob(accessToken.split('.')[1]));

                // Check if token is expired
                const currentTime = Date.now() / 1000;
                if (payload.exp && payload.exp < currentTime) {
                    // Token expired
                    console.warn('Token expired');
                    logout();
                    setIsLoading(false); // Ensure loading stops
                    return;
                }

                setUser({ id: payload.user_id });
                setIsAuthenticated(true);
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

            // Decode JWT to get user info
            const payload = JSON.parse(atob(response.data.access.split('.')[1]));
            setUser({ id: payload.user_id });
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

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            isLoading,
            login,
            register,
            logout,
            getAccessToken
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
