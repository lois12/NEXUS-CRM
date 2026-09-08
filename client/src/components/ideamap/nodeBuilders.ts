import * as THREE from 'three';

// ====== NODE BUILDER — volume + gloss like CSS radial-gradient ======
function buildSphere(
  mainColor: string,
  glowColor: string,
  sel: number,
  opts: {
    core?: boolean; coreColor?: string; coreSize?: number;
    mainSize?: number; glowSize?: number; emissive?: number;
    highlight?: boolean; highlightColor?: string; highlightPos?: [number, number, number]; highlightSize?: number;
    rim?: boolean; rimColor?: string; rimSize?: number;
    wireframe?: boolean; flatShading?: boolean; extraGlow?: boolean;
  } = {}
): THREE.Group {
  const g = new THREE.Group();
  const mS = (opts.mainSize || 7) * sel;
  const eI = opts.emissive ?? 0.5;

  if (opts.core !== false) {
    g.add(new THREE.Mesh(
      new THREE.SphereGeometry((opts.coreSize || 2.5) * sel, 24, 24),
      new THREE.MeshBasicMaterial({ color: opts.coreColor || '#ffffff', transparent: true, opacity: 0.7 })
    ));
  }

  g.add(new THREE.Mesh(
    new THREE.SphereGeometry(mS, 32, 32),
    new THREE.MeshPhongMaterial({
      color: mainColor, emissive: mainColor, emissiveIntensity: eI,
      transparent: true, opacity: 0.9, shininess: 150,
      specular: new THREE.Color(0x666666), flatShading: opts.flatShading || false,
    })
  ));

  if (opts.highlight !== false) {
    const hSize = (opts.highlightSize || 1.8) * sel;
    const hPos = opts.highlightPos || [-mS * 0.35, mS * 0.35, mS * 0.4];
    const h = new THREE.Mesh(
      new THREE.SphereGeometry(hSize, 12, 12),
      new THREE.MeshBasicMaterial({ color: opts.highlightColor || '#ffffff', transparent: true, opacity: 0.5 })
    );
    h.position.set(hPos[0], hPos[1], hPos[2]);
    g.add(h);
  }

  if (opts.rim !== false) {
    g.add(new THREE.Mesh(
      new THREE.SphereGeometry((opts.rimSize || mS * 1.15), 32, 32),
      new THREE.MeshBasicMaterial({ color: opts.rimColor || glowColor, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false })
    ));
  }

  g.add(new THREE.Mesh(
    new THREE.SphereGeometry((opts.glowSize || mS * 1.8), 16, 16),
    new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.04, side: THREE.BackSide, depthWrite: false })
  ));

  if (opts.wireframe) {
    g.add(new THREE.Mesh(
      new THREE.SphereGeometry(mS * 0.7, 16, 16),
      new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.12, wireframe: true })
    ));
  }

  return g;
}

// Red Giant — big red glowing sphere (direction, 3x size)
function buildQuasar(sel: number) {
  return buildSphere('#ff2200', '#cc0000', sel * 3, {
    coreSize: 4, mainSize: 9, glowSize: 16, emissive: 0.9,
    highlight: true, highlightColor: '#ffaa88', highlightSize: 3, highlightPos: [-4, 5, 5],
    rim: true, rimSize: 11, rimColor: '#ff4400', extraGlow: true,
  });
}

// Magnetar — pink/magenta (task)
function buildMagnetar(sel: number) {
  return buildSphere('#ff00ff', '#ff00ff', sel, {
    coreSize: 3, mainSize: 7, glowSize: 12, emissive: 0.6,
    highlight: true, highlightColor: '#ffaaff', highlightSize: 1.5, highlightPos: [-2.5, 2.5, 3],
  });
}

// Supernova — orange/yellow (idea)
function buildSupernova(sel: number) {
  return buildSphere('#ff6600', '#ff6600', sel, {
    coreSize: 3.5, mainSize: 7, glowSize: 14, emissive: 0.7,
    highlight: true, highlightColor: '#ffcc44', highlightSize: 2, highlightPos: [-2.5, 3, 3.5],
  });
}

