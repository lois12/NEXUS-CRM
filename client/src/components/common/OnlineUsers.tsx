import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users } from 'lucide-react';
import { getSocket } from '../../services/socket';
import { usersApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface OnlineUser {
  id: string;
  fullName: string;
  avatar?: string;
}

export default function OnlineUsers() {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<OnlineUser[]>([]);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    usersApi.getAll().then(res => {
      if (res.success && res.data) setAllUsers(res.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleOnline = (ids: string[]) => {
      setOnlineIds(ids.filter(id => id !== user?.id));
    };

    socket.on('users:online', handleOnline);
    return () => { socket.off('users:online', handleOnline); };
  }, [user?.id]);

  const onlineUsers = allUsers.filter(u => onlineIds.includes(u.id));
  const count = onlineUsers.length;

  return (
    <div className="relative">
      <button
        onClick={() => setShowList(!showList)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all hover:bg-white/5"
        style={{ border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="relative">
          <Users className="w-4 h-4" style={{ color: '#5a5a70' }} />
          {count > 0 && (
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full online-pulse"
              style={{ background: '#00ff88', boxShadow: '0 0 6px rgba(0,255,136,0.5)' }} />
          )}
        </div>
        <span className="text-[10px] font-mono" style={{ color: count > 0 ? 'var(--color-primary)' : '#5a5a70' }}>
          {count}
        </span>
      </button>

      <AnimatePresence>
        {showList && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden z-50"
            style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
          >
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-[10px] font-mono tracking-wider" style={{ color: '#5a5a70' }}>
                ОНЛАЙН ({count})
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {onlineUsers.length === 0 ? (
                <div className="px-4 py-3 text-center">
                  <span className="text-[10px] font-mono" style={{ color: '#4a4a60' }}>Никого нет онлайн</span>
                </div>
              ) : (
                onlineUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-2 hover:bg-white/[0.03] transition-colors">
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {u.avatar ? (
                          <img loading="lazy" decoding="async" src={u.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--color-primary)' }}>
                            {u.fullName?.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                        style={{ background: '#00ff88', border: '2px solid rgba(20,20,35,0.98)', boxShadow: '0 0 4px rgba(0,255,136,0.4)' }} />
                    </div>
                    <span className="text-xs truncate" style={{ color: '#c0c0d0' }}>{u.fullName}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
