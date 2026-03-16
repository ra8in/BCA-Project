import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import Market from './pages/Market/Market';
import Portfolio from './pages/Portfolio/Portfolio';
import Alerts from './pages/Alerts/Alerts';
import Calculators from './pages/Calculators/Calculators';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Trading from './pages/Trading/Trading';

// Context providers
import { MarketProvider } from './context/MarketContext';
import { UserProvider } from './context/UserContext';
import { AuthProvider } from './context/AuthContext';

// Components
import ProtectedRoute from './components/common/ProtectedRoute';

import MarketMovers from './pages/MarketMovers/MarketMovers';
import StockDetail from './pages/StockDetail/StockDetail';
import StockHistory from './pages/Portfolio/StockHistory';
import PortfolioHistory from './pages/Portfolio/PortfolioHistory';
import Profile from './pages/Profile/Profile';
import Settings from './pages/Settings/Settings';
import NotFound from './pages/NotFound/NotFound';

function App() {
  return (
    <Router>
      <AuthProvider>
        <MarketProvider>
          <UserProvider>
            <Routes>
              {/* Auth Routes */}
              <Route path="/login" element={<Layout><Login /></Layout>} />
              <Route path="/register" element={<Layout><Register /></Layout>} />

              {/* Public Routes - Accessible without login (with limited features) */}
              <Route path="/" element={<Layout><Dashboard /></Layout>} />
              <Route path="/market" element={<Layout><Market /></Layout>} />
              <Route path="/market/:tab" element={<Layout><MarketMovers /></Layout>} />
              <Route path="/stock/:symbol" element={<Layout><StockDetail /></Layout>} />
              <Route path="/calculators" element={<Layout><Calculators /></Layout>} />

              {/* Protected Routes - Require login */}
              <Route path="/portfolio" element={
                <ProtectedRoute>
                  <Layout><Portfolio /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/portfolio/history" element={
                <ProtectedRoute>
                  <Layout><PortfolioHistory /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/portfolio/history/:symbol" element={
                <ProtectedRoute>
                  <Layout><StockHistory /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/alerts" element={
                <ProtectedRoute>
                  <Layout><Alerts /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/trading" element={
                <ProtectedRoute>
                  <Layout><Trading /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/trading/:symbol" element={
                <ProtectedRoute>
                  <Layout><Trading /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Layout><Profile /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Layout><Settings /></Layout>
                </ProtectedRoute>
              } />

              {/* 404 Catch All */}
              <Route path="*" element={<Layout><NotFound /></Layout>} />
            </Routes>
          </UserProvider>
        </MarketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
