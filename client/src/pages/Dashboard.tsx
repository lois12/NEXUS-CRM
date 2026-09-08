import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, QrCode, Wifi, CalendarClock, Sparkles, Shuffle,
  BookOpen, CheckSquare, Users, CloudSun, Package, PartyPopper,
  Rocket, FolderOpen, BarChart3, LucideIcon,
} from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Inject glitch CSS once
const glitchCSS = `
@keyframes glitch-in {
  0% {
    opacity: 0;
    transform: skewX(-8deg) translateX(-10px);
    clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
    filter: brightness(3) saturate(0);
  }
  15% {
    opacity: 1;
    clip-path: polygon(0 0, 40% 0, 35% 100%, 0 100%);
    filter: brightness(2) saturate(0.5);
  }
  30% {
    transform: skewX(3deg) translateX(4px);
    clip-path: polygon(0 0, 65% 0, 70% 100%, 0 100%);
    filter: brightness(1.5) saturate(0.8);
  }
  50% {
    transform: skewX(-1deg) translateX(-2px);
    clip-path: polygon(0 0, 85% 0, 80% 100%, 0 100%);
    filter: brightness(1.2) saturate(1);
  }
  70% {
    transform: skewX(0.5deg) translateX(1px);
    clip-path: polygon(0 0, 95% 0, 98% 100%, 0 100%);
    filter: brightness(1.1);
  }
  100% {
    opacity: 1;
    transform: skewX(0) translateX(0);
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
    filter: brightness(1);
  }
}
@keyframes glitch-out {
  0% {
    opacity: 1;
    transform: skewX(0) translateX(0);
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
    filter: brightness(1);
  }
  25% {
    transform: skewX(4deg) translateX(6px);
    clip-path: polygon(10% 0, 100% 0, 100% 100%, 15% 100%);
    filter: brightness(1.8) saturate(0.6);
  }
  50% {
    transform: skewX(-6deg) translateX(-8px);
    clip-path: polygon(30% 0, 100% 0, 100% 100%, 25% 100%);
    filter: brightness(2.5) saturate(0.3);
  }
  75% {
    opacity: 0.6;
    clip-path: polygon(60% 0, 100% 0, 100% 100%, 55% 100%);
    filter: brightness(3) saturate(0);
  }
  100% {
    opacity: 0;
    clip-path: polygon(100% 0, 100% 0, 100% 100%, 100% 100%);
    filter: brightness(4) saturate(0);
  }
}
.badge-enter { animation: glitch-in 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
.badge-exit { animation: glitch-out 0.4s cubic-bezier(0.55, 0, 1, 0.45) forwards; }
`;
if (typeof document !== 'undefined' && !document.getElementById('glitch-styles')) {
  const style = document.createElement('style');
  style.id = 'glitch-styles';
  style.textContent = glitchCSS;
  document.head.appendChild(style);
}

const MODEL_PATH = '/models/titan.glb';

