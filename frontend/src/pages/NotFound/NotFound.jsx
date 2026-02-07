import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-center px-4">
            <h1 className="text-9xl font-black text-blue-100 dark:text-blue-900">404</h1>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-4 mb-2">Page Not Found</h2>
            <p className="text-gray-500 max-w-md mb-8">The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.</p>
            <Link to="/" className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-transform hover:scale-105 shadow-lg shadow-blue-500/30">
                Go to Dashboard
            </Link>
        </div>
    );
};

export default NotFound;
