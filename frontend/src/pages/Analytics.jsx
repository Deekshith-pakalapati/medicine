import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  ArrowLeft, FileText, CheckCircle2, AlertTriangle, Pill, 
  Calendar, Clock, Edit3, Save, X, Search, Filter, RefreshCw, 
  Sparkles, ShieldCheck, HeartPulse, Printer, Copy, Check
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import toast from 'react-hot-toast';

const Analytics = () => {
  const { getToken } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'with-notes', 'needs-notes'
  
  // Inline Note Editing state
  const [editingId, setEditingId] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${import.meta.env.VITE_API_URL}/medicines`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMedicines(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Failed to load medicines for analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicines();
  }, [getToken]);

  // Compute live adherence statistics across all medications
  const stats = useMemo(() => {
    let totalDosesScheduled = 0;
    let totalTaken = 0;
    let totalMissed = 0;

    const todayDate = new Date().toISOString().split('T')[0];
    let todayScheduled = 0;
    let todayTaken = 0;

    // Past 7 days calculation
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      last7Days.push({ date: dateStr, name: dayName, taken: 0, missed: 0 });
    }

    medicines.forEach((med) => {
      const reminderCount = (med.reminderTimes || []).length;
      totalDosesScheduled += reminderCount;
      
      const takenLogs = Array.isArray(med.takenLogs) ? med.takenLogs : [];
      const missedLogs = Array.isArray(med.missedLogs) ? med.missedLogs : [];

      totalTaken += takenLogs.length;
      totalMissed += missedLogs.length;

      // Today's metrics
      todayScheduled += reminderCount;
      todayTaken += takenLogs.filter(l => l.date === todayDate).length;

      // Populate 7-day trend
      last7Days.forEach(day => {
        const takenOnDay = takenLogs.filter(l => l.date === day.date).length;
        const missedOnDay = missedLogs.filter(l => l.date === day.date).length;
        day.taken += takenOnDay;
        day.missed += missedOnDay;
      });
    });

    const totalLogged = totalTaken + totalMissed;
    const overallAdherence = totalLogged > 0 ? Math.round((totalTaken / totalLogged) * 100) : 100;
    const todayAdherence = todayScheduled > 0 ? Math.min(100, Math.round((todayTaken / todayScheduled) * 100)) : 100;

    return {
      totalMedicines: medicines.length,
      totalTaken,
      totalMissed,
      overallAdherence,
      todayAdherence,
      weeklyTrend: last7Days,
      withNotesCount: medicines.filter(m => m.notes && m.notes.trim().length > 0).length
    };
  }, [medicines]);

  // Filtered medicines list for Prescription Notes section
  const filteredMedicines = useMemo(() => {
    return medicines.filter((med) => {
      const matchesSearch = 
        med.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        med.dosage?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        med.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeFilter === 'with-notes') {
        return med.notes && med.notes.trim().length > 0;
      }
      if (activeFilter === 'needs-notes') {
        return !med.notes || med.notes.trim().length === 0;
      }
      return true;
    });
  }, [medicines, searchQuery, activeFilter]);

  // Save updated notes to MongoDB
  const handleSaveNotes = async (id) => {
    setIsSavingNote(true);
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/medicines/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: editNoteText })
      });
      if (res.ok) {
        const updated = await res.json();
        setMedicines(prev => prev.map(m => m._id === id ? { ...m, notes: editNoteText } : m));
        toast.success('Prescription notes updated successfully in MongoDB!');
        setEditingId(null);
      } else {
        toast.error('Failed to update notes.');
      }
    } catch (e) {
      toast.error('Error saving notes.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const startEditing = (med) => {
    setEditingId(med._id);
    setEditNoteText(med.notes || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditNoteText('');
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Notes copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrintSummary = () => {
    window.print();
  };

  // Custom tooltips for Recharts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 rounded-2xl border border-black/10 dark:border-white/10 text-xs font-bold shadow-xl bg-white/90 dark:bg-black/90 backdrop-blur-md">
          <p className="mb-1 text-black/60 dark:text-white/60">{label}</p>
          {payload.map((p, idx) => (
            <p key={idx} style={{ color: p.color || p.fill }}>
              {p.name}: {p.value} dose(s)
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const pieData = [
    { name: 'Doses Taken', value: stats.totalTaken || (stats.totalMissed === 0 ? 1 : 0), color: '#10B981' },
    { name: 'Doses Missed', value: stats.totalMissed, color: '#f43f5e' }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden p-4 md:p-10 pb-28 md:pb-16 bg-white dark:bg-[#000] text-black dark:text-white transition-colors">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-500/10 blur-[140px] rounded-full pointer-events-none -z-10"></div>
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 blur-[160px] rounded-full pointer-events-none -z-10"></div>

      <div className="max-w-6xl mx-auto z-10 relative">
        {/* Navigation & Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-black/5 dark:border-white/5">
          <div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors mb-3"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight flex items-center gap-3">
              Medication <span className="text-gradient">Analytics & Notes</span>
            </h1>
            <p className="text-sm font-medium text-black/60 dark:text-white/60 mt-1">
              Live adherence telemetry and complete clinical instructions for all medications.
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              onClick={handlePrintSummary}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Print Summary"
            >
              <Printer size={14} /> Print Report
            </button>
            <button
              onClick={fetchMedicines}
              className="p-2.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Refresh Analytics"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <ThemeToggle />
          </div>
        </header>

        {/* 4 Key Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5 md:p-6 rounded-3xl flex flex-col justify-between"
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-2 flex items-center gap-1.5">
              <HeartPulse className="w-3.5 h-3.5 text-indigo-500" /> Overall Adherence
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-5xl font-black">{stats.overallAdherence}%</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${stats.overallAdherence >= 80 ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-rose-500/10 text-rose-500'}`}>
                {stats.overallAdherence >= 80 ? 'Optimal' : 'Needs Care'}
              </span>
            </div>
            <p className="text-xs text-black/50 dark:text-white/50 mt-2 font-medium">
              Today: {stats.todayAdherence}% on track
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-card p-5 md:p-6 rounded-3xl flex flex-col justify-between"
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Doses Taken
            </span>
            <span className="text-3xl md:text-5xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.totalTaken}
            </span>
            <p className="text-xs text-black/50 dark:text-white/50 mt-2 font-medium">
              Confirmed across all prescriptions
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-5 md:p-6 rounded-3xl flex flex-col justify-between"
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Doses Missed
            </span>
            <span className="text-3xl md:text-5xl font-black text-rose-500">
              {stats.totalMissed}
            </span>
            <p className="text-xs text-black/50 dark:text-white/50 mt-2 font-medium">
              Automated email alerts sent
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card p-5 md:p-6 rounded-3xl flex flex-col justify-between"
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-500" /> Prescriptions with Notes
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-5xl font-black">{stats.withNotesCount}</span>
              <span className="text-sm text-black/40 dark:text-white/40 font-bold">/ {stats.totalMedicines}</span>
            </div>
            <p className="text-xs text-black/50 dark:text-white/50 mt-2 font-medium">
              Detailed doctor advice available
            </p>
          </motion.div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Weekly 7-Day Trend BarChart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 md:p-8 rounded-3xl lg:col-span-2 flex flex-col justify-between"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-base md:text-lg">7-Day Adherence Telemetry</h3>
                <p className="text-xs font-medium text-black/50 dark:text-white/50">Daily taken vs missed doses calculated from logs</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-indigo-500"></span> Taken
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500"></span> Missed
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="taken" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="missed" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Adherence Distribution Donut */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6 md:p-8 rounded-3xl flex flex-col justify-between"
          >
            <div>
              <h3 className="font-bold text-base md:text-lg mb-1">Dose Distribution</h3>
              <p className="text-xs font-medium text-black/50 dark:text-white/50">Adherence success vs missed ratio</p>
            </div>

            <div className="h-56 relative flex items-center justify-center my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center pointer-events-none">
                <span className="text-2xl font-black">{stats.overallAdherence}%</span>
                <span className="text-[10px] font-bold uppercase text-black/40 dark:text-white/40">Success</span>
              </div>
            </div>

            <div className="flex justify-around text-xs font-bold pt-3 border-t border-black/5 dark:border-white/5">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Taken: {stats.totalTaken}
              </span>
              <span className="flex items-center gap-1.5 text-rose-500">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Missed: {stats.totalMissed}
              </span>
            </div>
          </motion.div>
        </div>

        {/* SECTION: Complete Prescription Notes & Clinical Instructions */}
        <section className="mt-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 text-xs font-bold uppercase tracking-wider mb-2">
                <FileText className="w-3.5 h-3.5" /> Doctor & Clinical Instructions
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                All Prescription Notes & Guidelines
              </h2>
              <p className="text-sm font-medium text-black/60 dark:text-white/60 mt-1">
                View, copy, or edit doctor's special advice for every prescribed medication.
              </p>
            </div>

            {/* Search & Filter Controls */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes or medicine..."
                  className="w-full bg-black/5 dark:bg-white/5 pl-9 pr-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 border border-transparent focus:border-indigo-500 transition-all text-black dark:text-white"
                />
              </div>

              <div className="flex items-center rounded-xl bg-black/5 dark:bg-white/5 p-1 text-xs font-bold">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${activeFilter === 'all' ? 'bg-white dark:bg-[#111] shadow-sm text-black dark:text-white' : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'}`}
                >
                  All ({medicines.length})
                </button>
                <button
                  onClick={() => setActiveFilter('with-notes')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${activeFilter === 'with-notes' ? 'bg-white dark:bg-[#111] shadow-sm text-black dark:text-white' : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'}`}
                >
                  With Notes ({stats.withNotesCount})
                </button>
                <button
                  onClick={() => setActiveFilter('needs-notes')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${activeFilter === 'needs-notes' ? 'bg-white dark:bg-[#111] shadow-sm text-black dark:text-white' : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'}`}
                >
                  Needs Notes ({medicines.length - stats.withNotesCount})
                </button>
              </div>
            </div>
          </div>

          {/* Medicines & Notes Cards Grid */}
          {filteredMedicines.length === 0 ? (
            <div className="glass-card rounded-3xl p-12 text-center border-dashed border-2 border-black/10 dark:border-white/10 my-8">
              <FileText className="w-10 h-10 text-black/20 dark:text-white/20 mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-1">No medication notes found</h3>
              <p className="text-sm text-black/50 dark:text-white/50 max-w-sm mx-auto font-medium">
                {searchQuery ? `No medications matching "${searchQuery}".` : 'Add your first medication from the dashboard to track its instructions.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredMedicines.map((med, idx) => {
                const isEditing = editingId === med._id;
                const hasNotes = med.notes && med.notes.trim().length > 0;
                const medTaken = (med.takenLogs || []).length;
                const medMissed = (med.missedLogs || []).length;
                const medTotal = medTaken + medMissed;
                const medAdherence = medTotal > 0 ? Math.round((medTaken / medTotal) * 100) : 100;

                return (
                  <motion.div
                    key={med._id || idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="glass-card rounded-3xl p-6 flex flex-col justify-between border border-black/5 dark:border-white/5 hover:border-indigo-500/30 transition-all duration-300 relative group"
                  >
                    {/* Top Row: Name, Dosage, Schedule */}
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                            <Pill size={20} />
                          </div>
                          <div>
                            <h3 className="text-xl font-black capitalize leading-tight">{med.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-bold text-black/60 dark:text-white/60">
                                {med.dosage}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-black/20 dark:text-white/20"></span>
                              <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">
                                {med.frequency}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {hasNotes && (
                            <button
                              onClick={() => copyToClipboard(med.notes, med._id)}
                              className="p-2 rounded-xl text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                              title="Copy Notes"
                            >
                              {copiedId === med._id ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                            </button>
                          )}
                          {!isEditing && (
                            <button
                              onClick={() => startEditing(med)}
                              className="p-2 rounded-xl text-black/40 dark:text-white/40 hover:text-indigo-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                              title="Edit Instructions"
                            >
                              <Edit3 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Reminder Times Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 my-3">
                        <span className="text-[11px] font-bold text-black/40 dark:text-white/40 flex items-center gap-1 mr-1">
                          <Clock size={12} /> Times:
                        </span>
                        {(med.reminderTimes || []).map((t, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/70"
                          >
                            {t}
                          </span>
                        ))}
                      </div>

                      {/* The Main Notes / Prescription Advice Card */}
                      <div className={`mt-4 p-4 rounded-2xl border transition-all ${
                        hasNotes 
                          ? 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/20 text-black dark:text-white' 
                          : 'bg-black/5 dark:bg-white/5 border-dashed border-black/10 dark:border-white/10 text-black/50 dark:text-white/50'
                      }`}>
                        <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                          <FileText size={14} /> Clinical Notes & Doctor Guidance
                        </div>

                        {isEditing ? (
                          <div className="space-y-3">
                            <textarea
                              rows={3}
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              placeholder="e.g. Take 1 tablet after breakfast with warm water. Avoid dairy products within 2 hours."
                              className="w-full bg-white dark:bg-[#111] p-3 rounded-xl text-sm font-medium border border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black dark:text-white shadow-inner resize-none"
                            />
                            <div className="flex justify-end items-center gap-2">
                              <button
                                onClick={cancelEditing}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveNotes(med._id)}
                                disabled={isSavingNote}
                                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                              >
                                <Save size={13} /> {isSavingNote ? 'Saving...' : 'Save to MongoDB'}
                              </button>
                            </div>
                          </div>
                        ) : hasNotes ? (
                          <p className="text-sm font-medium leading-relaxed whitespace-pre-line text-black/80 dark:text-white/90">
                            {med.notes}
                          </p>
                        ) : (
                          <div className="flex items-center justify-between py-1">
                            <p className="text-xs font-medium italic">
                              No instructions added yet.
                            </p>
                            <button
                              onClick={() => startEditing(med)}
                              className="text-xs font-bold text-indigo-500 hover:underline cursor-pointer"
                            >
                              + Add Notes
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Metadata & Adherence Mini Bar */}
                    <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-black/50 dark:text-white/50">Adherence:</span>
                        <span className={`font-bold ${medAdherence >= 80 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {medAdherence}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-black/40 dark:text-white/40 font-semibold">
                        <span>Taken: {medTaken}</span>
                        <span>Missed: {medMissed}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Analytics;
