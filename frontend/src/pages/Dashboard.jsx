import { useState, useEffect, useRef } from 'react';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { Bell, Plus, Activity, LayoutDashboard, CalendarDays, AlertCircle, Loader2, Clock, CheckCircle2, FileText, Pill, X, RefreshCw, Trash2, Copy, Unlink, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import AddMedicineModal from '../components/AddMedicineModal';
import ThemeToggle from '../components/ThemeToggle';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { getToken } = useAuth();
  const [user, setUser] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Link state
  const [linkCode, setLinkCode] = useState('');
  const [linkError, setLinkError] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isChangeLinkOpen, setIsChangeLinkOpen] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const handleDeleteMedicine = async (id) => {
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/medicines/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMedicines(prev => prev.filter(m => m._id !== id));
        setDeleteMessage('Medicine deleted successfully');
        setTimeout(() => setDeleteMessage(''), 3000);
        window.dispatchEvent(new Event('refreshMedicines'));
      }
    } catch (e) {
      console.error('Failed to delete medicine', e);
    }
  };

  const handleLink = async (e) => {
    if (e) e.preventDefault();
    if (!linkCode.trim()) return;
    setIsLinking(true);
    setLinkError('');
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inviteCode: linkCode.trim().toUpperCase() })
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Linked successfully!', { icon: '🤝' });
        setLinkCode('');
        setIsChangeLinkOpen(false);
        // Refresh profile
        const userRes = await fetch(`${import.meta.env.VITE_API_URL}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (userRes.ok) {
          const u = await userRes.json();
          setUser(u);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        const errMsg = data.message || 'Invalid code';
        setLinkError(errMsg);
        toast.error(errMsg);
      }
    } catch (err) {
      setLinkError('Error linking account');
      toast.error('Error linking account');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm('Are you sure you want to disconnect?')) return;
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/unlink`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Disconnected successfully');
        setUser(prev => ({ ...prev, linkedParentId: null }));
        setIsChangeLinkOpen(false);
      } else {
        toast.error('Failed to disconnect');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success(`Invite code copied: ${code}`, { icon: '📋' });
  };

  const handleRefreshCode = async () => {
    setIsRefreshing(true);
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/refresh-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(prev => ({ ...prev, inviteCode: updatedUser.inviteCode }));
        toast.success(`New invite code generated: ${updatedUser.inviteCode}`);
      }
    } catch (err) {
      console.error('Failed to refresh code', err);
      toast.error('Failed to refresh code');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await getToken();
        if (!token) { setLoading(false); return; }

        try {
          const userRes = await fetch(`${import.meta.env.VITE_API_URL}/users/profile`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            setUser(userData);
          } else {
            setUser({ name: 'Patient', role: 'Parent', inviteCode: 'PATIENT' });
          }
        } catch {
          setUser({ name: 'Patient', role: 'Parent', inviteCode: 'PATIENT' });
        }

        try {
          const medRes = await fetch(`${import.meta.env.VITE_API_URL}/medicines`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (medRes.ok) {
            const medData = await medRes.json();
            setMedicines(Array.isArray(medData) ? medData : []);
          }
        } catch {
          // ignore
        }

        try {
          const notifRes = await fetch(`${import.meta.env.VITE_API_URL}/notifications?unreadOnly=true`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (notifRes.ok) {
            const notifData = await notifRes.json();
            if (Array.isArray(notifData)) {
              setUnreadAlerts(notifData.filter(n => !n.readStatus).length);
            }
          }
        } catch {
          // ignore
        }

        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      } catch (err) {
        console.warn('Dashboard data fetch warning:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [getToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#000000]">
        <Loader2 className="w-8 h-8 animate-spin text-black/30 dark:text-white/30" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-white dark:bg-[#000000]">
        <div className="glass-card rounded-3xl p-12 max-w-sm text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-[#111] dark:text-white">Could not load dashboard</h2>
          <p className="text-[#111]/60 dark:text-white/60 font-medium text-sm mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 rounded-xl text-white bg-[#111] dark:bg-white dark:text-black font-semibold hover:opacity-90 transition-opacity">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'there';

  // Calculate Adherence
  let totalDosesToday = 0;
  let takenDosesToday = 0;
  const todayDate = new Date().toISOString().split('T')[0];

  medicines.forEach(med => {
    totalDosesToday += (med.reminderTimes || []).length;
    takenDosesToday += (med.takenLogs || []).filter(log => log.date === todayDate).length;
  });

  const adherenceScore = totalDosesToday === 0 ? 100 : Math.round((takenDosesToday / totalDosesToday) * 100);

  // Sort schedule for timeline
  const schedule = medicines.flatMap(med => 
    (med.reminderTimes || []).map(time => ({ ...med, time }))
  ).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-white dark:bg-[#000000] transition-colors duration-300">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Sidebar (Desktop) */}
      <aside className="w-64 hidden md:flex flex-col border-r border-black/5 dark:border-white/5 glass-panel z-10 shrink-0">
        <div className="p-8 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#111] dark:bg-white flex items-center justify-center shadow-lg">
            <LayoutDashboard className="w-4 h-4 text-white dark:text-black" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gradient">MediCare</span>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/5 dark:bg-white/10 text-[#111] dark:text-white font-semibold transition-colors">
            <CalendarDays className="w-5 h-5" /> Schedule
          </Link>
          <Link to="/analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#111]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 font-medium transition-colors">
            <Activity className="w-5 h-5" /> Analytics & Notes
          </Link>
          <Link to="/notifications" className="flex items-center justify-between px-4 py-3 rounded-xl text-[#111]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 font-medium transition-colors">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5" /> Alerts
            </div>
            {unreadAlerts > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                {unreadAlerts}
              </span>
            )}
          </Link>
        </nav>

        <div className="p-6 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-10 h-10 shadow-md' } }} />
            <div className="overflow-hidden">
              <p className="font-semibold text-sm truncate text-[#111] dark:text-white">{user?.name || 'User'}</p>
              <p className="text-indigo-500 font-bold text-[10px] uppercase tracking-wider">{user?.role || 'Patient'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto z-10 pb-28 md:pb-10">
        {/* Mobile Header elements that normally sit in sidebar */}
        <div className="md:hidden flex items-center justify-between mb-8 pb-4 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#111] dark:bg-white flex items-center justify-center shadow-lg">
              <LayoutDashboard className="w-4 h-4 text-white dark:text-black" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gradient">MediCare</span>
          </div>
          <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-8 h-8 shadow-md' } }} />
        </div>

        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-10 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 text-[#111] dark:text-white">Hello, {firstName}</h1>
            <p className="text-[#111]/60 dark:text-white/60 font-medium text-sm md:text-base">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col md:flex-row w-full xl:w-auto items-stretch md:items-center gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto justify-between">
              <ThemeToggle />
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white bg-[#111] dark:bg-white dark:text-black hover:scale-105 transition-transform shadow-lg md:hidden"
              >
                <Plus className="w-5 h-5" /> Add
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full xl:w-auto">
              {/* Linked Status / Link Button */}
              {user?.linkedParentId ? (
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  <span className="font-bold truncate max-w-[140px]">
                    {typeof user.linkedParentId === 'object' && user.linkedParentId?.name
                      ? (String(user.linkedParentId?._id) === String(user?._id) ? 'Self-Linked' : user.linkedParentId.name)
                      : (String(user?.linkedParentId) === String(user?._id) ? 'Self-Linked' : 'Linked')}
                  </span>
                  <button
                    onClick={() => setIsChangeLinkOpen(!isChangeLinkOpen)}
                    className="ml-1 text-[11px] underline opacity-80 hover:opacity-100 hover:text-indigo-500 transition-colors cursor-pointer"
                  >
                    {isChangeLinkOpen ? 'Close' : 'Change'}
                  </button>
                  <Link
                    to="/mentee-dashboard"
                    className="ml-1.5 px-2.5 py-1 rounded-full bg-indigo-500 text-white text-[10px] font-extrabold uppercase hover:bg-indigo-600 transition-colors"
                  >
                    Caregiver Hub
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => setIsChangeLinkOpen(!isChangeLinkOpen)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                >
                  <Activity className="w-4 h-4" /> Link Account
                </button>
              )}

              {/* My Code with Copy & Refresh */}
              {user?.inviteCode && (
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-black/10 dark:border-white/10 text-xs sm:text-sm font-medium glass-panel justify-center">
                  <span className="text-[#111]/50 dark:text-white/50 text-xs">My Code:</span>
                  <span className="tracking-widest font-black text-[#111] dark:text-white">{user.inviteCode}</span>
                  <button
                    onClick={() => handleCopyCode(user.inviteCode)}
                    title="Copy my invite code"
                    className="p-1 hover:text-indigo-500 text-[#111]/40 dark:text-white/40 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleRefreshCode}
                    disabled={isRefreshing}
                    title="Generate new invite code"
                    className="p-1 hover:text-indigo-500 text-[#111]/40 dark:text-white/40 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}
              
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="hidden md:flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white bg-[#111] dark:bg-white dark:text-black hover:scale-105 transition-transform shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.12)] shrink-0 cursor-pointer"
              >
                <Plus className="w-5 h-5" /> Add Medicine
              </button>
            </div>
          </motion.div>
        </header>

        {/* Change / Enter Link Code Interactive Panel */}
        <AnimatePresence>
          {isChangeLinkOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="glass-card rounded-3xl p-6 mb-8 border border-indigo-500/30 bg-indigo-500/5 relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#111] dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    {user?.linkedParentId ? 'Change or Switch Connected Account' : 'Connect to a Caregiver or Patient'}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#111]/60 dark:text-white/60">
                    Enter your partner's 6-character Invite Code (or your own code to self-link for dual access).
                  </p>
                </div>
                <button
                  onClick={() => setIsChangeLinkOpen(false)}
                  className="p-1 rounded-full text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleLink} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                  placeholder="CODE (e.g. A1B2C3)"
                  className="flex-1 sm:max-w-xs bg-white dark:bg-[#111] px-4 py-2.5 rounded-xl text-center font-mono font-bold tracking-widest text-base border border-black/10 dark:border-white/10 focus:outline-none focus:border-indigo-500 text-black dark:text-white uppercase shadow-sm"
                  maxLength={8}
                />
                <button
                  type="submit"
                  disabled={isLinking || !linkCode.trim()}
                  className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect Account'}
                </button>

                {user?.linkedParentId && (
                  <button
                    type="button"
                    onClick={handleUnlink}
                    className="px-4 py-2.5 rounded-xl border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Unlink className="w-4 h-4" /> Disconnect
                  </button>
                )}
              </form>
              {linkError && <p className="text-rose-500 text-xs font-bold mt-2">{linkError}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dashboard Grid Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Adherence Progress Ring Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 md:p-8 rounded-3xl flex items-center justify-between col-span-1 md:col-span-2 lg:col-span-1">
            <div>
              <h3 className="text-[#111]/50 dark:text-white/50 font-bold text-xs uppercase tracking-widest mb-2">Today's Adherence</h3>
              <p className="text-4xl md:text-5xl font-black text-[#111] dark:text-white tracking-tighter">{adherenceScore}<span className="text-xl md:text-2xl text-[#111]/40 dark:text-white/40">%</span></p>
              <p className="text-[#111]/60 dark:text-white/60 text-sm mt-2 font-medium flex items-center gap-1.5">
                {adherenceScore === 100 ? (
                  <><CheckCircle2 className="w-4 h-4 text-green-500" /> All caught up</>
                ) : (
                  <><Activity className="w-4 h-4 text-orange-500" /> {takenDosesToday} of {totalDosesToday} taken</>
                )}
              </p>
            </div>
            {/* SVG Ring */}
            <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path className="text-black/5 dark:text-white/5" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-indigo-500 transition-all duration-1000" strokeDasharray={`${adherenceScore}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 rounded-3xl flex flex-col justify-center">
              <h3 className="text-[#111]/50 dark:text-white/50 font-bold text-xs uppercase tracking-widest mb-1 break-words">Prescriptions</h3>
              <p className="text-3xl md:text-4xl font-black text-[#111] dark:text-white">{medicines.length}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 rounded-3xl flex flex-col justify-center">
              <h3 className="text-[#111]/50 dark:text-white/50 font-bold text-xs uppercase tracking-widest mb-1 break-words">Next Dose</h3>
              <p className="text-2xl md:text-3xl font-black text-[#111] dark:text-white truncate">
                {schedule.length > 0 ? schedule[0].time : 'None'}
              </p>
            </motion.div>
          </div>
        </div>

        {/* Detailed Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-10">
          
          {/* Timeline View (Left Column) */}
          <div className="xl:col-span-1">
            <h2 className="text-xl font-bold tracking-tight mb-6 text-[#111] dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" /> Today's Timeline
            </h2>
            
            {schedule.length === 0 ? (
              <p className="text-[#111]/50 dark:text-white/50 font-medium">Nothing scheduled for today.</p>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-black/10 dark:before:via-white/10 before:to-transparent">
                {schedule.map((item, idx) => {
                  const isTaken = (item.takenLogs || []).some(log => log.date === todayDate && log.time === item.time);
                  return (
                    <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-[#000] text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors ${isTaken ? 'bg-green-500' : 'bg-indigo-500'}`}>
                        {isTaken ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>
                      <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] glass-card p-4 rounded-2xl transition-all ${isTaken ? 'opacity-60 grayscale' : ''}`}>
                        <div className="font-black text-lg text-[#111] dark:text-white mb-1">{item.time}</div>
                        <div className="font-semibold text-[#111] dark:text-white truncate">{item.name}</div>
                        <div className="text-sm font-medium text-[#111]/60 dark:text-white/60">{item.dosage}</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Complete Medicine Details (Right 2 Columns) */}
          <div className="xl:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold tracking-tight text-[#111] dark:text-white flex items-center gap-2">
                <Pill className="w-5 h-5 text-indigo-500" /> Medicine Details
              </h2>
            </div>
            
            {/* Delete Success Toast */}
            <AnimatePresence>
              {deleteMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }} 
                  className="mb-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm font-bold shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {deleteMessage}
                </motion.div>
              )}
            </AnimatePresence>

            {medicines.length === 0 ? (
              <div className="glass-card rounded-3xl p-10 md:p-16 text-center border-dashed border-2 border-black/10 dark:border-white/10">
                <div className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Pill className="w-8 h-8 text-[#111]/30 dark:text-white/30" />
                </div>
                <h3 className="text-xl font-bold text-[#111] dark:text-white mb-2">No prescriptions found</h3>
                <p className="text-[#111]/60 dark:text-white/60 font-medium mb-6">Add your medicines to start tracking your health.</p>
                <button onClick={() => setIsAddModalOpen(true)} className="text-sm font-bold text-indigo-500 hover:underline">
                  Add medicine now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {medicines.map((med, i) => (
                  <motion.div
                    key={med._id || i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-card p-5 md:p-6 rounded-3xl border border-black/5 dark:border-white/5 hover:border-indigo-500/30 transition-colors group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                      <Pill className="w-24 h-24 text-indigo-500 rotate-12 -mr-6 -mt-6" />
                    </div>
                    
                    <div className="flex justify-between items-start mb-6 relative z-10 gap-2">
                      <div className="w-full">
                        <h3 className="text-2xl font-black text-[#111] dark:text-white mb-1 truncate">{med.name}</h3>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/10 text-xs font-bold text-[#111]/70 dark:text-white/70 uppercase tracking-wider">
                          {med.frequency}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDeleteMedicine(med._id)}
                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors shrink-0"
                        title="Delete Medicine"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4 relative z-10">
                      <div className="flex items-center justify-between">
                        <span className="text-[#111]/50 dark:text-white/50 text-sm font-bold uppercase tracking-wider">Dosage</span>
                        <span className="font-bold text-[#111] dark:text-white">{med.dosage}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-[#111]/50 dark:text-white/50 text-sm font-bold uppercase tracking-wider">Start Date</span>
                        <span className="font-bold text-[#111] dark:text-white">
                          {med.startDate ? new Date(med.startDate).toLocaleDateString() : 'Today'}
                        </span>
                      </div>

                      {med.endDate && (
                        <div className="flex items-center justify-between">
                          <span className="text-[#111]/50 dark:text-white/50 text-sm font-bold uppercase tracking-wider">End Date</span>
                          <span className="font-bold text-[#111] dark:text-white">
                            {new Date(med.endDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {med.notes && (
                        <div className="pt-4 border-t border-black/5 dark:border-white/5">
                          <span className="flex items-center gap-2 text-[#111]/50 dark:text-white/50 text-sm font-bold uppercase tracking-wider mb-2">
                            <FileText className="w-4 h-4" /> Instructions
                          </span>
                          <p className="text-sm font-medium text-[#111] dark:text-white leading-relaxed break-words">{med.notes}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-black/10 dark:border-white/10 z-50 flex justify-around p-3 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(255,255,255,0.02)]">
        <Link to="/dashboard" className="flex flex-col items-center gap-1 text-indigo-500 font-bold text-[10px] uppercase tracking-wider">
          <CalendarDays className="w-6 h-6" /> Schedule
        </Link>
        <Link to="/analytics" className="flex flex-col items-center gap-1 text-[#111]/50 dark:text-white/50 hover:text-[#111] dark:hover:text-white font-bold text-[10px] uppercase tracking-wider transition-colors">
          <Activity className="w-6 h-6" /> Analytics & Notes
        </Link>
        <Link to="/notifications" className="relative flex flex-col items-center gap-1 text-[#111]/50 dark:text-white/50 hover:text-[#111] dark:hover:text-white font-bold text-[10px] uppercase tracking-wider transition-colors">
          <div className="relative">
            <Bell className="w-6 h-6" />
            {unreadAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </div>
          Alerts
        </Link>
      </nav>

      <AddMedicineModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={(newMed) => {
          setMedicines(prev => [newMed, ...prev]);
          window.dispatchEvent(new Event('refreshMedicines'));
        }}
      />
    </div>
  );
};

export default Dashboard;
