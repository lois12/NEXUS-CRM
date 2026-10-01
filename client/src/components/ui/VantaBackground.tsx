import { useEffect, useRef, useState } from 'react';

interface VantaBackgroundProps {
  effect?: 'net' | 'birds' | 'fog' | 'waves' | 'halo' | 'globe';
  color?: string;
  backgroundColor?: string;
  className?: string;
}

const EFFECT_MAP: Record<string, () => Promise<any>> = {
  net: () => import('vanta/dist/vanta.net.min'),
  birds: () => import('vanta/dist/vanta.birds.min'),
  fog: () => import('vanta/dist/vanta.fog.min'),
  waves: () => import('vanta/dist/vanta.waves.min'),
  halo: () => import('vanta/dist/vanta.halo.min'),
  globe: () => import('vanta/dist/vanta.globe.min'),
};

export default function VantaBackground({ effect = 'net', color = '#00ff88', backgroundColor = '#0a0a0f', className = '' }: VantaBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null);
  const vantaRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  // Forward mouse position to Vanta on document-level move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!vantaRef.current) return;
      // Try different Vanta internal methods for mouse tracking
      if (typeof vantaRef.current.onMouseMove2 === 'function') {
        vantaRef.current.onMouseMove2(e);
      } else if (typeof vantaRef.current.onMouseMove === 'function') {
        vantaRef.current.onMouseMove(e);
      } else if (vantaRef.current.options) {
        // Directly update mouse coordinates in Vanta's internal state
        vantaRef.current.options.mouseX = e.clientX;
        vantaRef.current.options.mouseY = e.clientY;
      }
    };
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;

    const init = async () => {
      try {
        const THREE = await import('three');
        const effectModule = await EFFECT_MAP[effect]();
        const Effect = effectModule.default || effectModule;

        if (cancelled || !ref.current) return;

        vantaRef.current = Effect({
          el: ref.current,
          THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          mouseEase: 0.2,
          minHeight: 200.0,
          minWidth: 200.0,
          scale: 1.0,
          scaleMobile: 1.0,
          color,
          backgroundColor,
          // NET-specific
          points: 12,
          maxDistance: 22.0,
          spacing: 18.0,
          showDots: true,
          // BIRDS-specific
          birdSize: 1.5,
          wingSpan: 30.0,
          speedLimit: 5.0,
          separation: 50.0,
          alignment: 1.0,
          cohesion: 1.0,
          quantity: 3.0,
          // FOG-specific
          blurFactor: 0.6,
          zoom: 1.0,
          // WAVES-specific
          shininess: 30.0,
          waveHeight: 15.0,
          waveSpeed: 0.7,
          // HALO-specific
          baseColor: color,
          size: 1.5,
        });

        // If Vanta exposes onMouseMove2, rebind it to document
        if (vantaRef.current && ref.current) {
          // Remove Vanta's own mouse listener on the element (it won't fire anyway)
          // The document-level listener above will forward events
        }

        setLoaded(true);
      } catch (err) {
        console.warn('Vanta.js init failed, falling back:', err);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (vantaRef.current) {
        try { vantaRef.current.destroy(); } catch {}
        vantaRef.current = null;
      }
    };
  }, [effect, color, backgroundColor]);

  return (
    <div
      ref={ref}
      className={`fixed inset-0 z-0 ${className}`}
      style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.5s ease' }}
    />
  );
}