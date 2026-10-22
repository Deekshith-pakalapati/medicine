import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Users, User as UserIcon, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '../components/ThemeToggle';
import toast from 'react-hot-toast';

const RoleSelection = () => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [inviteCode, setInviteCode] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    const syncAndFetchUser = async () => {
      try {
        const token = await getToken();
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await fetch(`${import.meta.env.VITE_API_URL}/users/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: user?.fullName || 'User',
            email: user?.primaryEmailAddress?.emailAddress || 'user@example.com',
            profileImage: user?.imageUrl || ''
          })
        });

        if (res.ok) {
          const data = await res.json();
          setDbUser(data);
          if (data.role) {
            navigate(data.role === 'Parent' ? '/dashboard' : '/mentee-dashboard');
            return;
          }
        }
      } catch (error) {
        console.warn('Error during user sync:', error);
      } finally {
        setLoading(false);
      }
    };
    if (user) syncAndFetchUser();
  }, [user, getToken, navigate]);

  const selectRole = async (selectedRole) => {
    setRoleLoading(selectedRole);
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: selectedRole })
      });

      let data = null;
      if (res.ok) {
        data = await res.json();
        setDbUser(data);
      } else {
        data = { role: selectedRole };
        setDbUser(data);
      }

      if (selectedRole === 'Parent') {
        toast.success('Welcome! Opening your patient dashboard...');
        navigate('/dashboard');
      }
    } catch (error) {
      console.warn('Role selection error:', error);
      if (selectedRole === 'Parent') {
        navigate('/dashboard');
      } else {
        setDbUser({ role: 'Mentee' });
      }
    } finally {
      setRoleLoading(null);
    }
  };

  const linkParent = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLinkError('');
    setLinking(true);

    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() })
      });

      if (res.ok) {
        toast.success('Successfully linked to patient!');
        navigate('/mentee-dashboard');
      } else {
        const errData = await res.json().catch(() => ({}));
        setLinkError(errData.message || 'Invalid code. Please check with the patient.');
      }
    } catch (error) {
      setLinkError('Connection error. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black/30 dark:text-white/30" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 dark:bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>

      {/* Navbar */}
      <nav className="flex justify-between items-center px-8 py-6">
        <span className="text-xl font-bold tracking-tight text-gradient">MediCare</span>
        <ThemeToggle />
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-center mb-12">
              <h1 className="text-5xl font-extrabold tracking-tighter mb-4">
                Who are you?
              </h1>
              <p className="text-black/50 dark:text-white/50 font-medium text-lg">
                Select your role to personalize your experience.
              </p>
            </div>

            <AnimatePresence mode="wait">
              {!dbUser?.role ? (
                <motion.div
                  key="role-select"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid md:grid-cols-2 gap-5"
                >
                  {[
                    {
                      role: 'Parent',
                      icon: UserIcon,
                      title: "I'm the Patient",
                      desc: 'Manage my medicines, view my schedule, and receive voice reminders.',
                    },
                    {
                      role: 'Mentee',
                      icon: Users,
                      title: "I'm the Caregiver",
                      desc: "Monitor a patient's adherence and receive real-time missed-dose alerts.",
                    }
                  ].map(({ role, icon: Icon, title, desc }) => (
                    <button
                      key={role}
                      onClick={() => selectRole(role)}
                      disabled={roleLoading !== null}
                      className="group glass-card rounded-3xl p-8 text-left hover:-translate-y-1 transition-all duration-300 border border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-6 group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors duration-300">
                        {roleLoading === role ? (
                          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                        ) : (
                          <Icon className="w-6 h-6 text-black dark:text-white" />
                        )}
                      </div>
                      <h3 className="text-xl font-bold mb-2 text-black dark:text-white">{title}</h3>
                      <p className="text-black/50 dark:text-white/50 text-sm leading-relaxed font-medium">{desc}</p>
                      <div className="mt-6 flex items-center gap-1 text-sm font-semibold text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Continue <ArrowRight className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </motion.div>
              ) : dbUser?.role === 'Mentee' && !dbUser?.linkedParentId ? (
                <motion.div
                  key="link-parent"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="glass-card rounded-3xl p-10 max-w-md mx-auto"
                >
                  <button
                    onClick={() => setDbUser(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white mb-6 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Role Selection
                  </button>

                  <h2 className="text-2xl font-bold tracking-tight mb-2 text-black dark:text-white">Connect to Patient</h2>
                  <p className="text-black/50 dark:text-white/50 font-medium text-sm mb-6 leading-relaxed">
                    Have your patient's invite code? Enter it below, or jump directly into the Caregiver Dashboard and link anytime.
                  </p>

                  <form onSubmit={linkParent} className="space-y-4">
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="XXXXXX"
                      className="w-full bg-black/5 dark:bg-white/5 px-5 py-4 rounded-2xl text-center text-2xl tracking-[0.5em] font-mono border border-black/10 dark:border-white/10 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors uppercase text-black dark:text-white"
                      maxLength={8}
                    />

                    {linkError && (
                      <p className="text-red-500 dark:text-red-400 text-sm font-medium text-center">{linkError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={linking || !inviteCode.trim()}
                      className="w-full py-4 rounded-2xl text-white font-semibold bg-[#111] dark:bg-white dark:text-black hover:opacity-90 transition-opacity shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {linking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Link Account'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        toast.success('Welcome to Caregiver Dashboard!');
                        navigate('/mentee-dashboard');
                      }}
                      className="w-full py-3.5 rounded-2xl text-sm font-bold text-black/70 dark:text-white/70 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Continue to Caregiver Dashboard <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div key="redirecting" className="text-center text-black/50 dark:text-white/50 font-medium">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-4" />
                  Redirecting to your dashboard...
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default RoleSelection;
