import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Clock, 
  Pill, 
  Trash2, 
  CheckCheck, 
  RefreshCw, 
  Search, 
  ShieldAlert, 
  Sparkles, 
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

const NotificationCenter = () => {
  const { getToken } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  const fetchNotifs = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchNotifs();
    // Auto-refresh notifications every 20 seconds so missed doses & alerts stay live
    const interval = setInterval(() => {
      fetchNotifs(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  // Mark single notification as read/unread
  const handleToggleRead = async (id, currentStatus) => {
    // Optimistic UI update
    setNotifications(prev =>
      prev.map(n => (n._id === id ? { ...n, readStatus: !currentStatus } : n))
    );

    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success(currentStatus ? 'Marked as unread' : 'Marked as read', { duration: 1500 });
      } else {
        // Revert on error
        setNotifications(prev =>
          prev.map(n => (n._id === id ? { ...n, readStatus: currentStatus } : n))
        );
      }
    } catch (error) {
      console.error('Failed to toggle read status:', error);
      setNotifications(prev =>
        prev.map(n => (n._id === id ? { ...n, readStatus: currentStatus } : n))
      );
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    if (notifications.length === 0) return;
    const previous = [...notifications];
    setNotifications(prev => prev.map(n => ({ ...n, readStatus: true })));

    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('All alerts marked as read', { icon: '✅' });
      } else {
        setNotifications(previous);
        toast.error('Could not mark all as read');
      }
    } catch (error) {
      setNotifications(previous);
      toast.error('Network error');
    }
  };

  // Delete a single notification permanently from MongoDB Atlas
  const handleDeleteNotification = async (id, e) => {
    e.stopPropagation();
    const previous = [...notifications];
    setNotifications(prev => prev.filter(n => n._id !== id));

    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Alert permanently deleted', { duration: 2000 });
      } else {
        setNotifications(previous);
        toast.error('Failed to delete alert');
      }
    } catch (error) {
      setNotifications(previous);
      toast.error('Failed to delete alert');
    }
  };

  // Clear all read notifications permanently
  const handleClearRead = async () => {
    const unreadOnly = notifications.filter(n => !n.readStatus);
    if (notifications.length === unreadOnly.length) {
      toast('No read alerts to clear', { icon: 'ℹ️' });
      return;
    }

    const previous = [...notifications];
    setNotifications(unreadOnly);

    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications?onlyRead=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Cleared all read alerts');
      } else {
        setNotifications(previous);
        toast.error('Could not clear read alerts');
      }
    } catch (error) {
      setNotifications(previous);
      toast.error('Failed to clear read alerts');
    }
  };

  // Categorize notifications accurately
  const getAlertMetadata = (notif) => {
    const msg = (notif.message || '').toLowerCase();
    const cat = notif.category || '';
    const type = notif.type || '';

    // Missed Dose Alerts
    if (cat === 'missed_dose' || msg.includes('missed') || (type === 'Warning' && !msg.includes('caregiver'))) {
      return {
        badge: 'MISSED DOSE',
        badgeColor: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
        cardBorder: 'border-l-rose-500',
        glow: 'hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]',
        bgGradient: 'from-rose-500/5 to-transparent',
        icon: <AlertTriangle className="text-rose-500 w-5 h-5 shrink-0" />,
        priority: 'high',
        categoryKey: 'missed'
      };
    }

    // Caregiver Alerts
    if (cat === 'caregiver_alert' || msg.includes('caregiver')) {
      return {
        badge: 'CAREGIVER ALERT',
        badgeColor: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
        cardBorder: 'border-l-purple-500',
        glow: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]',
        bgGradient: 'from-purple-500/5 to-transparent',
        icon: <ShieldAlert className="text-purple-500 w-5 h-5 shrink-0" />,
        priority: 'high',
        categoryKey: 'caregiver'
      };
    }

    // Medicine Reminders
    if (cat === 'reminder' || msg.includes('reminder') || type === 'Alert') {
      return {
        badge: 'DOSE REMINDER',
        badgeColor: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
        cardBorder: 'border-l-amber-500',
        glow: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
        bgGradient: 'from-amber-500/5 to-transparent',
        icon: <Clock className="text-amber-500 w-5 h-5 shrink-0" />,
        priority: 'medium',
        categoryKey: 'reminder'
      };
    }

    // Doses Taken / Confirmations
    if (cat === 'dose_taken' || msg.includes('taken') || type === 'Success') {
      return {
        badge: 'CONFIRMED TAKEN',
        badgeColor: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
        cardBorder: 'border-l-emerald-500',
        glow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
        bgGradient: 'from-emerald-500/5 to-transparent',
        icon: <CheckCircle2 className="text-emerald-500 w-5 h-5 shrink-0" />,
        priority: 'low',
        categoryKey: 'taken'
      };
    }

    // Prescriptions Added
    if (cat === 'medicine_added' || msg.includes('added') || msg.includes('prescription')) {
      return {
        badge: 'PRESCRIPTION',
        badgeColor: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30',
        cardBorder: 'border-l-indigo-500',
        glow: 'hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]',
        bgGradient: 'from-indigo-500/5 to-transparent',
        icon: <Pill className="text-indigo-500 w-5 h-5 shrink-0" />,
        priority: 'low',
        categoryKey: 'prescription'
      };
    }

    // Default Info
    return {
      badge: 'SYSTEM NOTICE',
      badgeColor: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
      cardBorder: 'border-l-blue-500',
      glow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
      bgGradient: 'from-blue-500/5 to-transparent',
      icon: <Info className="text-blue-500 w-5 h-5 shrink-0" />,
      priority: 'low',
      categoryKey: 'info'
    };
  };

  // Compute metrics
  const stats = useMemo(() => {
    let unread = 0;
    let missed = 0;
    let reminders = 0;
    let taken = 0;

    notifications.forEach(n => {
      if (!n.readStatus) unread++;
      const meta = getAlertMetadata(n);
      if (meta.categoryKey === 'missed') missed++;
      if (meta.categoryKey === 'reminder') reminders++;
      if (meta.categoryKey === 'taken') taken++;
    });

    return {
      total: notifications.length,
      unread,
      missed,
      reminders,
      taken
    };
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notif => {
      // Unread only toggle
      if (filterUnreadOnly && notif.readStatus) return false;

      // Tab filter
      const meta = getAlertMetadata(notif);
      if (activeTab === 'missed' && meta.categoryKey !== 'missed' && meta.categoryKey !== 'caregiver') return false;
      if (activeTab === 'reminder' && meta.categoryKey !== 'reminder') return false;
      if (activeTab === 'taken' && meta.categoryKey !== 'taken') return false;
      if (activeTab === 'unread' && notif.readStatus) return false;
      if (activeTab === 'prescription' && meta.categoryKey !== 'prescription') return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesMsg = (notif.message || '').toLowerCase().includes(q);
        const matchesMed = (notif.medicineName || '').toLowerCase().includes(q);
        const matchesDosage = (notif.dosage || '').toLowerCase().includes(q);
        const matchesBadge = meta.badge.toLowerCase().includes(q);
        if (!matchesMsg && !matchesMed && !matchesDosage && !matchesBadge) return false;
      }

      return true;
    });
  }, [notifications, activeTab, filterUnreadOnly, searchQuery]);

  // Relative timestamp format
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden p-4 sm:p-6 md:p-10 lg:p-12">
      {/* Dynamic ambient background glow */}
      <div className="absolute top-10 right-10 w-[550px] h-[550px] bg-indigo-500/10 blur-[160px] rounded-full pointer-events-none -z-10"></div>
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-rose-500/10 blur-[150px] rounded-full pointer-events-none -z-10"></div>

      <div className="max-w-5xl mx-auto z-10 relative">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between mb-8">
          <Link 
            to="/dashboard" 
            className="inline-flex items-center gap-2 text-sm font-semibold text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            MongoDB Atlas Live Connected
          </div>
        </div>

        {/* Page Title & Main Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 border border-indigo-500/20 shadow-sm">
                <Bell className="w-7 h-7" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111] dark:text-white">
                Alerts & Notifications
              </h1>
            </div>
            <p className="text-black/60 dark:text-white/60 text-sm sm:text-base font-medium">
              Real-time dose reminders, missed medication warnings, and caregiver updates saved permanently in MongoDB.
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => fetchNotifs(false)}
              disabled={refreshing}
              title="Refresh alerts"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-[#1a1a24]/60 backdrop-blur-md hover:bg-black/5 dark:hover:bg-white/10 transition-all font-semibold text-sm shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-500' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handleMarkAllRead}
              disabled={stats.unread === 0}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-sm transition-all shadow-sm ${
                stats.unread > 0 
                  ? 'border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' 
                  : 'border-black/5 dark:border-white/5 opacity-50 cursor-not-allowed text-black/40 dark:text-white/40'
              }`}
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>

            <button
              onClick={handleClearRead}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-[#1a1a24]/60 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-500 transition-all font-semibold text-sm shadow-sm text-black/70 dark:text-white/70"
            >
              <Trash2 className="w-4 h-4" />
              Clear read
            </button>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="glass-card p-4 sm:p-5 rounded-2xl border border-black/5 dark:border-white/10 bg-white/40 dark:bg-[#161622]/40 backdrop-blur-md shadow-sm">
            <div className="flex items-center justify-between text-black/50 dark:text-white/50 text-xs font-bold uppercase tracking-wider mb-1">
              <span>Total Alerts</span>
              <Bell className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#111] dark:text-white">
              {stats.total}
            </div>
          </div>

          <div className="glass-card p-4 sm:p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 backdrop-blur-md shadow-sm">
            <div className="flex items-center justify-between text-rose-500 text-xs font-bold uppercase tracking-wider mb-1">
              <span>Missed Doses</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400">
              {stats.missed}
            </div>
          </div>

          <div className="glass-card p-4 sm:p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md shadow-sm">
            <div className="flex items-center justify-between text-amber-500 text-xs font-bold uppercase tracking-wider mb-1">
              <span>Reminders</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {stats.reminders}
            </div>
          </div>

          <div className="glass-card p-4 sm:p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-md shadow-sm">
            <div className="flex items-center justify-between text-indigo-500 text-xs font-bold uppercase tracking-wider mb-1">
              <span>Unread</span>
              <Sparkles className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {stats.unread}
            </div>
          </div>
        </div>

        {/* Filters & Search Control Bar */}
        <div className="glass-card p-3 sm:p-4 rounded-2xl border border-black/5 dark:border-white/10 bg-white/50 dark:bg-[#161622]/50 backdrop-blur-md mb-6 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 dark:text-white/40" />
              <input
                type="text"
                placeholder="Search alerts by medicine name, dosage, or details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-indigo-500/40 text-sm font-medium outline-none transition-all placeholder:text-black/40 dark:placeholder:text-white/40 text-[#111] dark:text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Unread Only Toggle */}
            <button
              onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all shrink-0 ${
                filterUnreadOnly
                  ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                  : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
              }`}
            >
              {filterUnreadOnly ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span>Unread Only ({stats.unread})</span>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs sm:text-sm font-semibold">
            {[
              { id: 'all', label: 'All Alerts', count: stats.total },
              { id: 'missed', label: '🚨 Missed Doses', count: stats.missed, color: 'text-rose-500' },
              { id: 'reminder', label: '⏰ Reminders', count: stats.reminders, color: 'text-amber-500' },
              { id: 'unread', label: '📬 Unread', count: stats.unread, color: 'text-indigo-500' },
              { id: 'taken', label: '✅ Confirmations', count: stats.taken, color: 'text-emerald-500' },
              { id: 'prescription', label: '📋 Prescriptions' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all border ${
                  activeTab === tab.id
                    ? 'bg-black text-white dark:bg-white dark:text-black border-transparent shadow-sm'
                    : 'bg-transparent text-black/60 dark:text-white/60 border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
                      : 'bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/70'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications Stream */}
        <div className="space-y-3.5">
          {loading ? (
            <div className="glass-card rounded-3xl p-16 text-center border border-black/5 dark:border-white/10">
              <RefreshCw className="w-8 h-8 mx-auto text-indigo-500 animate-spin mb-4" />
              <p className="text-black/60 dark:text-white/60 font-medium">Loading alerts from MongoDB Atlas...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-3xl p-16 text-center border-2 border-dashed border-black/10 dark:border-white/10 bg-white/20 dark:bg-[#161622]/20 backdrop-blur-md"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#111] dark:text-white mb-1">
                {searchQuery ? 'No matching alerts found' : 'Your alert inbox is all clear!'}
              </h3>
              <p className="text-black/60 dark:text-white/60 text-sm max-w-sm mx-auto mb-6">
                {searchQuery 
                  ? `No alerts match "${searchQuery}". Try clearing your search query or switching tabs.`
                  : activeTab === 'missed' 
                  ? 'No missed medication alerts recorded. Great job staying on track!' 
                  : 'All notifications are handled. Scheduled dose reminders and warnings will appear here automatically.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600 transition-colors"
                >
                  Clear Search
                </button>
              )}
            </motion.div>
          ) : (
            <AnimatePresence>
              {filteredNotifications.map((notif, idx) => {
                const meta = getAlertMetadata(notif);
                const isUnread = !notif.readStatus;

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                    key={notif._id}
                    onClick={() => handleToggleRead(notif._id, notif.readStatus)}
                    className={`group relative glass-card p-5 rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                      isUnread
                        ? `border-l-4 ${meta.cardBorder} border-t-black/5 border-r-black/5 border-b-black/5 dark:border-t-white/10 dark:border-r-white/10 dark:border-b-white/10 bg-white/70 dark:bg-[#1a1a28]/70 shadow-sm ${meta.glow}`
                        : 'border-black/5 dark:border-white/5 bg-white/30 dark:bg-[#14141e]/30 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {/* Background gradient tint */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${meta.bgGradient} pointer-events-none -z-10`}></div>

                    <div className="flex items-start gap-4">
                      {/* Alert Category Icon */}
                      <div className="mt-0.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                        {meta.icon}
                      </div>

                      {/* Main Message & Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {/* Category Badge */}
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${meta.badgeColor}`}>
                            {meta.badge}
                          </span>

                          {/* Medicine details pill if available */}
                          {notif.medicineName && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                              💊 {notif.medicineName} {notif.dosage ? `(${notif.dosage})` : ''}
                            </span>
                          )}

                          {/* Scheduled Time badge */}
                          {notif.scheduledTime && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60">
                              ⏰ {notif.scheduledTime}
                            </span>
                          )}

                          {/* Unread Indicator */}
                          {isUnread && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500 text-white uppercase tracking-wider ml-auto">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                              New
                            </span>
                          )}
                        </div>

                        {/* Alert Message Text */}
                        <p className={`text-sm sm:text-base leading-relaxed ${isUnread ? 'font-bold text-[#111] dark:text-white' : 'font-medium text-black/70 dark:text-white/70'}`}>
                          {notif.message}
                        </p>

                        {/* Timestamp & Action Links */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-black/5 dark:border-white/5 text-xs text-black/50 dark:text-white/50">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            <span title={new Date(notif.createdAt).toLocaleString()}>
                              {formatTimeAgo(notif.createdAt)}
                            </span>
                            <span className="text-black/30 dark:text-white/30">•</span>
                            <span className="text-[11px] font-medium text-black/40 dark:text-white/40">
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Interactive Card Action Buttons */}
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {/* Toggle Read/Unread */}
                            <button
                              onClick={() => handleToggleRead(notif._id, notif.readStatus)}
                              title={isUnread ? 'Mark as read' : 'Mark as unread'}
                              className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold text-black/70 dark:text-white/70 transition-colors flex items-center gap-1"
                            >
                              <CheckCircle2 className={`w-3.5 h-3.5 ${isUnread ? 'text-black/40 dark:text-white/40' : 'text-emerald-500'}`} />
                              <span>{isUnread ? 'Mark read' : 'Read'}</span>
                            </button>

                            {/* Link to dashboard/action */}
                            <Link
                              to={notif.actionUrl || '/dashboard'}
                              className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              <span>View</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>

                            {/* Delete single notification */}
                            <button
                              onClick={(e) => handleDeleteNotification(notif._id, e)}
                              title="Delete this alert permanently"
                              className="p-1.5 rounded-lg text-black/40 dark:text-white/40 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
