import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Settings = () => {
    const { user, isAuthenticated, getAccessToken, logout, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('account');
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [displayName, setDisplayName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [saveStatus, setSaveStatus] = useState(''); // '', 'saving', 'saved', 'error'
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);

    // Password Change State
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [pwdChangeStatus, setPwdChangeStatus] = useState(''); // '', 'changing', 'changed', 'error'
    const [pwdChangeError, setPwdChangeError] = useState('');
    const [showPwdConfirm, setShowPwdConfirm] = useState(false);

    // Delete Account State
    const [showDeleteFinalConfirm, setShowDeleteFinalConfirm] = useState(false);

    // Fund Request State
    const [fundAmount, setFundAmount] = useState('');
    const [fundReason, setFundReason] = useState('');
    const [fundRequestStatus, setFundRequestStatus] = useState(''); // '', 'submitting', 'success', 'error'
    const [fundRequestError, setFundRequestError] = useState('');
    const [fundRequests, setFundRequests] = useState([]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchFundRequests();
        }
    }, [isAuthenticated]);

    const fetchFundRequests = async () => {
        try {
            const response = await axios.get('/api/accounts/request-money/', {
                headers: { Authorization: `Bearer ${getAccessToken()}` }
            });
            setFundRequests(response.data);
        } catch (err) {
            console.error('Failed to fetch fund requests', err);
        }
    };

    const handleRequestFunds = async () => {
        setFundRequestStatus('submitting');
        setFundRequestError('');
        try {
            await axios.post('/api/accounts/request-money/',
                { amount: fundAmount, reason: fundReason },
                { headers: { Authorization: `Bearer ${getAccessToken()}`, 'Content-Type': 'application/json' } }
            );
            setFundRequestStatus('success');
            setFundAmount('');
            setFundReason('');
            fetchFundRequests(); // Refresh list
            setTimeout(() => setFundRequestStatus(''), 3000);
        } catch (err) {
            setFundRequestStatus('error');
            setFundRequestError(err.response?.data?.amount?.[0] || 'Failed to submit request.');
            setTimeout(() => setFundRequestStatus(''), 4000);
        }
    };

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        // In a real app, this would trigger a theme change in the root component
        document.documentElement.classList.toggle('dark');
    };

    const handlePasswordChange = async () => {
        setPwdChangeError('');
        setPwdChangeStatus('changing');
        try {
            await axios.patch('/api/accounts/profile/password/',
                { old_password: oldPassword, new_password: newPassword },
                { headers: { Authorization: `Bearer ${getAccessToken()}`, 'Content-Type': 'application/json' } }
            );
            setPwdChangeStatus('changed');
            setOldPassword('');
            setNewPassword('');
            setTimeout(() => setPwdChangeStatus(''), 3000);
        } catch (err) {
            setPwdChangeStatus('error');
            setPwdChangeError(err.response?.data?.old_password?.[0] || err.response?.data?.new_password?.[0] || 'Failed to update password.');
            setTimeout(() => setPwdChangeStatus(''), 4000);
        }
    };

    const handleSaveProfile = async () => {
        setSaveStatus('saving');
        try {
            await axios.patch('/api/accounts/profile/',
                { name: displayName, email: email },
                { headers: { Authorization: `Bearer ${getAccessToken()}`, 'Content-Type': 'application/json' } }
            );
            if (refreshProfile) await refreshProfile();
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(''), 2000);
        } catch (err) {
            console.error('Failed to save profile', err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(''), 3000);
        }
    };

    const handleDeleteAccount = async () => {
        setDeleteError('');
        try {
            await axios.delete('/api/accounts/profile/', {
                headers: { Authorization: `Bearer ${getAccessToken()}` },
                data: { password: deletePassword }
            });
            logout();
            navigate('/');
        } catch (err) {
            setDeleteError(err.response?.data?.error || 'Failed to delete account. Please check your password.');
        }
    };

    const tabs = [
        { id: 'account', label: 'Account', icon: 'fa-user' },
        { id: 'appearance', label: 'Appearance', icon: 'fa-palette' },
        { id: 'security', label: 'Security', icon: 'fa-shield-alt' },
        { id: 'notifications', label: 'Notifications', icon: 'fa-bell' }
    ];

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 text-gray-400">
                    <i className="fas fa-cog text-3xl fa-spin-slow"></i>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Settings Locked</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">Please log in to access your account preferences and settings.</p>
                <a href="/login" className="mt-8 px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-purple-600/20">
                    Sign In
                </a>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-8 tracking-tight">Settings</h1>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 space-y-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black tracking-tight transition-all duration-200 ${activeTab === tab.id
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                                : 'bg-white dark:bg-[#1E1E24] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                        >
                            <i className={`fas ${tab.icon} w-5`}></i>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 bg-white dark:bg-[#1E1E24] rounded-[2.5rem] border border-gray-200 dark:border-gray-800 shadow-xl shadow-gray-200/10 dark:shadow-none overflow-hidden">
                    <div className="p-8 md:p-10">
                        {activeTab === 'account' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Account Profile</h3>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">Manage your public information and account details.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Display Name</label>
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            placeholder="John Doe"
                                            className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Username</label>
                                        <input
                                            type="text"
                                            defaultValue={user?.username || ''}
                                            disabled
                                            className="w-full bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl px-5 py-4 text-gray-500 dark:text-gray-500 font-bold cursor-not-allowed"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4">
                                    {!showSaveConfirm ? (
                                        <button
                                            onClick={() => setShowSaveConfirm(true)}
                                            className="px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black tracking-tight hover:scale-[1.02] transition-all active:scale-[0.98]"
                                        >
                                            Save Changes
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                            <span className="text-sm font-bold text-gray-900 dark:text-white mr-2">Confirm changes?</span>
                                            <button
                                                onClick={() => {
                                                    setShowSaveConfirm(false);
                                                    handleSaveProfile();
                                                }}
                                                disabled={saveStatus === 'saving'}
                                                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-black tracking-tight hover:bg-purple-700 transition-all disabled:opacity-50"
                                            >
                                                {saveStatus === 'saving' ? 'Saving...' : 'Yes, Save'}
                                            </button>
                                            <button
                                                onClick={() => setShowSaveConfirm(false)}
                                                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-black hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                    {saveStatus === 'saved' && <span className="text-green-500 font-bold text-sm block mt-4"><i className="fas fa-check mr-1"></i>Saved successfully</span>}
                                    {saveStatus === 'error' && <span className="text-red-500 font-bold text-sm block mt-4"><i className="fas fa-times mr-1"></i>Failed to save</span>}
                                </div>

                                {/* Request Funds Section */}
                                <div className="pt-8 mt-8 border-t border-gray-100 dark:border-gray-800">
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Request Virtual Funds</h3>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium mb-6">Need more paper trading balance? Send a request to the administrator.</p>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Amount (Rs.)</label>
                                                <input
                                                    type="number"
                                                    value={fundAmount}
                                                    onChange={(e) => setFundAmount(e.target.value)}
                                                    placeholder="Enter Amount"
                                                    className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Reason (Optional)</label>
                                                <input
                                                    type="text"
                                                    value={fundReason}
                                                    onChange={(e) => setFundReason(e.target.value)}
                                                    placeholder="e.g. For new strategy testing"
                                                    className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-2 flex items-center">
                                            <button
                                                onClick={handleRequestFunds}
                                                disabled={fundRequestStatus === 'submitting' || !fundAmount}
                                                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-600/20 text-sm"
                                            >
                                                {fundRequestStatus === 'submitting' ? 'Submitting...' : 'Submit Request'}
                                            </button>
                                            {fundRequestStatus === 'success' && <span className="text-green-500 font-bold text-sm ml-4"><i className="fas fa-check mr-1"></i>Submitted Successfully</span>}
                                            {fundRequestStatus === 'error' && <span className="text-red-500 font-bold text-sm ml-4"><i className="fas fa-times mr-1"></i>{fundRequestError}</span>}
                                        </div>

                                        {fundRequests.length > 0 && (
                                            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                                                <h4 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Recent Requests</h4>
                                                <div className="space-y-3">
                                                    {fundRequests.map(req => (
                                                        <div key={req.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                                            <div>
                                                                <p className="font-bold text-gray-900 dark:text-white">Rs. {Number(req.amount).toLocaleString()}</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(req.created_at).toLocaleDateString()} {req.reason && `- ${req.reason}`}</p>
                                                            </div>
                                                            <span className={`px-3 py-1 rounded-lg text-xs font-bold ${req.status === 'Approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                                req.status === 'Rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                                }`}>
                                                                {req.status}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Appearance</h3>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">Customize how the platform looks on your device.</p>
                                </div>

                                <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-900 dark:text-white shadow-sm">
                                            <i className={`fas ${theme === 'dark' ? 'fa-moon' : 'fa-sun'} text-xl`}></i>
                                        </div>
                                        <div>
                                            <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter">Theme Mode</h4>
                                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Currently using {theme} mode</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={toggleTheme}
                                        className={`w-14 h-8 rounded-full p-1 transition-all duration-300 flex items-center ${theme === 'dark' ? 'bg-purple-600' : 'bg-gray-200'
                                            }`}
                                    >
                                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
                                            }`}></div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Security</h3>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">Update your password and secure your account.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Current Password</label>
                                        <input
                                            type="password"
                                            value={oldPassword}
                                            onChange={(e) => setOldPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">New Password</label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                        />
                                    </div>
                                    {pwdChangeError && <p className="text-red-500 text-sm font-bold">{pwdChangeError}</p>}
                                    {pwdChangeStatus === 'changed' && <p className="text-green-500 text-sm font-bold"><i className="fas fa-check mr-1"></i>Password updated successfully!</p>}
                                </div>

                                <div className="pt-4">
                                    {!showPwdConfirm ? (
                                        <button
                                            onClick={() => setShowPwdConfirm(true)}
                                            disabled={!oldPassword || !newPassword || pwdChangeStatus === 'changing'}
                                            className="px-8 py-4 bg-purple-600 text-white rounded-2xl font-black tracking-tight hover:scale-[1.02] transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50"
                                        >
                                            {pwdChangeStatus === 'changing' ? 'Updating...' : 'Update Password'}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-200">
                                            <span className="text-sm font-bold text-gray-900 dark:text-white mr-2">Update password?</span>
                                            <button
                                                onClick={() => {
                                                    setShowPwdConfirm(false);
                                                    handlePasswordChange();
                                                }}
                                                disabled={pwdChangeStatus === 'changing'}
                                                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-black tracking-tight hover:bg-purple-700 transition-all disabled:opacity-50"
                                            >
                                                Yes, Update
                                            </button>
                                            <button
                                                onClick={() => setShowPwdConfirm(false)}
                                                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-black hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Delete Account */}
                                <div className="pt-8 mt-8 border-t border-gray-100 dark:border-gray-800">
                                    <h4 className="font-black text-gray-900 dark:text-white mb-2">Delete Account</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-4">Once you delete your account, all your data will be permanently removed. This cannot be undone.</p>

                                    {!showDeleteConfirm ? (
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="px-6 py-3 bg-red-600 text-white rounded-2xl font-black tracking-tight hover:bg-red-700 transition-all"
                                        >
                                            Delete My Account
                                        </button>
                                    ) : (
                                        <div className="space-y-4 p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">Enter your password to confirm:</p>
                                            <input
                                                type="password"
                                                value={deletePassword}
                                                onChange={(e) => setDeletePassword(e.target.value)}
                                                placeholder="Your password"
                                                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-red-500 outline-none"
                                            />
                                            {deleteError && <p className="text-red-500 text-sm font-bold">{deleteError}</p>}
                                            {!showDeleteFinalConfirm ? (
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => setShowDeleteFinalConfirm(true)}
                                                        disabled={!deletePassword}
                                                        className="px-6 py-3 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 transition-all disabled:opacity-50"
                                                    >
                                                        Proceed
                                                    </button>
                                                    <button
                                                        onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); }}
                                                        className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-black hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/40">
                                                    <span className="text-sm font-bold text-red-700 dark:text-red-400 flex-1">Are you absolutely sure?</span>
                                                    <button
                                                        onClick={handleDeleteAccount}
                                                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-black hover:bg-red-700 transition-all text-sm"
                                                    >
                                                        Yes, Delete
                                                    </button>
                                                    <button
                                                        onClick={() => setShowDeleteFinalConfirm(false)}
                                                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-black hover:bg-gray-300 dark:hover:bg-gray-600 transition-all text-sm"
                                                    >
                                                        No
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Notifications</h3>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">Choose what alerts you want to receive.</p>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { id: 'price', label: 'Price Alerts', desc: 'Notify me when stocks hit my targets' },
                                        { id: 'trade', label: 'Trade Executions', desc: 'Confirmations for buy and sell orders' },
                                        { id: 'news', label: 'Market News', desc: 'Daily summaries of important news' }
                                    ].map(item => (
                                        <div key={item.id} className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                            <div>
                                                <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter">{item.label}</h4>
                                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{item.desc}</p>
                                            </div>
                                            <button className="w-14 h-8 bg-purple-600 rounded-full p-1 transition-all duration-300 flex items-center">
                                                <div className="w-6 h-6 bg-white rounded-full shadow-md translate-x-6"></div>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
