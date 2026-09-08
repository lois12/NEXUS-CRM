import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_CACHE = new Map<string, THREE.Group>();

export function preloadModel(url: string): Promise<THREE.Group> {
  if (MODEL_CACHE.has(url)) return Promise.resolve(MODEL_CACHE.get(url)!);

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;

        // Get original size
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        console.log('[ModelLoader] Original size:', size.x.toFixed(1), size.y.toFixed(1), size.z.toFixed(1), 'maxDim:', maxDim.toFixed(1));

        // Scale to match other nodes (~7 units radius = ~14 units diameter)
        if (maxDim > 0) {
          model.scale.setScalar(7 / maxDim);
        }

        // Recalculate bounding box AFTER scale, then center at origin
        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        model.position.sub(scaledCenter);

        // Count meshes
        let meshCount = 0;
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) meshCount++;
        });
        console.log('[ModelLoader] Loaded:', meshCount, 'meshes, scale:', (7 / maxDim).toFixed(4), 'maxDim:', maxDim.toFixed(1));

        MODEL_CACHE.set(url, model);
        resolve(model);
      },
      (progress) => {
        if (progress.total > 0) {
          console.log('[ModelLoader] Progress:', Math.round(progress.loaded / progress.total * 100) + '%');
        }
      },
      (err) => {
        console.error('[ModelLoader] FAILED:', url, err);
        reject(err);
      }
    );
  });
}

export function getClonedModel(url: string): THREE.Group | null {
  const cached = MODEL_CACHE.get(url);
  if (!cached) return null;

  // Manual clone — create new group with cloned meshes
  const group = new THREE.Group();
  group.scale.copy(cached.scale);
  group.position.set(0, 0, 0);

  cached.traverse((child: any) => {
    if (child.isMesh) {
      const clonedMesh = child.clone();
      clonedMesh.geometry = child.geometry.clone();
      clonedMesh.material = child.material.clone();
      // Force visible
      clonedMesh.visible = true;
      if (clonedMesh.material) {
        clonedMesh.material.transparent = false;
        clonedMesh.material.opacity = 1;
        clonedMesh.material.depthWrite = true;
        clonedMesh.material.side = THREE.DoubleSide;
        clonedMesh.material.needsUpdate = true;
      }
      // Copy local transform
      clonedMesh.position.copy(child.position);
      clonedMesh.rotation.copy(child.rotation);
      clonedMesh.scale.copy(child.scale);
      group.add(clonedMesh);
    }
  });

  return group;
}