// Iris Purple — dark purple (problem)
function buildIrisPurple(sel: number) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.SphereGeometry(2.5 * sel, 24, 24),
    new THREE.MeshBasicMaterial({ color: '#110022', transparent: true, opacity: 0.9 })
  ));
  g.add(new THREE.Mesh(
    new THREE.SphereGeometry(7 * sel, 32, 32),
    new THREE.MeshPhongMaterial({ color: '#8b00ff', emissive: '#8b00ff', emissiveIntensity: 0.5, transparent: true, opacity: 0.85, shininess: 120, specular: new THREE.Color(0x444444) })
  ));
  const h = new THREE.Mesh(new THREE.SphereGeometry(1.5 * sel, 12, 12), new THREE.MeshBasicMaterial({ color: '#dda0ff', transparent: true, opacity: 0.5 }));
  h.position.set(-2 * sel, 2.5 * sel, 3 * sel); g.add(h);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(12 * sel, 16, 16), new THREE.MeshBasicMaterial({ color: '#8b00ff', transparent: true, opacity: 0.05, side: THREE.BackSide, depthWrite: false })));
  return g;
}

// Photon Sphere — cyan (goal)
function buildPhotonSphere(sel: number) {
  return buildSphere('#00d4ff', '#00d4ff', sel, {
    coreSize: 3.5, mainSize: 7.5, glowSize: 14, emissive: 0.6,
    highlight: true, highlightColor: '#ffffff', highlightSize: 2, highlightPos: [-2.5, 3, 3.5],
  });
}

// Amoeba — organic green (note)
function buildAmoeba(sel: number) {
  const g = new THREE.Group();
  const blob = new THREE.Mesh(
    new THREE.SphereGeometry(7 * sel, 32, 32),
    new THREE.MeshPhongMaterial({ color: '#44ff88', emissive: '#44ff88', emissiveIntensity: 0.3, transparent: true, opacity: 0.85, shininess: 80, specular: new THREE.Color(0x444444) })
  );
  const pos = blob.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = Math.sin(x * 3) * Math.cos(y * 2) * Math.sin(z * 4) * 0.1;
    pos.setXYZ(i, x * (1 + n), y * (1 + n), z * (1 + n));
  }
  pos.needsUpdate = true; blob.geometry.computeVertexNormals();
  g.add(blob);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(2 * sel, 16, 16), new THREE.MeshBasicMaterial({ color: '#44ff88', transparent: true, opacity: 0.5 })));
  const h = new THREE.Mesh(new THREE.SphereGeometry(1.5 * sel, 12, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4 }));
  h.position.set(-2 * sel, 2.5 * sel, 3 * sel); g.add(h);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(10 * sel, 16, 16), new THREE.MeshBasicMaterial({ color: '#44ff88', transparent: true, opacity: 0.04, side: THREE.BackSide, depthWrite: false })));
  return g;
}

// Ice Crystal — faceted blue (default)
function buildIceCrystal(sel: number) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(2 * sel, 24, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 })));
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(7 * sel, 1), new THREE.MeshPhongMaterial({ color: '#88ddff', emissive: '#88ddff', emissiveIntensity: 0.2, transparent: true, opacity: 0.75, shininess: 200, specular: new THREE.Color(0xffffff), flatShading: true })));
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(4 * sel, 0), new THREE.MeshBasicMaterial({ color: '#88ddff', transparent: true, opacity: 0.15, wireframe: true })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(11 * sel, 16, 16), new THREE.MeshBasicMaterial({ color: '#88ddff', transparent: true, opacity: 0.03, side: THREE.BackSide, depthWrite: false })));
  return g;
}

export const NODE_BUILDERS: Record<string, (sel: number) => THREE.Group> = {
  direction: buildQuasar,
  task: buildMagnetar,
  idea: buildSupernova,
  problem: buildIrisPurple,
  goal: buildPhotonSphere,
  note: buildAmoeba,
  default: buildIceCrystal,
};

// Animate nodes based on type
export function animateNodes(scene: THREE.Scene) {
  const t = Date.now() * 0.001;
  scene.traverse((obj: any) => {
    if (obj.isGroup && obj.userData?.nodeType) {
      switch (obj.userData.nodeType) {
        case 'direction':
          if (!obj.userData.isBattlecruiser) {
            obj.rotation.y += 0.003;
          }
          break;
        case 'task': obj.scale.setScalar(1 + Math.sin(t * 2) * 0.04); break;
        case 'idea': obj.scale.setScalar(1 + Math.sin(t * 1.5) * 0.06); break;
        case 'problem': obj.rotation.y += 0.005; break;
        case 'goal': obj.rotation.y += 0.004; obj.scale.setScalar(1 + Math.sin(t * 2.5) * 0.03); break;
        case 'note': obj.rotation.y += 0.002; obj.rotation.x = Math.sin(t * 0.8) * 0.05; break;
        case 'default': obj.rotation.y += 0.006; break;
      }
    }
  });
}
