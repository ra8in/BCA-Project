import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { portfolioService } from '../../services/portfolioService';
import axios from 'axios';

const Profile = () => {
    const { user, isAuthenticated, getAccessToken, refreshProfile } = useAuth();
    const [stats, setStats] = useState({
        balance: 0,
        invested: 0,
        profit: 0,
        profitPercent: 0
    });
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isAuthenticated) {
            portfolioService.getPortfolio()
                .then(data => {
                    if (data) {
                        setStats({
                            balance: parseFloat(data.cash_balance || 0),
                            invested: parseFloat(data.invested_amount || 0),
                            profit: parseFloat(data.total_profit_loss || 0),
                            profitPercent: parseFloat(data.total_profit_loss_percent || 0)
                        });
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Failed to fetch portfolio stats', err);
                    setLoading(false);
                });
        }
    }, [isAuthenticated]);

    const handlePictureUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('profile_picture', file);

        try {
            await axios.put('/api/accounts/profile/picture/', formData, {
                headers: {
                    Authorization: `Bearer ${getAccessToken()}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            // Refresh profile to get the new picture URL
            if (refreshProfile) await refreshProfile();
        } catch (err) {
            console.error('Failed to upload picture', err);
        }
        setUploading(false);
    };

    const handleRemovePicture = async () => {
        setUploading(true);
        try {
            await axios.delete('/api/accounts/profile/picture/', {
                headers: { Authorization: `Bearer ${getAccessToken()}` }
            });
            if (refreshProfile) await refreshProfile();
        } catch (err) {
            console.error('Failed to remove picture', err);
        }
        setUploading(false);
    };

    const avatarUrl = user?.profile_picture
        ? user.profile_picture
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || user?.username || 'User')}&background=C388F7&color=fff&size=256&bold=true&font-size=0.33`;

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 text-gray-400">
                    <i className="fas fa-user-lock text-3xl"></i>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Private Profile</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">Please log in to view and manage your profile settings.</p>
                <a href="/login" className="mt-8 px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-purple-600/20">
                    Sign In
                </a>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Profile Header Card */}
            <div className="relative overflow-hidden bg-white dark:bg-[#1E1E24] rounded-[2.5rem] border border-gray-200 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-none p-8 md:p-12">
                {/* Decorative background */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/10 dark:bg-purple-500/5 blur-[100px] rounded-full"></div>

                <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-12">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                        <img
                            src={avatarUrl}
                            alt="Profile"
                            className="relative w-32 h-32 md:w-44 md:h-44 rounded-full object-cover border-4 border-white dark:border-gray-900 shadow-2xl"
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePictureUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="absolute bottom-2 right-2 w-10 h-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-purple-600 transition-colors shadow-lg disabled:opacity-50"
                        >
                            <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-camera'} text-sm`}></i>
                        </button>
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                            <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
                                {user?.name || user?.username || 'Trader'}
                            </h1>
                        </div>
                        <p className="text-xl text-gray-500 dark:text-gray-400 font-medium mb-6 flex items-center justify-center md:justify-start gap-2">
                            <i className="far fa-envelope text-gray-400"></i>
                            {user?.email || 'email@example.com'}
                        </p>

                        <div className="flex flex-wrap justify-center md:justify-start gap-4">
                            <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-2">
                                <span className="text-gray-400 font-bold text-xs uppercase tracking-tighter">Username</span>
                                <span className="text-gray-900 dark:text-white font-black">@{user?.username}</span>
                            </div>
                        </div>

                        {/* Remove picture button */}
                        {user?.profile_picture && (
                            <div className="mt-4">
                                {!showRemoveConfirm ? (
                                    <button
                                        onClick={() => setShowRemoveConfirm(true)}
                                        disabled={uploading}
                                        className="text-sm text-red-500 hover:text-red-600 font-bold transition-colors disabled:opacity-50"
                                    >
                                        <i className="fas fa-trash-alt mr-1.5"></i>
                                        Remove Profile Picture
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
                                        <span className="text-sm font-bold text-red-600 dark:text-red-400">Remove profile picture?</span>
                                        <button
                                            onClick={() => { handleRemovePicture(); setShowRemoveConfirm(false); }}
                                            disabled={uploading}
                                            className="px-4 py-1.5 bg-red-600 text-white text-xs font-black rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
                                        >
                                            Yes, Remove
                                        </button>
                                        <button
                                            onClick={() => setShowRemoveConfirm(false)}
                                            className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-black rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Stats Columns */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Invested Card */}
                    <div className="bg-white dark:bg-[#1E1E24] rounded-[2rem] border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600">
                                <i className="fas fa-chart-pie text-xl"></i>
                            </div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Invested Value</h3>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Total Investment</span>
                            <div className="text-3xl font-black text-gray-900 dark:text-white">
                                Rs. {stats.invested.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Balance Card */}
                    <div className="bg-white dark:bg-[#1E1E24] rounded-[2rem] border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-green-600">
                                <i className="fas fa-wallet text-xl"></i>
                            </div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Free Balance</h3>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Available Cash</span>
                            <div className="text-3xl font-black text-gray-900 dark:text-white">
                                Rs. {stats.balance.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Performance Card */}
                    <div className="md:col-span-2 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-[2rem] p-8 md:p-10 text-white shadow-2xl shadow-purple-600/20">
                        <div className="flex justify-between items-start">
                            <div className="space-y-4">
                                <h3 className="text-lg font-black uppercase tracking-widest opacity-80">Portfolio Performance</h3>
                                <div className="space-y-1">
                                    <div className="text-5xl md:text-6xl font-black">
                                        {stats.profit >= 0 ? '+' : ''}Rs. {Math.abs(stats.profit).toLocaleString()}
                                    </div>
                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 font-black text-sm ${stats.profitPercent >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                        <i className={`fas fa-caret-${stats.profitPercent >= 0 ? 'up' : 'down'}`}></i>
                                        {Math.abs(stats.profitPercent).toFixed(2)}% All-Time
                                    </div>
                                </div>
                            </div>
                            <div className="hidden md:block">
                                <div className="w-24 h-24 bg-white/10 rounded-3xl backdrop-blur-md flex items-center justify-center">
                                    <i className="fas fa-rocket text-4xl"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Account Details Card */}
                <div className="bg-white dark:bg-[#1E1E24] rounded-[2rem] border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight mb-8">Personal Details</h3>

                    <div className="space-y-8">
                        <Link to="/settings" className="block space-y-1.5 font-medium transition-all group cursor-pointer">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 group-hover:text-purple-500">Full Name</span>
                            <p className="text-gray-900 dark:text-white flex justify-between items-center transition-all">
                                <span>{user?.name || 'Not Set'}</span>
                                <i className="fas fa-angle-right text-gray-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"></i>
                            </p>
                        </Link>

                        <Link to="/settings" className="block space-y-1.5 font-medium transition-all group cursor-pointer">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 group-hover:text-purple-500">Email Address</span>
                            <p className="text-gray-900 dark:text-white flex justify-between items-center transition-all">
                                <span>{user?.email}</span>
                                <i className="fas fa-angle-right text-gray-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"></i>
                            </p>
                        </Link>

                        <div className="pt-6 border-t border-gray-50 dark:border-gray-800">
                            <Link to="/settings" className="flex items-center justify-center gap-3 w-full py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-900 dark:text-white font-black tracking-tight hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
                                <i className="fas fa-user-cog text-gray-400"></i>
                                Manage Account
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
