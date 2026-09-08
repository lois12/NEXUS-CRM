import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SPRITE_SIZE = 1024;
let spriteTexture: THREE.Texture | null = null;
let loadPromise: Promise<THREE.Texture> | null = null;

function renderModelToCanvas(model: THREE.Group): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;

  // Offscreen renderer — high quality
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(SPRITE_SIZE, SPRITE_SIZE);
  renderer.setPixelRatio(2); // 2x supersampling for crisp edges
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.8;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Scene
  const scene = new THREE.Scene();

  // Lights — dramatic cyberpunk lighting
  scene.add(new THREE.AmbientLight(0x202040, 0.4));
  const mainLight = new THREE.DirectionalLight(0xffffff, 3);
  mainLight.position.set(5, 8, 4);
  scene.add(mainLight);
  const rimLight = new THREE.DirectionalLight(0x00d4ff, 1.2);
  rimLight.position.set(-4, 3, -5);
  scene.add(rimLight);
  const bottomLight = new THREE.DirectionalLight(0xff4400, 0.6);
  bottomLight.position.set(0, -5, 0);
  scene.add(bottomLight);

  // Add model
  const modelClone = model.clone();
  scene.add(modelClone);

  // Camera — slightly above, angled for dramatic view
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(5, 4, 7);
  camera.lookAt(0, -0.5, 0);

  renderer.render(scene, camera);

  // Cleanup
  renderer.dispose();
  modelClone.traverse((child: any) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m: any) => m.dispose());
      } else {
        child.material?.dispose();
      }
    }
  });

  return canvas;
}

export function loadBattlecruiserTexture(): Promise<THREE.Texture> {
  if (spriteTexture) return Promise.resolve(spriteTexture);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      '/models/battlecruiser.glb',
      (gltf) => {
        const model = gltf.scene;

        // Normalize scale
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) model.scale.setScalar(3 / maxDim);

        // Center
        const scaledBox = new THREE.Box3().setFromObject(model);
        const center = scaledBox.getCenter(new THREE.Vector3());
        model.position.sub(center);

        // Render to canvas
        const canvas = renderModelToCanvas(model);

        // Create texture with high quality settings
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 4;
        spriteTexture = texture;
        console.log('[BattlecruiserSprite] Texture created from model');
        resolve(texture);
      },
      undefined,
      (err) => {
        console.error('[BattlecruiserSprite] Failed to load model:', err);
        reject(err);
      }
    );
  });
  return loadPromise;
}

export function createBattlecruiserNode(sel: number): THREE.Group {
  const group = new THREE.Group();

  if (spriteTexture) {
    // Sprite with model texture
    const spriteMat = new THREE.SpriteMaterial({
      map: spriteTexture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(28 * sel, 28 * sel, 1);
    group.add(sprite);
  } else {
    // Fallback: red sphere
    const fallback = new THREE.Mesh(
      new THREE.SphereGeometry(7 * sel, 32, 32),
      new THREE.MeshPhongMaterial({ color: '#ff2200', emissive: '#ff2200', emissiveIntensity: 0.5 })
    );
    group.add(fallback);
  }

  return group;
}

export function isBattlecruiserLoaded(): boolean {
  return !!spriteTexture;
}
