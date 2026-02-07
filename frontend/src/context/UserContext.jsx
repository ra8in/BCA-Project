import { createContext, useState, useEffect } from 'react';
import initialUserData from '../data/user.json';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
    // Load from LocalStorage or use initial data
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('user_data');
        return savedUser ? JSON.parse(savedUser) : initialUserData;
    });

    const [holdings, setHoldings] = useState(() => {
        const savedHoldings = localStorage.getItem('user_holdings');
        return savedHoldings ? JSON.parse(savedHoldings) : [];
    });

    // Save to LocalStorage whenever state changes
    useEffect(() => {
        localStorage.setItem('user_data', JSON.stringify(user));
        localStorage.setItem('user_holdings', JSON.stringify(holdings));
    }, [user, holdings]);

    const buyStock = (stock, quantity) => {
        const cost = stock.price * quantity;

        if (user.cash_balance < cost) {
            return { success: false, message: "Insufficient Funds" };
        }

        // Deduct Balance
        setUser(prev => ({
            ...prev,
            cash_balance: prev.cash_balance - cost
        }));

        // Add to Holdings
        setHoldings(prev => {
            const existing = prev.find(h => h.symbol === stock.symbol);
            if (existing) {
                return prev.map(h =>
                    h.symbol === stock.symbol
                        ? { ...h, quantity: Number(h.quantity) + Number(quantity) }
                        : h
                );
            } else {
                return [...prev, {
                    symbol: stock.symbol,
                    name: stock.name,
                    quantity: Number(quantity),
                    avg_buy_price: stock.price,
                    current_value: stock.price * quantity // Initial value matches cost
                }];
            }
        });

        return { success: true, message: `Successfully bought ${quantity} shares of ${stock.symbol}` };
    };

    return (
        <UserContext.Provider value={{ user, holdings, buyStock }}>
            {children}
        </UserContext.Provider>
    );
};