function EarthScene({ modelPath }: { modelPath: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    // Pull camera back on mobile so model fits
    const isMobile = window.innerWidth < 768;
    camera.position.set(0, 0, isMobile ? 4.2 : 3);

    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio * (isMobile ? 1 : 1.5), 3));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.0);
    sun.position.set(5, 2, 5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x88ccff, 0.6);
    rim.position.set(-3, 1, -5);
    scene.add(rim);
    const back = new THREE.DirectionalLight(0x00ff88, 0.3);
    back.position.set(0, -2, -3);
    scene.add(back);

    // Purple glow light for Titan
    const purpleLight = new THREE.PointLight(0x8800ff, 2, 10);
    purpleLight.position.set(0, 0.5, 0);
    scene.add(purpleLight);

    let pivot: THREE.Group | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let animFrame: number;

    // Star field
    const starsGeometry = new THREE.BufferGeometry();
    const starCount = isMobile ? 1500 : 3000;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const r = 15 + Math.random() * 85;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
      starSizes[i] = 0.5 + Math.random() * 1.5;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // Mouse parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    new GLTFLoader().load(modelPath, (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const s = 2 / maxDim;

      pivot = new THREE.Group();
      model.scale.setScalar(s);
      model.position.set(-center.x * s, -center.y * s, -center.z * s);
      pivot.add(model);
      scene.add(pivot);

      // Add emissive glow to generator/tech parts
      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial;
          const name = child.name.toLowerCase();
          
          // Generator body — purple glow
          if (name.includes('generator') || name.includes('c1a4d')) {
            mat.emissive = new THREE.Color(0x8800ff);
            mat.emissiveIntensity = 0.8;
          }
          // Mine/combine parts — subtle cyan glow
          else if (name.includes('mine') || name.includes('combine')) {
            mat.emissive = new THREE.Color(0x00ffcc);
            mat.emissiveIntensity = 0.3;
          }
          // Tech reference parts — purple pulse
          else if (name.includes('tech_reference')) {
            mat.emissive = new THREE.Color(0xaa00ff);
            mat.emissiveIntensity = 0.5;
          }
        }
      });

      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => mixer!.clipAction(clip).play());
      }
    });

    const resize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Adjust camera distance on resize
      camera.position.z = w < 768 ? 4.2 : 3;
      renderer.setSize(w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    const clock = new THREE.Clock();
    let paused = false;

    const onVisibilityChange = () => {
      paused = document.hidden;
      if (!paused) clock.getDelta(); // reset delta to avoid jump
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const animate = () => {
      animFrame = requestAnimationFrame(animate);
      if (paused) return;
      const delta = clock.getDelta();
      if (mixer) mixer.update(delta);
      if (pivot) pivot.rotation.y += 0.001;

      // Stars drift
      stars.rotation.y += 0.00005;
      stars.rotation.x += 0.00002;

      // Parallax — smooth follow mouse
      targetX += (mouseX * 0.3 - targetX) * 0.02;
      targetY += (mouseY * 0.2 - targetY) * 0.02;
      camera.position.x = targetX;
      camera.position.y = -targetY;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    const el = containerRef.current;
    return () => {
      cancelAnimationFrame(animFrame);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [modelPath]);

  return <div ref={containerRef} className="absolute inset-0" />;
}


const ALL_BADGES: { label: string; icon: LucideIcon }[] = [
  { label: 'Контент-план', icon: Calendar },
  { label: 'QR генератор', icon: QrCode },
  { label: 'IP Ping', icon: Wifi },
  { label: 'Планирование', icon: CalendarClock },
  { label: 'ИИ генерация', icon: Sparkles },
  { label: 'Рандомайзер', icon: Shuffle },
  { label: 'База знаний', icon: BookOpen },
  { label: 'Задачи', icon: CheckSquare },
  { label: 'Партнёры', icon: Users },
  { label: 'Погода', icon: CloudSun },
  { label: 'Оборудование', icon: Package },
  { label: 'Мероприятия', icon: PartyPopper },
  { label: 'Проекты', icon: Rocket },
  { label: 'Материалы', icon: FolderOpen },
  { label: 'Аналитика', icon: BarChart3 },
];

const POSITIONS = [
  { x: '5%', y: '22%' }, { x: '70%', y: '14%' }, { x: '78%', y: '50%' },
  { x: '3%', y: '55%' }, { x: '65%', y: '72%' }, { x: '10%', y: '38%' },
  { x: '75%', y: '32%' }, { x: '8%', y: '75%' }, { x: '60%', y: '85%' },
  { x: '85%', y: '65%' }, { x: '12%', y: '15%' }, { x: '52%', y: '8%' },
];

function randomFrom(arr: typeof ALL_BADGES, exclude: string): typeof ALL_BADGES[0] {
  const filtered = arr.filter(a => a.label !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function FloatingBadges() {
  const [visible, setVisible] = useState<{ id: number; label: string; icon: LucideIcon; pos: typeof POSITIONS[0] }[]>([]);
  const nextId = useRef(0);

  const addBadge = useCallback(() => {
    const id = nextId.current++;
    const currentLabels = visible.map(v => v.label);
    const badge = randomFrom(ALL_BADGES, currentLabels[currentLabels.length - 1] || '');
    const pos = POSITIONS[id % POSITIONS.length];
    setVisible(prev => [...prev.slice(-6), { id, label: badge.label, icon: badge.icon, pos }]);
  }, [visible]);

  useEffect(() => {
    const init = setTimeout(() => {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => addBadge(), i * 400);
      }
    }, 2000);

    const interval = setInterval(() => {
      if (Math.random() > 0.4) addBadge();
      if (visible.length > 5) setVisible(prev => prev.slice(1));
    }, 3000);

    return () => { clearTimeout(init); clearInterval(interval); };
  }, [addBadge, visible.length]);

  return (
    <AnimatePresence>
      {visible.map((badge) => (
        <motion.div
          key={badge.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute z-10 pointer-events-none"
          style={{ left: badge.pos.x, top: badge.pos.y }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="badge-enter">
              <div
                className="flex items-center gap-2 px-3 py-1.5 lg:px-4 lg:py-2 rounded whitespace-nowrap"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
                  color: 'var(--color-primary)',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)',
                  borderBottom: '2px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
                  boxShadow: '0 0 12px var(--color-glow)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  textShadow: '0 0 6px var(--color-glow)',
                }}
              >
                <badge.icon className="w-3 h-3" />
                {badge.label}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

const CONSOLE_LINES = [
  '> initializing neural link... done',
  '> connecting to nexus core... ok',
  '> loading modules [22/22] ████████ 100%',
  '> system status: OPERATIONAL',
  '> root@nexus:~$ _',
];

function TypingLine() {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const line = CONSOLE_LINES[lineIdx];
    if (charIdx < line.length) {
      const timer = setTimeout(() => setCharIdx(c => c + 1), 30 + Math.random() * 40);
      return () => clearTimeout(timer);
    }

    // Line complete — pause then next or fade out
    const pause = setTimeout(() => {
      if (lineIdx < CONSOLE_LINES.length - 1) {
        setLineIdx(i => i + 1);
        setCharIdx(0);
      } else {
        // Last line — blink cursor a few times then fade
        setTimeout(() => setShow(false), 2000);
      }
    }, lineIdx === CONSOLE_LINES.length - 1 ? 0 : 600);

    return () => clearTimeout(pause);
  }, [charIdx, lineIdx]);

  if (!show) return null;

  const line = CONSOLE_LINES[lineIdx];
  const isLastLine = lineIdx === CONSOLE_LINES.length - 1;
  const cursorVisible = charIdx >= line.length && isLastLine;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: 0.5 }}
      className="font-mono text-[10px] sm:text-xs h-4"
      style={{ color: 'color-mix(in srgb, var(--color-primary) 50%, transparent)' }}
    >
      {line.substring(0, charIdx)}
      {cursorVisible && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          style={{ color: 'var(--color-primary)' }}
        >
          _
        </motion.span>
      )}
    </motion.div>
  );
}

