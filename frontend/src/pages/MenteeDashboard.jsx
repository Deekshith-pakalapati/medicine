import { useState, useEffect } from 'react';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { 
  Bell, 
  Activity, 
  LayoutDashboard, 
  AlertCircle, 
  Loader2, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Pill, 
  ArrowLeft, 
  Link as LinkIcon, 
  UserCheck, 
  Plus, 
  Copy, 
  RefreshCw, 
  X, 
  Unlink, 
  Trash2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import AddMedicineModal from '../components/AddMedicineModal';
import toast from 'react-hot-toast';

const MenteeDashboard = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [parentName, setParentName] = useState('Patient');
  const [loading, setLoading] = useState(true);

  // Modal and Link states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isChangeLinkOpen, setIsChangeLinkOpen] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [isRefreshingCode, setIsRefreshingCode] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const fetchData = async () => {
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const userRes = await fetch(`${import.meta.env.VITE_API_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);

        if (userData.linkedParentId) {
          if (typeof userData.linkedParentId === 'object' && userData.linkedParentId?.name) {
            const isSelf = String(userData.linkedParentId._id) === String(userData._id);
            setParentName(isSelf ? `${userData.name} (Self)` : userData.linkedParentId.name);
          }

          // Fetch medicines using type=linked parameter
          const medRes = await fetch(`${import.meta.env.VITE_API_URL}/medicines?type=linked`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (medRes.ok) {
            const medData = await medRes.json();
            setMedicines(Array.isArray(medData) ? medData : []);
            if (medData.length > 0 && medData[0].parentId?.name) {
              setParentName(medData[0].parentId.name);
            }
          }
        }
      } else {
        setUser({ name: 'Caregiver', role: 'Mentee' });
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
      } catch {}
    } catch (err) {
      console.warn('Failed to load caregiver data:', err);
      setUser({ name: 'Caregiver', role: 'Mentee' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [getToken]);

  // Connect / Link to patient via invite code
  const handleLinkPatient = async (e) => {
    if (e) e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    setLinking(true);
    setLinkError('');

    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inviteCode: inviteCodeInput.trim().toUpperCase() })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Connected to ${data.parent?.name || 'patient'}!`, { icon: '🤝' });
        setInviteCodeInput('');
        setIsChangeLinkOpen(false);
        fetchData();
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.message || 'Invalid invite code. Please check with your patient.';
        setLinkError(errMsg);
        toast.error(errMsg);
      }
    } catch {
      setLinkError('Connection error. Please try again.');
      toast.error('Connection error');
    } finally {
      setLinking(false);
    }
  };

  // Unlink current patient
  const handleUnlinkPatient = async () => {
    if (!window.confirm(`Are you sure you want to disconnect from ${parentName}?`)) return;
    setUnlinking(true);

    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/unlink`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Patient disconnected successfully');
        setUser(prev => ({ ...prev, linkedParentId: null }));
        setMedicines([]);
        setParentName('Patient');
        setIsChangeLinkOpen(false);
      } else {
        toast.error('Failed to disconnect patient');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setUnlinking(false);
    }
  };

  // Generate a new caregiver invite code
  const handleRefreshCode = async () => {
    setIsRefreshingCode(true);
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/refresh-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(prev => ({ ...prev, inviteCode: updated.inviteCode }));
        toast.success(`New invite code generated: ${updated.inviteCode}`);
      } else {
        toast.error('Could not refresh code');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsRefreshingCode(false);
    }
  };

  // Copy code to clipboard
  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success(`Invite code copied: ${code}`, { icon: '📋' });
  };

  // Delete a medicine
  const handleDeleteMedicine = async (id, medName) => {
    if (!window.confirm(`Are you sure you want to remove "${medName}"?`)) return;
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/medicines/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMedicines(prev => prev.filter(m => m._id !== id));
        toast.success(`"${medName}" removed successfully`);
      } else {
        toast.error('Failed to remove medicine');
      }
    } catch {
      toast.error('Network error removing medicine');
    }
  };

  const handleOpenAddMedicine = () => {
    if (!isLinked) {
      toast.error('Please link to a patient with their Invite Code before adding medicine.', {
        icon: '⚠️',
        duration: 3500
      });
      setIsChangeLinkOpen(true);
      return;
    }
    setIsAddModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#000000]">
        <Loader2 className="w-8 h-8 animate-spin text-black/30 dark:text-white/30" />
      </div>
    );
  }

  const isDualRole = user?.role === 'Parent';
  const isLinked = Boolean(user?.linkedParentId);

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

  // Calculate Next Dose
  const upcomingDoses = schedule.filter(item => {
    const isTaken = (item.takenLogs || []).some(log => log.date === todayDate && log.time === item.time);
    return !isTaken;
  });
  const nextDose = upcomingDoses.length > 0 ? upcomingDoses[0].time : 'All Done';

  const formatAMPM = (time24) => {
    if (!time24 || time24 === 'All Done' || time24 === 'None') return time24;
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${hours.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-white dark:bg-[#000000] transition-colors duration-300">
      {/* Background glow */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-rose-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Sidebar (Desktop) */}
      <aside className="w-64 hidden md:flex flex-col border-r border-black/5 dark:border-white/5 glass-panel z-10 shrink-0">
        <div className="p-8 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#111] dark:bg-white flex items-center justify-center shadow-lg">
            <LayoutDashboard className="w-4 h-4 text-white dark:text-black" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gradient">MediCare</span>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <Link to="/mentee-dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/5 dark:bg-white/10 text-[#111] dark:text-white font-semibold transition-colors">
            <Activity className="w-5 h-5 text-rose-500" /> Monitoring
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
          <Link to="/analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#111]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 font-medium transition-colors">
            <FileText className="w-5 h-5" /> Analytics & Notes
          </Link>
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#111]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 font-medium transition-colors">
            <Pill className="w-5 h-5" /> Patient View
          </Link>
        </nav>

        <div className="p-6 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-10 h-10 shadow-md' } }} />
            <div className="overflow-hidden">
              <p className="font-semibold text-sm truncate text-[#111] dark:text-white">{user?.name || 'Caregiver'}</p>
              <p className="text-rose-500 font-bold text-[10px] uppercase tracking-wider">Caregiver</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto z-10 pb-28 md:pb-10">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between mb-8 pb-4 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#111] dark:bg-white flex items-center justify-center shadow-lg">
              <LayoutDashboard className="w-4 h-4 text-white dark:text-black" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gradient">MediCare</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleOpenAddMedicine}
              className="p-2 rounded-full bg-rose-500 text-white font-bold shadow-md hover:bg-rose-600 transition-colors"
              title="Add Medicine"
            >
              <Plus className="w-4 h-4" />
            </button>
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-8 h-8 shadow-md' } }} />
          </div>
        </div>

        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            {isDualRole && (
              <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-sm font-bold text-rose-500 hover:text-rose-600 mb-4 transition-colors cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> Back to Patient Dashboard
              </button>
            )}
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 text-[#111] dark:text-white">
              Caregiver <span className="text-rose-500">Monitoring Hub</span>
            </h1>
            <p className="text-[#111]/60 dark:text-white/60 font-medium text-sm md:text-base">
              {isLinked ? `Real-time adherence overview for ${parentName}` : 'Connect to a patient to monitor and manage their daily medications in real-time'}
            </p>
          </motion.div>

          {/* Action Bar with Add Medicine, Code, Link options */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto">
            {/* + Add Medicine Button */}
            <button
              onClick={handleOpenAddMedicine}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/25 hover:scale-105 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Medicine
            </button>

            {/* Caregiver's Own Code Widget */}
            {user?.inviteCode && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-black/10 dark:border-white/10 text-xs sm:text-sm font-medium glass-panel justify-center">
                <span className="text-[#111]/50 dark:text-white/50 text-xs">My Code:</span>
                <span className="tracking-widest font-black text-[#111] dark:text-white">{user.inviteCode}</span>
                <button
                  onClick={() => handleCopyCode(user.inviteCode)}
                  title="Copy my invite code"
                  className="p-1 hover:text-rose-500 text-black/40 dark:text-white/40 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRefreshCode}
                  disabled={isRefreshingCode}
                  title="Generate new invite code"
                  className="p-1 hover:text-rose-500 text-black/40 dark:text-white/40 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCode ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}

            {/* Patient Link Status & Change Link Button */}
            {isLinked ? (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <UserCheck className="w-4 h-4 text-emerald-500" />
                <span className="font-bold truncate max-w-[120px] sm:max-w-[180px]">{parentName}</span>
                <button
                  onClick={() => setIsChangeLinkOpen(!isChangeLinkOpen)}
                  title="Change or re-link patient"
                  className="ml-1 text-[11px] underline opacity-80 hover:opacity-100 hover:text-rose-500 transition-colors cursor-pointer"
                >
                  {isChangeLinkOpen ? 'Close' : 'Change'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsChangeLinkOpen(!isChangeLinkOpen)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                <LinkIcon className="w-3.5 h-3.5" /> Link Patient
              </button>
            )}

            <Link to="/dashboard" className="px-4 py-2.5 rounded-full text-xs font-bold text-[#111] dark:text-white bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors">
              Patient View
            </Link>

            <div className="hidden md:block">
              <ThemeToggle />
            </div>
          </motion.div>
        </header>

        {/* Change / Re-link Patient Interactive Panel */}
        <AnimatePresence>
          {isChangeLinkOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="glass-card rounded-3xl p-6 mb-8 border border-rose-500/30 bg-rose-500/5 relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#111] dark:text-white flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-rose-500" />
                    {isLinked ? 'Switch or Change Linked Patient' : 'Connect to a Patient Device'}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#111]/60 dark:text-white/60">
                    Enter the 6-character Invite Code shown on the patient's dashboard to link their prescriptions.
                  </p>
                </div>
                <button
                  onClick={() => setIsChangeLinkOpen(false)}
                  className="p-1 rounded-full text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleLinkPatient} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                  placeholder="PATIENT CODE (e.g. PATIENT)"
                  className="flex-1 sm:max-w-xs bg-white dark:bg-[#111] px-4 py-2.5 rounded-xl text-center font-mono font-bold tracking-widest text-base border border-black/10 dark:border-white/10 focus:outline-none focus:border-rose-500 text-black dark:text-white uppercase shadow-sm"
                  maxLength={8}
                />
                <button
                  type="submit"
                  disabled={linking || !inviteCodeInput.trim()}
                  className="px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect Patient'}
                </button>

                {isLinked && (
                  <button
                    type="button"
                    onClick={handleUnlinkPatient}
                    disabled={unlinking}
                    className="px-4 py-2.5 rounded-xl border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                    Disconnect Current
                  </button>
                )}
              </form>
              {linkError && <p className="text-rose-500 text-xs font-bold mt-2">{linkError}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Link Patient Prominent Banner if not linked */}
        {!isLinked && !isChangeLinkOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-3xl p-6 md:p-8 mb-8 border border-rose-500/20 bg-rose-500/5 relative overflow-hidden"
          >
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold uppercase tracking-wider mb-3">
                  <LinkIcon className="w-3.5 h-3.5" /> Patient Link Required
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-[#111] dark:text-white mb-1">
                  Connect to a Patient's Device
                </h2>
                <p className="text-[#111]/60 dark:text-white/60 text-sm font-medium leading-relaxed">
                  Enter the 6-character Invite Code displayed on the patient's dashboard to synchronize active prescriptions and dose alerts.
                </p>
              </div>

              <form onSubmit={handleLinkPatient} className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                <input
                  type="text"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                  placeholder="CODE (e.g. A1B2C3)"
                  className="w-full sm:w-48 bg-white dark:bg-[#111] px-4 py-3 rounded-2xl text-center font-mono font-bold tracking-widest text-lg border border-black/10 dark:border-white/10 focus:outline-none focus:border-rose-500 text-black dark:text-white uppercase shadow-sm"
                  maxLength={8}
                />
                <button
                  type="submit"
                  disabled={linking || !inviteCodeInput.trim()}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-lg shadow-rose-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect Patient'}
                </button>
              </form>
            </div>
            {linkError && (
              <p className="text-red-500 text-xs font-bold mt-3">{linkError}</p>
            )}
          </motion.div>
        )}

        {/* Dashboard Grid Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Adherence Progress Ring Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 md:p-8 rounded-3xl flex items-center justify-between col-span-1 md:col-span-2 lg:col-span-1">
            <div>
              <h3 className="text-[#111]/50 dark:text-white/50 font-bold text-xs uppercase tracking-widest mb-2">Today's Adherence</h3>
              <p className="text-4xl md:text-5xl font-black text-[#111] dark:text-white tracking-tighter">
                {isLinked ? adherenceScore : '--'}<span className="text-xl md:text-2xl text-[#111]/40 dark:text-white/40">%</span>
              </p>
              <p className="text-[#111]/60 dark:text-white/60 text-sm mt-2 font-medium flex items-center gap-1.5">
                {!isLinked ? (
                  <span className="text-black/40 dark:text-white/40">Waiting for patient connection</span>
                ) : adherenceScore === 100 ? (
                  <><CheckCircle2 className="w-4 h-4 text-green-500" /> Patient is fully on track</>
                ) : (
                  <><Activity className="w-4 h-4 text-orange-500" /> {takenDosesToday} of {totalDosesToday} taken</>
                )}
              </p>
            </div>
            {/* SVG Ring */}
            <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path className="text-black/5 dark:text-white/5" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-rose-500 transition-all duration-1000" strokeDasharray={`${isLinked ? adherenceScore : 0}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 rounded-3xl flex flex-col justify-center">
              <h3 className="text-[#111]/50 dark:text-white/50 font-bold text-xs uppercase tracking-widest mb-1 break-words">Active Meds</h3>
              <p className="text-3xl md:text-4xl font-black text-[#111] dark:text-white">
                {isLinked ? medicines.length : '0'}
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 rounded-3xl flex flex-col justify-center">
              <h3 className="text-[#111]/50 dark:text-white/50 font-bold text-xs uppercase tracking-widest mb-1 break-words">Next Dose</h3>
              <p className="text-2xl md:text-3xl font-black text-[#111] dark:text-white truncate">
                {isLinked ? formatAMPM(nextDose) : '--:--'}
              </p>
            </motion.div>
          </div>
        </div>

        {/* Detailed Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-10">
          
          {/* Timeline View (Left Column) */}
          <div className="xl:col-span-1">
            <h2 className="text-xl font-bold tracking-tight mb-6 text-[#111] dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-rose-500" /> Patient Schedule
            </h2>
            
            {schedule.length === 0 ? (
              <div className="glass-card p-8 rounded-3xl text-center border-dashed border border-black/10 dark:border-white/10">
                <Clock className="w-8 h-8 text-black/20 dark:text-white/20 mx-auto mb-3" />
                <p className="text-[#111]/60 dark:text-white/60 font-medium text-sm">
                  {isLinked ? 'No medicines scheduled for today.' : 'Link a patient to view their daily schedule.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-black/10 dark:before:via-white/10 before:to-transparent">
                {schedule.map((item, idx) => {
                  const isTaken = (item.takenLogs || []).some(log => log.date === todayDate && log.time === item.time);
                  return (
                    <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-[#000] text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors ${isTaken ? 'bg-green-500' : 'bg-rose-500'}`}>
                        {isTaken ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>
                      <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] glass-card p-4 rounded-2xl transition-all ${isTaken ? 'opacity-60 grayscale' : ''}`}>
                        <div className="font-black text-lg text-[#111] dark:text-white mb-1">{formatAMPM(item.time)}</div>
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
            <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
              <h2 className="text-xl font-bold tracking-tight text-[#111] dark:text-white flex items-center gap-2">
                <Pill className="w-5 h-5 text-rose-500" /> Prescriptions & Adherence Logs
              </h2>

              {/* Add Medicine Button inside section */}
              <button
                onClick={handleOpenAddMedicine}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all shadow-md shadow-rose-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Medicine
              </button>
            </div>

            {medicines.length === 0 ? (
              <div className="glass-card rounded-3xl p-10 md:p-16 text-center border-dashed border-2 border-black/10 dark:border-white/10">
                <div className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Pill className="w-8 h-8 text-[#111]/30 dark:text-white/30" />
                </div>
                <h3 className="text-xl font-bold text-[#111] dark:text-white mb-2">
                  {isLinked ? 'No prescriptions recorded yet' : 'No patient connected'}
                </h3>
                <p className="text-[#111]/60 dark:text-white/60 font-medium text-sm max-w-sm mx-auto mb-6">
                  {isLinked
                    ? 'You can now add prescription medicines directly for your patient right here!'
                    : 'Once you enter your patient\'s invite code, their live prescriptions and dose tracking will appear here.'}
                </p>
                {isLinked ? (
                  <button
                    onClick={handleOpenAddMedicine}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-lg shadow-rose-500/30 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Add First Medicine
                  </button>
                ) : (
                  <button
                    onClick={() => setIsChangeLinkOpen(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-lg shadow-rose-500/30 transition-all"
                  >
                    <LinkIcon className="w-4 h-4" /> Enter Patient Code
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {medicines.map((med, i) => (
                  <motion.div
                    key={med._id || i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-card p-5 md:p-6 rounded-3xl border border-black/5 dark:border-white/5 hover:border-rose-500/30 transition-colors group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                      <Pill className="w-24 h-24 text-rose-500 rotate-12 -mr-6 -mt-6" />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-6 relative z-10 gap-2">
                      <div className="w-full">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-2xl font-black text-[#111] dark:text-white mb-1 truncate">{med.name}</h3>
                          <button
                            onClick={() => handleDeleteMedicine(med._id, med.name)}
                            title="Delete medicine"
                            className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/10 text-xs font-bold text-[#111]/70 dark:text-white/70 uppercase tracking-wider">
                          {med.frequency}
                        </span>
                      </div>
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

                      <div className="pt-4 border-t border-black/5 dark:border-white/5">
                        <span className="text-[#111]/50 dark:text-white/50 text-sm font-bold uppercase tracking-wider mb-3 block">Today's Doses</span>
                        <div className="flex flex-wrap gap-2">
                          {(med.reminderTimes || []).map((time, idx) => {
                            const isTaken = (med.takenLogs || []).some(log => log.date === todayDate && log.time === time);
                            return (
                              <div key={idx} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${isTaken ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' : 'bg-black/5 dark:bg-white/5 text-[#111]/60 dark:text-white/60 border border-black/10 dark:border-white/10'}`}>
                                {isTaken ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                {formatAMPM(time)} {isTaken ? 'Taken' : 'Pending'}
                              </div>
                            );
                          })}
                        </div>
                      </div>

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
        <Link to="/mentee-dashboard" className="flex flex-col items-center gap-1 text-rose-500 font-bold text-[10px] uppercase tracking-wider">
          <Activity className="w-6 h-6" /> Monitoring
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
        <Link to="/dashboard" className="flex flex-col items-center gap-1 text-[#111]/50 dark:text-white/50 hover:text-[#111] dark:hover:text-white font-bold text-[10px] uppercase tracking-wider transition-colors">
          <Pill className="w-6 h-6" /> Patient
        </Link>
      </nav>

      {/* Add Medicine Modal for Caregiver */}
      <AddMedicineModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={(newMed) => {
          setMedicines(prev => [newMed, ...prev]);
          fetchData();
          toast.success(`Medicine "${newMed.name}" added successfully for ${parentName}!`, { icon: '💊' });
        }}
      />
    </div>
  );
};

export default MenteeDashboard;
