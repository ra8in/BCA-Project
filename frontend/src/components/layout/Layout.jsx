import Sidebar from './Sidebar';
import MarketRibbon from '../common/MarketRibbon';

const Layout = ({ children }) => {
    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 font-sans">
            <Sidebar />
            <main className="flex-1 overflow-y-auto h-screen bg-gray-50 text-gray-900 dark:text-gray-100 dark:bg-gray-800 relative">
                <MarketRibbon />
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
