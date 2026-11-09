import { useEffect, useRef } from 'react';
import type * as T from 'three';

/**
 * Live 3D hero scene (Titan model).
 *
 * three.js is imported DYNAMICALLY inside the effect so it never lands in the
 * dashboard's initial chunk. The rAF loop only runs while the canvas is on
 * screen, the tab is visible and the user has not opted into reduced motion.
 */
const MODEL_PATH = '/models/titan.glb';

const TEXTURE_PROPS = [
  'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap', 'normalMap',
  'displacementMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'envMap',
  'specularMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
  'transmissionMap', 'thicknessMap', 'sheenColorMap', 'sheenRoughnessMap',
] as const;

function disposeMaterial(mat: T.Material) {
  const record = mat as unknown as Record<string, unknown>;
  for (const key of TEXTURE_PROPS) {
    const tex = record[key] as { dispose?: () => void } | null | undefined;
    if (tex && typeof tex.dispose === 'function') tex.dispose();
  }
  mat.dispose();
}

export default function TitanScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        if (disposed) return;

        // ---- device profile (cheap on weak hardware) ----
        const isMobile = window.innerWidth < 768;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);
        const starCount = isMobile ? 500 : 1200;
        const frameInterval = isMobile ? 1000 / 30 : 1000 / 60;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        camera.position.set(0, 0, isMobile ? 4.2 : 3);

        const renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: true,
          stencil: false,
          powerPreference: 'high-performance',
        });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(pixelRatio);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.4;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        el.appendChild(renderer.domElement);

        // ---- lights (same look as before) ----
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
        const purpleLight = new THREE.PointLight(0x8800ff, 2, 10);
        purpleLight.position.set(0, 0.5, 0);
        scene.add(purpleLight);

        // ---- star field: single shared BufferGeometry, no per-point objects ----
        const starsGeometry = new THREE.BufferGeometry();
        const starPositions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
          const r = 15 + Math.random() * 85;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
          starPositions[i * 3 + 2] = r * Math.cos(phi);
        }
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const starsMaterial = new THREE.PointsMaterial({
          color: 0xffffff,
          size: 0.15,
          transparent: true,
          opacity: 0.8,
          sizeAttenuation: true,
        });
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(stars);

        // ---- model + animation ----
        let pivot: T.Group | null = null;
        let mixer: T.AnimationMixer | null = null;

        // Pre-allocated scratch vectors — nothing is allocated inside rAF.
        const box = new THREE.Box3();
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();

        new GLTFLoader().load(
          MODEL_PATH,
          (gltf) => {
            if (disposed) {
              gltf.scene.traverse((obj) => {
                const anyObj = obj as unknown as { geometry?: { dispose(): void }; material?: T.Material | T.Material[] };
                anyObj.geometry?.dispose();
                const mat = anyObj.material;
                if (Array.isArray(mat)) mat.forEach(disposeMaterial);
                else if (mat) disposeMaterial(mat);
              });
              return;
            }
            const model = gltf.scene;
            box.setFromObject(model);
            box.getCenter(center);
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const s = 2 / maxDim;

            pivot = new THREE.Group();
            model.scale.setScalar(s);
            model.position.set(-center.x * s, -center.y * s, -center.z * s);
            pivot.add(model);
            scene.add(pivot);

            model.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material) {
                const mat = child.material as T.MeshStandardMaterial;
                const name = child.name.toLowerCase();
                if (name.includes('generator') || name.includes('c1a4d')) {
                  mat.emissive = new THREE.Color(0x8800ff);
                  mat.emissiveIntensity = 0.8;
                } else if (name.includes('mine') || name.includes('combine')) {
                  mat.emissive = new THREE.Color(0x00ffcc);
                  mat.emissiveIntensity = 0.3;
                } else if (name.includes('tech_reference')) {
                  mat.emissive = new THREE.Color(0xaa00ff);
                  mat.emissiveIntensity = 0.5;
                }
              }
            });

            if (gltf.animations.length > 0) {
              mixer = new THREE.AnimationMixer(model);
              gltf.animations.forEach((clip) => mixer!.clipAction(clip).play());
            }
          },
          undefined,
          () => {
            /* model missing — scene keeps stars only, never throws */
          }
        );

        // ---- parallax ----
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;
        const onMouseMove = (e: MouseEvent) => {
          mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
          mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
        };
        if (!isMobile) window.addEventListener('mousemove', onMouseMove);

        // ---- resize ----
        const resize = () => {
          const w = el.clientWidth;
          const h = el.clientHeight;
          if (!w || !h) return;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          camera.position.z = w < 768 ? 4.2 : 3;
          renderer.setSize(w, h);
        };
        resize();
        window.addEventListener('resize', resize);

        // ---- gated rAF loop ----
        const clock = new THREE.Clock();
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        let reduced = motionQuery.matches;
        let inView = true;
        let running = false;
        let rafId = 0;
        let lastFrame = 0;

        const tick = (now: number) => {
          if (!running) return;
          rafId = requestAnimationFrame(tick);
          if (now - lastFrame < frameInterval) return;
          const dt = Math.min(clock.getDelta(), 0.1);
          lastFrame = now;

          if (mixer) mixer.update(dt);
          if (pivot) pivot.rotation.y += dt * 0.06;
          stars.rotation.y += dt * 0.003;
          stars.rotation.x += dt * 0.0012;

          const k = 1 - Math.exp(-dt * 1.2);
          targetX += (mouseX * 0.3 - targetX) * k;
          targetY += (mouseY * 0.2 - targetY) * k;
          camera.position.x = targetX;
          camera.position.y = -targetY;
          camera.lookAt(0, 0, 0);

          renderer.render(scene, camera);
        };

        const syncRunning = () => {
          const should = inView && !document.hidden && !reduced;
          if (should === running) return;
          if (should) {
            running = true;
            clock.getDelta(); // drop stale delta after a pause
            lastFrame = performance.now();
            rafId = requestAnimationFrame(tick);
          } else {
            running = false;
            cancelAnimationFrame(rafId);
          }
        };

        const io = typeof IntersectionObserver !== 'undefined'
          ? new IntersectionObserver(([entry]) => {
              inView = entry.isIntersecting;
              syncRunning();
            }, { threshold: 0 })
          : null;
        io?.observe(el);

        const onVisibility = () => syncRunning();
        document.addEventListener('visibilitychange', onVisibility);

        const onMotionChange = () => {
          reduced = motionQuery.matches;
          syncRunning();
        };
        motionQuery.addEventListener('change', onMotionChange);

        syncRunning();

        // ---- full dispose: everything the GPU/JS heap holds ----
        cleanup = () => {
          running = false;
          cancelAnimationFrame(rafId);
          io?.disconnect();
          window.removeEventListener('resize', resize);
          if (!isMobile) window.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('visibilitychange', onVisibility);
          motionQuery.removeEventListener('change', onMotionChange);

          if (mixer) {
            mixer.stopAllAction();
            mixer = null;
          }
          pivot = null;

          scene.traverse((obj) => {
            const anyObj = obj as unknown as {
              geometry?: { dispose(): void };
              material?: T.Material | T.Material[];
            };
            anyObj.geometry?.dispose();
            const mat = anyObj.material;
            if (Array.isArray(mat)) mat.forEach(disposeMaterial);
            else if (mat) disposeMaterial(mat);
          });

          renderer.renderLists.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
        };
      } catch (err) {
        console.warn('[TitanScene] WebGL init failed:', err);
      }
    })();

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
