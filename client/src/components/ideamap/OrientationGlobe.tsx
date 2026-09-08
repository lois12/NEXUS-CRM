import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface OrientationGlobeProps {
  getCameraRotation: () => { x: number; y: number; z: number };
  getCameraDistance: () => number;
}

export default function OrientationGlobe({ getCameraRotation, getCameraDistance }: OrientationGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeRef = useRef<THREE.Group | null>(null);
  const distRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const size = 120;
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Globe group
    const globe = new THREE.Group();
    globeRef.current = globe;

    // Wireframe sphere
    const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
    const wireframe = new THREE.WireframeGeometry(sphereGeo);
    const sphereLine = new THREE.LineSegments(
      wireframe,
      new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.3 })
    );
    globe.add(sphereLine);

    // Equator ring
    const equator = new THREE.Mesh(
      new THREE.TorusGeometry(1.02, 0.008, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.5 })
    );
    globe.add(equator);

    // Meridian ring
    const meridian = new THREE.Mesh(
      new THREE.TorusGeometry(1.02, 0.008, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.3 })
    );
    meridian.rotation.y = Math.PI / 2;
    globe.add(meridian);

    // Axis line (polar)
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.3, 0),
      new THREE.Vector3(0, 1.3, 0),
    ]);
    const axis = new THREE.Line(
      axisGeo,
      new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.2 })
    );
    globe.add(axis);

    // Forward direction indicator (bright dot)
    const forwardDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    );
    forwardDot.position.set(0, 0, 1.05);
    globe.add(forwardDot);

    // Up direction indicator
    const upDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff6b9d })
    );
    upDot.position.set(0, 1.05, 0);
    globe.add(upDot);

    // Center glow
    const centerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.15 })
    );
    globe.add(centerGlow);

    scene.add(globe);

    // Ambient light
    scene.add(new THREE.AmbientLight(0x404060, 0.5));

    // Animation loop
    let animId: number;
    const animate = () => {
      try {
        const rotation = getCameraRotation();
        if (globe) {
          globe.rotation.x = rotation.x;
          globe.rotation.y = rotation.y;
          globe.rotation.z = rotation.z;
        }

        // Update zoom distance
        const dist = getCameraDistance();
        if (distRef.current) {
          const zoomPercent = Math.round(Math.max(0, Math.min(100, ((500 - dist) / 450) * 100)));
          distRef.current.textContent = `${zoomPercent}%`;
          distRef.current.style.color = zoomPercent > 70 ? '#00ff88' : zoomPercent > 30 ? '#00d4ff' : '#6b7280';
        }

        renderer.render(scene, camera);
      } catch (e) { /* ignore */ }
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [getCameraRotation, getCameraDistance]);

  return (
    <div className="fixed bottom-4 right-4 z-20 flex flex-col items-center gap-2 pointer-events-none">
      {/* Zoom indicator */}
      <div className="glass-frost rounded-xl px-3 py-2 flex flex-col items-center gap-1" style={{ border: '1px solid var(--color-border)' }}>
        <div className="text-[10px] font-mono" style={{ color: 'var(--color-primary)' }}>// МАСШТАБ</div>
        <div ref={distRef} className="text-lg font-mono font-bold" style={{ color: 'var(--color-primary)' }}>
          50%
        </div>
        {/* Zoom bar */}
        <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              backgroundColor: 'var(--color-primary)',
              width: '50%',
              boxShadow: '0 0 6px var(--color-glow)',
            }}
          />
        </div>
        <div className="flex justify-between w-full text-[8px] font-mono text-gray-600">
          <span>+</span>
          <span>−</span>
        </div>
      </div>

      {/* Orientation globe */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={120}
          height={120}
          className="rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,255,136,0.03) 0%, transparent 70%)',
            border: '1px solid var(--color-border)',
          }}
        />
        {/* Cardinal labels */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-mono" style={{ color: 'var(--color-primary)', opacity: 0.6 }}>В</div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-mono" style={{ color: 'var(--color-primary)', opacity: 0.4 }}>Н</div>
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-mono" style={{ color: '#00d4ff', opacity: 0.4 }}>Л</div>
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-mono" style={{ color: '#00d4ff', opacity: 0.4 }}>П</div>
      </div>
    </div>
  );
}