export default function Dashboard() {
  return (
    <div className="h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] relative rounded-xl md:rounded-2xl overflow-hidden">
      {/* 3D Model */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0"
      >
        <EarthScene modelPath={MODEL_PATH} />
      </motion.div>

      {/* Title */}
      <div className="absolute inset-0 flex flex-col items-center justify-start pt-4 md:pt-6 z-20 pointer-events-none">
        <motion.div
          initial={{ top: '-2px' }}
          animate={{ top: '100%' }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)', boxShadow: '0 0 20px var(--color-primary), 0 0 40px rgba(0,255,136,0.3)' }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <div className="relative">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0, 1, 0, 1] }}
              transition={{ duration: 0.8, delay: 0.5, times: [0, 0.1, 0.15, 0.2, 0.25, 1] }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold font-mono tracking-[0.2em] md:tracking-[0.3em] relative"
              style={{ color: 'var(--color-primary)', textShadow: '0 0 30px rgba(0,255,136,0.5), 0 0 60px rgba(0,255,136,0.3), 0 0 100px rgba(0,255,136,0.15)' }}
            >
              NEXUS CRM
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: [0, 0.7, 0] }} transition={{ duration: 0.3, delay: 0.6 }} className="absolute inset-0" style={{ color: '#ff0040', clipPath: 'inset(20% 0 60% 0)', transform: 'translate(-3px, 0)' }}>NEXUS CRM</motion.span>
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: [0, 0.7, 0] }} transition={{ duration: 0.3, delay: 0.65 }} className="absolute inset-0" style={{ color: '#00d4ff', clipPath: 'inset(50% 0 20% 0)', transform: 'translate(3px, 0)' }}>NEXUS CRM</motion.span>
            </motion.h1>
          </div>
          <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 0.8, delay: 0.8, ease: 'easeOut' }} className="h-[1px] mx-auto mt-2 mb-3 md:mt-3 md:mb-4" style={{ background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)', boxShadow: '0 0 10px var(--color-primary)', maxWidth: '300px' }} />
          <TypingLine />
        </motion.div>
      </div>

      <FloatingBadges />
    </div>
  );
}
