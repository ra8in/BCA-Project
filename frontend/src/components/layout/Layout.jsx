import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MarketRibbon from '../common/MarketRibbon';

const Layout = ({ children }) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 font-sans">
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <main className="flex-1 overflow-y-auto h-screen bg-gray-50 text-gray-900 dark:text-gray-100 dark:bg-gray-800 relative">
                <Topbar />
                <MarketRibbon />
                <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
