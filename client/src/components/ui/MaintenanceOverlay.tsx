import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, AlertTriangle } from 'lucide-react';
import { dashboardApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function MaintenanceOverlay() {
  const { user } = useAuth();
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Super admins don't see the overlay
    if (user?.role === 'super_admin') return;

    const check = async () => {
      try {
        const res = await dashboardApi.getMaintenance();
        if (res.success && res.data) setActive(res.data.active);
      } catch {}
    };

    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [user]);

  if (!active || user?.role === 'super_admin') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ backgroundColor: 'rgba(10, 10, 15, 0.97)', backdropFilter: 'blur(20px)' }}
      >
        {/* Scanline */}
        <motion.div
          initial={{ top: '-2px' }}
          animate={{ top: '100%' }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="absolute left-0 right-0 h-[2px] pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, #eab308, transparent)', boxShadow: '0 0 20px #eab308' }}
        />

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-md px-6"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <Wrench className="w-16 h-16 mx-auto mb-6" style={{ color: '#eab308' }} />
          </motion.div>

          <h1
            className="text-3xl md:text-4xl font-bold font-mono mb-4"
            style={{ color: '#eab308', textShadow: '0 0 30px rgba(234,179,8,0.4)' }}
          >
            ТЕХОБСЛУЖИВАНИЕ
          </h1>

          <div className="h-[1px] mx-auto mb-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.3), transparent)', maxWidth: 200 }} />

          <p className="font-mono text-sm mb-2" style={{ color: '#6b7280' }}>
            Система находится на техобслуживании.
          </p>
          <p className="font-mono text-xs" style={{ color: '#4a4a60' }}>
            Пожалуйста, попробуйте позже.
          </p>

          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mt-6 flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" style={{ color: '#eab308' }} />
            <span className="font-mono text-xs" style={{ color: '#eab308' }}>WORK IN PROGRESS</span>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
