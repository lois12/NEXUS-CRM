import { useState, FormEvent, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Eye, EyeOff, ArrowRight, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { NexusLogo } from '../components/ui/NexusLogo';
import { CyberBackground } from '../components/ui/CyberBackground';
import { GlitchTransition } from '../components/ui/GlitchTransition';
import QRLogin from '../components/auth/QRLogin';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const [loginMode, setLoginMode] = useState<'password' | 'qr'>('password');
  const { login, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const handleGlitchComplete = useCallback(() => {
    navigate(returnTo || '/');
  }, [navigate, returnTo]);

  const handleQRLogin = useCallback((token: string, user: any) => {
    loginWithToken(token, user);
    setGlitchActive(true);
  }, [loginWithToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ username, password }, rememberMe);
      setGlitchActive(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlitchTransition active={glitchActive} onComplete={handleGlitchComplete} duration={800} />
      <CyberBackground />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, filter: 'blur(10px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center justify-center mb-5"
          >
            <NexusLogo size={88} showText={false} variant="full" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, letterSpacing: '0.5em' }}
            animate={{ opacity: 1, letterSpacing: '0.2em' }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-4xl font-bold font-mono mb-2"
            style={{
              background: 'linear-gradient(135deg, #00ff88 0%, #00d4ff 50%, #00ff88 100%)',
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            NEXUS
          </motion.h1>

          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="h-px mx-auto mb-2"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.3), rgba(0,212,255,0.3), transparent)',
              maxWidth: 200,
            }}
          />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="font-mono text-xs tracking-widest"
            style={{ color: '#4a4a60' }}
          >
            CRM SYSTEM v2.0
          </motion.p>
        </div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="relative"
        >
          <div
            className="absolute -inset-px rounded-2xl opacity-50"
            style={{
              background: 'linear-gradient(135deg, rgba(0,255,136,0.2), transparent, rgba(0,212,255,0.2))',
              filter: 'blur(1px)',
            }}
          />

          <div className="glass-frost rounded-2xl p-6 md:p-8 relative">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#00ff88', boxShadow: '0 0 6px #00ff88' }} />
                <span className="font-mono text-xs" style={{ color: '#00ff88' }}>SECURE CONNECTION</span>
              </div>
              <h2 className="text-lg font-semibold font-mono" style={{ color: '#e8e8ec' }}>
                Авторизация
              </h2>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-lg"
                style={{ backgroundColor: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)' }}
              >
                <p className="text-sm font-mono" style={{ color: '#ff3b30' }}>{error}</p>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-xs font-mono mb-2 tracking-wider" style={{ color: '#4a4a60' }}>
                  ЛОГИН
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#4a4a60' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl font-mono text-sm outline-none"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: '#e8e8ec',
                    }}
                    placeholder="Liberty"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-mono mb-2 tracking-wider" style={{ color: '#4a4a60' }}>
                  ПАРОЛЬ
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#4a4a60' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-xl font-mono text-sm outline-none"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: '#e8e8ec',
                    }}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: '#4a4a60' }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className="w-4 h-4 rounded border transition-all flex items-center justify-center"
                    style={{
                      backgroundColor: rememberMe ? 'rgba(0,255,136,0.15)' : 'rgba(0,0,0,0.4)',
                      borderColor: rememberMe ? 'rgba(0,255,136,0.5)' : 'rgba(255,255,255,0.1)',
                      boxShadow: rememberMe ? '0 0 8px rgba(0,255,136,0.2)' : 'none',
                    }}
                  >
                    {rememberMe && (
                      <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="font-mono text-xs tracking-wider transition-colors" style={{ color: rememberMe ? '#6b7280' : '#4a4a60' }}>
                  ЗАПОМНИТЬ МЕНЯ
                </span>
              </label>

              {/* Submit */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl font-bold font-mono text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #00ff88, #00cc6a)',
                  color: '#000',
                  boxShadow: '0 0 20px rgba(0,255,136,0.2)',
                }}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    ВХОД...
                  </>
                ) : (
                  <>
                    ВОЙТИ
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Login mode toggle */}
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <button onClick={() => setLoginMode(loginMode === 'password' ? 'qr' : 'password')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-mono transition-all hover:bg-white/5"
                style={{ color: '#8a8aa0', border: '1px solid rgba(255,255,255,0.06)' }}>
                {loginMode === 'password' ? (
                  <><Smartphone className="w-4 h-4" /> Войти через QR-код</>
                ) : (
                  <><Lock className="w-4 h-4" /> Войти с паролем</>
                )}
              </button>
            </div>

            {/* QR Login */}
            {loginMode === 'qr' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mt-4 flex justify-center">
                <QRLogin onLogin={handleQRLogin} />
              </motion.div>
            )}

            {/* Hint */}
            <div className="mt-4">
              <p className="text-xs font-mono text-center" style={{ color: '#3a3a50' }}>
                NEXUS CRM // авторизуйтесь для продолжения
              </p>
            </div>
          </div>
        </motion.div>

        {/* Bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-6 text-center"
        >
          <p className="font-mono text-xs" style={{ color: '#2a2a3a' }}>
            NEXUS CRM &copy; 2024
          </p>
        </motion.div>
      </div>
    </div>
  );
}
