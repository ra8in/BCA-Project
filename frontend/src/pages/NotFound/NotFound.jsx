import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-8 animate-in fade-in duration-500">
            <h1 className="text-9xl font-black text-gray-200 dark:text-gray-700 select-none">404</h1>
            <div className="-mt-12 backdrop-blur-sm">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mt-4">Page Not Found</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2 mb-8 max-w-md mx-auto">
                    The page you are looking for doesn't exist or has been moved.
                </p>

                <div className="flex gap-4 justify-center">
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30"
                    >
                        Go Home
                    </button>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
