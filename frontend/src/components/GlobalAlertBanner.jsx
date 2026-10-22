import { useEffect, useState, useRef } from 'react';
import { useReminders } from '../hooks/useReminders';
import { useAuth } from '@clerk/clerk-react';
import { Bell, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const GlobalAlertBanner = () => {
  const { activeAlarm, handleMarkTaken, dismissAlarm } = useReminders();
  const { getToken } = useAuth();
  const [voiceFinished, setVoiceFinished] = useState(false);
  const [countdown, setCountdown] = useState(30); // 30 seconds countdown after voice alert
  const timerRef = useRef(null);

  // Trigger missed dose alert email
  const triggerMissedAlert = async (alarm) => {
    if (!alarm) return;
    try {
      const token = await getToken();
      const todayDate = new Date().toISOString().split('T')[0];
      await fetch(`${import.meta.env.VITE_API_URL}/medicines/${alarm.medicine._id}/missed-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: todayDate, time: alarm.time })
      });
      toast.error(`Missed dose alert sent for ${alarm.medicine.name} to email!`, {
        icon: '⚠️',
        duration: 4000
      });
    } catch (e) {
      console.warn('Failed to send missed dose alert:', e);
    }
  };

  useEffect(() => {
    if (activeAlarm) {
      setVoiceFinished(false);
      setCountdown(30);

      const playVoiceAlert = () => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel(); // clear previous
          
          const med = activeAlarm.medicine;
          const textTelugu = `మీరు మందులు వేసుకునే సమయం ఆసన్నమైంది. దయచేసి ఇప్పుడు ${med.name} వేసుకోండి.`;
          const textEnglish = `It is time to take your medicine. Please take ${med.name} now.`;

          const uTe = new SpeechSynthesisUtterance(textTelugu);
          uTe.lang = 'te-IN';
          uTe.rate = 0.9;
          uTe.pitch = 1.1;

          const uEn = new SpeechSynthesisUtterance(textEnglish);
          uEn.lang = 'en-US';
          uEn.rate = 0.9;
          uEn.pitch = 1.1;

          // When the voice reminder finishes speaking:
          uEn.onend = () => {
            setVoiceFinished(true);
          };

          // Fallback in case speech synthesis is blocked or silent
          const fallbackTimeout = setTimeout(() => {
            setVoiceFinished(true);
          }, 8000);

          // Play Telugu first, then English
          window.speechSynthesis.speak(uTe);
          window.speechSynthesis.speak(uEn);

          return () => clearTimeout(fallbackTimeout);
        } else {
          setVoiceFinished(true);
        }
      };

      playVoiceAlert();
    } else {
      window.speechSynthesis?.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [activeAlarm]);

  // Countdown timer after voice reminder completes
  useEffect(() => {
    if (activeAlarm && voiceFinished) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            // Time expired without user taking medicine -> send missed email!
            triggerMissedAlert(activeAlarm);
            dismissAlarm();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [activeAlarm, voiceFinished]);

  const onDismissOrSnooze = () => {
    // If user snoozes/dismisses without taking the medicine, send missed dose email
    if (activeAlarm) {
      triggerMissedAlert(activeAlarm);
    }
    dismissAlarm();
  };

  return (
    <AnimatePresence>
      {activeAlarm && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex justify-center p-4 pointer-events-none"
        >
          <div className="bg-white dark:bg-[#111] pointer-events-auto border-2 border-indigo-500 shadow-2xl rounded-2xl p-5 max-w-xl w-full flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center shrink-0 animate-pulse shadow-lg shadow-indigo-500/30">
                <Bell className="w-6 h-6 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-black text-[#111] dark:text-white truncate">
                  Time for {activeAlarm.medicine.name}
                </h2>
                <p className="text-sm font-bold text-indigo-500 truncate">
                  {activeAlarm.medicine.dosage} &bull; Scheduled {activeAlarm.time}
                </p>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => {
                    if (timerRef.current) clearInterval(timerRef.current);
                    handleMarkTaken();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white font-bold text-sm bg-green-500 hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> Taken
                </button>
                <button 
                  onClick={onDismissOrSnooze}
                  className="px-4 py-2.5 rounded-xl text-[#111] dark:text-white font-bold text-sm bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors cursor-pointer"
                >
                  Snooze
                </button>
              </div>
            </div>

            {/* Voice status & auto-missed email countdown */}
            <div className="flex items-center justify-between text-xs pt-2 border-t border-black/5 dark:border-white/5 font-medium">
              <span className="flex items-center gap-1.5 text-black/60 dark:text-white/60">
                {!voiceFinished ? (
                  <span className="flex items-center gap-1 text-indigo-500 font-semibold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Playing voice reminder in Telugu & English...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✓ Voice reminder completed
                  </span>
                )}
              </span>

              {voiceFinished && (
                <span className="flex items-center gap-1 text-rose-500 font-bold">
                  <Clock className="w-3.5 h-3.5" /> Missed email in {countdown}s if not taken
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalAlertBanner;
