import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shuffle, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Coins, Users, Hash, Trophy, RotateCcw, Copy, Check } from 'lucide-react';
import { showToast } from '../components/ui/NexusModal';

type Mode = 'number' | 'names' | 'coin' | 'dice';

const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

export default function Randomizer() {
  const [mode, setMode] = useState<Mode>('number');
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Number mode
  const [minNum, setMinNum] = useState(1);
  const [maxNum, setMaxNum] = useState(100);

  // Names mode
  const [namesInput, setNamesInput] = useState('');
  const [winnersCount, setWinnersCount] = useState(1);
  const [winners, setWinners] = useState<string[]>([]);

  // Dice mode
  const [diceCount, setDiceCount] = useState(1);
  const [diceResults, setDiceResults] = useState<number[]>([]);

  // Coin mode
  const [coinResult, setCoinResult] = useState<'heads' | 'tails' | null>(null);

  // Animation
  const [displayValue, setDisplayValue] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startSpin = (finalValue: string, onDone: () => void) => {
    setIsSpinning(true);
    setResult(null);
    let count = 0;
    const maxCount = 20;

    intervalRef.current = setInterval(() => {
      count++;
      if (mode === 'number') {
        setDisplayValue(String(Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum));
      } else if (mode === 'dice') {
        setDisplayValue(String(Math.floor(Math.random() * 6) + 1));
      } else if (mode === 'coin') {
        setDisplayValue(Math.random() > 0.5 ? 'ОРЁЛ' : 'РЕШКА');
      }

      if (count >= maxCount) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayValue(finalValue);
        setIsSpinning(false);
        setResult(finalValue);
        onDone();
      }
    }, 80);
  };

  const generateNumber = () => {
    if (minNum >= maxNum) {
      showToast('Минимум должен быть меньше максимума', 'error');
      return;
    }
    const value = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
    startSpin(String(value), () => {});
  };

  const pickWinners = () => {
    const names = namesInput.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) {
      showToast('Введите имена', 'error');
      return;
    }
    if (winnersCount > names.length) {
      showToast('Победителей больше чем участников', 'error');
      return;
    }

    setIsSpinning(true);
    setWinners([]);
    let count = 0;

    intervalRef.current = setInterval(() => {
      count++;
      // Show random names during spin
      const shuffled = [...names].sort(() => Math.random() - 0.5);
      setWinners(shuffled.slice(0, winnersCount));

      if (count >= 20) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        // Final selection
        const shuffledFinal = [...names].sort(() => Math.random() - 0.5);
        const selected = shuffledFinal.slice(0, winnersCount);
        setWinners(selected);
        setIsSpinning(false);
        setResult(selected.join(', '));
      }
    }, 80);
  };

  const flipCoin = () => {
    const value = Math.random() > 0.5 ? 'ОРЁЛ' : 'РЕШКА';
    setCoinResult(value === 'ОРЁЛ' ? 'heads' : 'tails');
    startSpin(value, () => {});
  };

  const rollDice = () => {
    const results = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
    const total = results.reduce((a, b) => a + b, 0);
    const display = diceCount === 1 ? String(results[0]) : `${results.join(' + ')} = ${total}`;

    setIsSpinning(true);
    setDiceResults([]);

    let count = 0;
    intervalRef.current = setInterval(() => {
      count++;
      setDiceResults(Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1));

      if (count >= 20) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDiceResults(results);
        setIsSpinning(false);
        setResult(display);
      }
    }, 80);
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const reset = () => {
    setResult(null);
    setWinners([]);
    setDiceResults([]);
    setCoinResult(null);
    setDisplayValue('');
  };

  const modes = [
    { id: 'number' as Mode, label: 'ЧИСЛО', icon: Hash, color: '#00ff88' },
    { id: 'names' as Mode, label: 'ИМЕНА', icon: Users, color: '#00d4ff' },
    { id: 'coin' as Mode, label: 'МОНЕТА', icon: Coins, color: '#eab308' },
    { id: 'dice' as Mode, label: 'КУБИК', icon: Dice1, color: '#bf00ff' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
          <Shuffle className="w-7 h-7 md:w-8 md:h-8" />
          РАНДОМАЙЗЕР
        </h1>
        <p className="text-gray-400 mt-1 font-mono text-sm">// ЖЕРЕБЬЁВКА, СЛУЧАЙНЫЕ ЧИСЛА, ВЫБОР ПОБЕДИТЕЛЯ</p>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {modes.map(m => {
          const Icon = m.icon;
          return (
            <button key={m.id} onClick={() => { setMode(m.id); reset(); }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
              style={mode === m.id
                ? { backgroundColor: `${m.color}20`, border: `1px solid ${m.color}40`, color: m.color }
                : { backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid transparent', color: '#9ca3af' }
              }>
              <Icon className="w-5 h-5" />
              <span className="text-xs font-mono font-bold">{m.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="glass rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)' }}>НАСТРОЙКИ</h2>

          {mode === 'number' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1">МИНИМУМ</label>
                  <input type="number" value={minNum} onChange={e => setMinNum(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1">МАКСИМУМ</label>
                  <input type="number" value={maxNum} onChange={e => setMaxNum(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 font-mono text-sm" />
                </div>
              </div>
              {/* Quick presets */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: '1-10', min: 1, max: 10 },
                  { label: '1-100', min: 1, max: 100 },
                  { label: '1-1000', min: 1, max: 1000 },
                  { label: '1-6 (кубик)', min: 1, max: 6 },
                ].map(p => (
                  <button key={p.label} onClick={() => { setMinNum(p.min); setMaxNum(p.max); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono glass hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>
              <button onClick={generateNumber} disabled={isSpinning}
                className="w-full py-3 rounded-xl font-mono font-bold transition-all disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                {isSpinning ? 'ГЕНЕРАЦИЯ...' : 'ГЕНЕРИРОВАТЬ'}
              </button>
            </>
          )}

          {mode === 'names' && (
            <>
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">УЧАСТНИКИ (каждый с новой строки)</label>
                <textarea value={namesInput} onChange={e => setNamesInput(e.target.value)}
                  placeholder={'Иван\nМария\nПетр\nАнна\nСергей'}
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 font-mono text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">КОЛИЧЕСТВО ПОБЕДИТЕЛЕЙ</label>
                <input type="number" min={1} value={winnersCount} onChange={e => setWinnersCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 font-mono text-sm" />
              </div>
              <button onClick={pickWinners} disabled={isSpinning}
                className="w-full py-3 rounded-xl font-mono font-bold transition-all disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                {isSpinning ? 'ВЫБИРАЕМ...' : 'ВЫБРАТЬ ПОБЕДИТЕЛЯ'}
              </button>
            </>
          )}

          {mode === 'coin' && (
            <div className="text-center py-8">
              <motion.button onClick={flipCoin} disabled={isSpinning}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-4 transition-all disabled:opacity-50"
                style={{
                  background: coinResult === 'heads' ? 'linear-gradient(135deg, #00ff88, #00cc6a)' : coinResult === 'tails' ? 'linear-gradient(135deg, #ff3b30, #cc0000)' : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                  border: '2px solid rgba(255,255,255,0.2)',
                  color: coinResult ? '#000' : '#6b7280',
                  boxShadow: coinResult ? '0 0 30px rgba(0,255,136,0.3)' : 'none',
                }}>
                <Coins className="w-12 h-12" />
              </motion.button>
              <p className="font-mono text-sm text-gray-400">Нажми для подбрасывания</p>
            </div>
          )}

          {mode === 'dice' && (
            <>
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">КОЛИЧЕСТВО КУБИКОВ</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <button key={n} onClick={() => setDiceCount(n)}
                      className="flex-1 py-2 rounded-lg font-mono text-sm transition-all"
                      style={diceCount === n
                        ? { backgroundColor: 'var(--color-primary)', color: '#000' }
                        : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#9ca3af' }
                      }>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={rollDice} disabled={isSpinning}
                className="w-full py-3 rounded-xl font-mono font-bold transition-all disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                {isSpinning ? 'БРОСАЕМ...' : 'БРОСИТЬ КУБИК'}
              </button>
            </>
          )}
        </div>

        {/* Result */}
        <div className="glass rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)' }}>РЕЗУЛЬТАТ</h2>
            {result && (
              <div className="flex gap-2">
                <button onClick={copyResult} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button onClick={reset} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center">
            {mode === 'number' && (
              <div className="text-center">
                <motion.div animate={isSpinning ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 0.2 }}
                  className="text-6xl md:text-8xl font-mono font-bold neon-text"
                  style={{ color: 'var(--color-primary)', textShadow: '0 0 30px var(--color-glow)' }}>
                  {displayValue || '?'}
                </motion.div>
                {result && <p className="font-mono text-sm text-gray-400 mt-4">Диапазон: {minNum} — {maxNum}</p>}
              </div>
            )}

            {mode === 'names' && (
              <div className="text-center w-full">
                {winners.length > 0 ? (
                  <div className="space-y-3">
                    {winners.map((w, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)' }}>
                        <Trophy className="w-5 h-5 flex-shrink-0" style={{ color: i === 0 ? '#ffd700' : '#c0c0c0' }} />
                        <span className="font-mono text-lg font-bold text-gray-200">{w}</span>
                        {i === 0 && winners.length > 1 && (
                          <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(255,215,0,0.2)', color: '#ffd700' }}>
                            ПОБЕДИТЕЛЬ
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">
                    <Users className="w-16 h-16 mx-auto mb-3 opacity-30" />
                    <p className="font-mono text-sm">Введите имена участников</p>
                  </div>
                )}
              </div>
            )}

            {mode === 'coin' && (
              <div className="text-center">
                <motion.div animate={isSpinning ? { rotateY: 360 } : {}}
                  transition={{ repeat: Infinity, duration: 0.3 }}
                  className="text-5xl md:text-7xl font-mono font-bold"
                  style={{ color: coinResult === 'heads' ? '#00ff88' : coinResult === 'tails' ? '#ff3b30' : '#6b7280' }}>
                  {displayValue || '?'}
                </motion.div>
                {coinResult && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: coinResult === 'heads' ? '#00ff88' : '#ff3b30' }} />
                    <span className="font-mono text-sm text-gray-400">
                      {coinResult === 'heads' ? 'ОРЁЛ' : 'РЕШКА'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {mode === 'dice' && (
              <div className="text-center">
                {diceResults.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-4">
                    {diceResults.map((d, i) => {
                      const DiceIcon = DICE_ICONS[d - 1];
                      return (
                        <motion.div key={i}
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: i * 0.1, type: 'spring' }}>
                          <DiceIcon className="w-16 h-16 md:w-20 md:h-20" style={{ color: 'var(--color-primary)' }} />
                        </motion.div>
                      );
                    })}
                    {diceResults.length > 1 && (
                      <div className="w-full mt-2">
                        <span className="font-mono text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                          = {diceResults.reduce((a, b) => a + b, 0)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500">
                    <Dice1 className="w-16 h-16 mx-auto mb-3 opacity-30" />
                    <p className="font-mono text-sm">Нажми "Бросить кубик"</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History hint */}
          {result && !isSpinning && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-center">
              <span className="font-mono text-xs text-gray-500">// РЕЗУЛЬТАТ СКОПИРОВАН ПРИ НАЖАТИИ</span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
