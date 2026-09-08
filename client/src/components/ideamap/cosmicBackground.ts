import * as THREE from 'three';

function createSpriteTexture(size = 128): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(200,220,255,0.6)');
  g.addColorStop(0.5, 'rgba(100,150,255,0.15)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

export function createCosmicBackground(scene: THREE.Scene) {
  const sp = createSpriteTexture(128);

  // Deep starfield
  const sc = 3000;
  const sg = new THREE.BufferGeometry();
  const sp3 = new Float32Array(sc * 3);
  const sc3 = new Float32Array(sc * 3);
  for (let i = 0; i < sc; i++) {
    const i3 = i * 3;
    const r = 800 + Math.random() * 2500;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    sp3[i3] = r * Math.sin(phi) * Math.cos(theta);
    sp3[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    sp3[i3 + 2] = r * Math.cos(phi);
    const v = 0.6 + Math.random() * 0.4;
    sc3[i3] = v * 0.85;
    sc3[i3 + 1] = v * 0.9;
    sc3[i3 + 2] = v;
  }
  sg.setAttribute('position', new THREE.BufferAttribute(sp3, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(sc3, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({
    size: 2, vertexColors: true, transparent: true, opacity: 0.7,
    sizeAttenuation: true, depthWrite: false,
  })));

  // Bright nearby stars
  const bc = 150;
  const bg = new THREE.BufferGeometry();
  const bp = new Float32Array(bc * 3);
  const bco = new Float32Array(bc * 3);
  const tints = [[1, 0.95, 0.8], [0.8, 0.9, 1], [1, 0.85, 0.7], [0.9, 0.8, 1], [0.7, 0.95, 1]];
  for (let i = 0; i < bc; i++) {
    const i3 = i * 3;
    const r = 300 + Math.random() * 1000;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    bp[i3] = r * Math.sin(phi) * Math.cos(theta);
    bp[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    bp[i3 + 2] = r * Math.cos(phi);
    const tn = tints[Math.floor(Math.random() * tints.length)];
    bco[i3] = tn[0];
    bco[i3 + 1] = tn[1];
    bco[i3 + 2] = tn[2];
  }
  bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  bg.setAttribute('color', new THREE.BufferAttribute(bco, 3));
  scene.add(new THREE.Points(bg, new THREE.PointsMaterial({
    size: 4, map: sp, vertexColors: true, transparent: true, opacity: 0.9,
    sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })));

  // Nebula clouds
  const nebulae = [
    { cx: -200, cy: 80, cz: -200, c: [0.06, 0.18, 0.4], r: 250, cnt: 500 },
    { cx: 250, cy: -60, cz: 150, c: [0.3, 0.04, 0.35], r: 200, cnt: 400 },
    { cx: 50, cy: 180, cz: -300, c: [0.02, 0.22, 0.3], r: 280, cnt: 450 },
    { cx: -150, cy: -140, cz: 180, c: [0.18, 0.02, 0.25], r: 180, cnt: 350 },
  ];
  for (const n of nebulae) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n.cnt * 3);
    const co = new Float32Array(n.cnt * 3);
    for (let i = 0; i < n.cnt; i++) {
      const i3 = i * 3;
      const r = n.r * Math.pow(Math.random(), 0.5);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      p[i3] = n.cx + r * Math.sin(phi) * Math.cos(theta);
      p[i3 + 1] = n.cy + r * Math.sin(phi) * Math.sin(theta) * 0.6;
      p[i3 + 2] = n.cz + r * Math.cos(phi);
      const d = r / n.r;
      const brightness = Math.max(0, 1 - d * d);
      const v = (Math.random() - 0.5) * 0.08;
      co[i3] = (n.c[0] + v) * brightness;
      co[i3 + 1] = (n.c[1] + v) * brightness;
      co[i3 + 2] = (n.c[2] + v) * brightness;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(co, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({
      size: 30, map: sp, vertexColors: true, transparent: true, opacity: 0.1,
      sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })));
  }

  // Nebula core lights
  for (const l of [
    { x: -200, y: 80, z: -200, c: 0x1a3a6a, i: 0.3 },
    { x: 250, y: -60, z: 150, c: 0x4a0a5a, i: 0.25 },
    { x: 50, y: 180, z: -300, c: 0x0a3a4a, i: 0.2 },
  ]) {
    const light = new THREE.PointLight(l.c, l.i, 400);
    light.position.set(l.x, l.y, l.z);
    scene.add(light);
  }

  // Dust filaments
  const dc = 200;
  const dg = new THREE.BufferGeometry();
  const dp = new Float32Array(dc * 3);
  const dco = new Float32Array(dc * 3);
  for (let i = 0; i < dc; i++) {
    const i3 = i * 3;
    dp[i3] = (Math.random() - 0.5) * 800;
    dp[i3 + 1] = (Math.random() - 0.5) * 400;
    dp[i3 + 2] = (Math.random() - 0.5) * 800;
    dco[i3] = 0.04 + Math.random() * 0.08;
    dco[i3 + 1] = 0.06 + Math.random() * 0.1;
    dco[i3 + 2] = 0.12 + Math.random() * 0.15;
  }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dg.setAttribute('color', new THREE.BufferAttribute(dco, 3));
  scene.add(new THREE.Points(dg, new THREE.PointsMaterial({
    size: 18, map: sp, vertexColors: true, transparent: true, opacity: 0.05,
    sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })));

  // Fog
  scene.fog = new THREE.FogExp2(0x020208, 0.00015);
}

export function setupLights(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0x404060, 1.0));
  const key = new THREE.DirectionalLight(0x8899cc, 0.7);
  key.position.set(80, 150, 80);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x554433, 0.4);
  fill.position.set(-80, 50, 80);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x334466, 0.3);
  rim.position.set(0, -50, -80);
  scene.add(rim);
  const center = new THREE.PointLight(0x00ff88, 0.15, 500);
  center.position.set(0, 0, 0);
  scene.add(center);
}
