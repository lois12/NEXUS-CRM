import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { Idea, IdeaLink, IDEA_TYPE_CONFIG } from '../../types';
import { NODE_BUILDERS, animateNodes } from './nodeBuilders';
import { createCosmicBackground, setupLights } from './cosmicBackground';
import { loadBattlecruiserTexture, createBattlecruiserNode, isBattlecruiserLoaded } from './battlecruiserSprite';


interface GraphNode { id: string; name: string; color: string; val: number; idea: Idea; x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number; }
interface GraphLink { source: string; target: string; linkData: IdeaLink; }
interface IdeaGraphProps {
  ideas: Idea[]; links: IdeaLink[]; selectedId: string | null;
  onSelect: (id: string | null) => void; onDrillDown: (id: string) => void;
  onEdit: (id: string) => void; onDelete: (id: string) => void;
  linkMode: boolean; linkSource: string | null;
  onLinkSource: (id: string | null) => void; onLinkTarget: (id: string) => void;
  filterTypes: string[]; selectedLinkId: string | null;
  onSelectLink: (id: string | null) => void;
  onGetCameraPos: (cb: () => { x: number; y: number; z: number }) => void;
  onGetCameraRotation: (cb: () => { x: number; y: number; z: number }) => void;
  onGetCameraDistance: (cb: () => number) => void;
  onBackgroundClickAt: (pos: { x: number; y: number; z: number }) => void;
}

const NODE_POS_KEY = 'nexus-ideamap-nodes';

function savePositions(nodes: GraphNode[]) {
  try {
    const p: Record<string, { x: number; y: number; z: number }> = {};
    nodes.forEach(n => { if (n.x !== undefined) p[n.id] = { x: n.x, y: n.y!, z: n.z! }; });
    localStorage.setItem(NODE_POS_KEY, JSON.stringify(p));
  } catch (e) { /* ignore */ }
}

function loadPositions(): Record<string, { x: number; y: number; z: number }> {
  try { const s = localStorage.getItem(NODE_POS_KEY); if (s) return JSON.parse(s); } catch (e) { /* ignore */ }
  return {};
}

export default function IdeaGraph({
  ideas, links, selectedId, onSelect, onDrillDown,
  onEdit, onDelete,
  linkMode, linkSource, onLinkSource, onLinkTarget,
  filterTypes, selectedLinkId, onSelectLink,
  onGetCameraPos, onGetCameraRotation, onGetCameraDistance,
  onBackgroundClickAt,
}: IdeaGraphProps) {
  const fgRef = useRef<any>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [bcReady, setBcReady] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: GraphNode } | null>(null);

  const isDraggingRef = useRef(false);
  const graphDataRef = useRef<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [, forceRender] = useState(0);

  // Cursor CSS
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = `.graph-dragging canvas{cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cpath d='M16 2c-1.5 0-2.5 2-3 4-1 4-2 6-4 8s-4 3-5 5c-1 2 0 4 1 5 1.5 1.5 3 2 5 1.5 2-.5 3-2 4-4 .5-1 1-2 2-2s1.5 1 2 2c1 2 2 3.5 4 4 2 .5 3.5 0 5-1.5 1-1 2-3 1-5-1-2-3-3-5-5s-3-4-4-8c-.5-2-1.5-4-3-4z' fill='%2300ff88'/%3E%3C/svg%3E") 16 16,grab!important}`;
    document.head.appendChild(s);
    return () => { document.head.removeChild(s); };
  }, []);

  // Preload battlecruiser sprite texture
  useEffect(() => {
    loadBattlecruiserTexture()
      .then(() => {
        console.log('[IdeaGraph] Battlecruiser sprite ready!');
        setBcReady(true);
      })
      .catch((err) => console.error('[IdeaGraph] Battlecruiser sprite failed:', err));
  }, []);

  // Camera getters
  useEffect(() => { onGetCameraPos(() => { try { if (fgRef.current) { const c = fgRef.current.camera(); return { x: c.position.x, y: c.position.y, z: c.position.z }; } } catch (e) { /* ignore */ } return { x: 0, y: 0, z: 200 }; }); }, [onGetCameraPos]);
  useEffect(() => { onGetCameraRotation(() => { try { if (fgRef.current) { const c = fgRef.current.camera(); return { x: c.rotation.x, y: c.rotation.y, z: c.rotation.z }; } } catch (e) { /* ignore */ } return { x: 0, y: 0, z: 0 }; }); }, [onGetCameraRotation]);
  useEffect(() => { onGetCameraDistance(() => { try { if (fgRef.current) { const c = fgRef.current.camera(); return Math.sqrt(c.position.x ** 2 + c.position.y ** 2 + c.position.z ** 2); } } catch (e) { /* ignore */ } return 350; }); }, [onGetCameraDistance]);

  // Filters
  const filteredIdeas = useMemo(() => filterTypes.length === 0 ? ideas : ideas.filter(i => filterTypes.includes(i.type)), [ideas, filterTypes]);
  const filteredLinks = useMemo(() => { const ids = new Set(filteredIdeas.map(i => i.id)); return links.filter(l => ids.has(l.sourceId) && ids.has(l.targetId)); }, [links, filteredIdeas]);

  // Rebuild graph data — new object so library detects changes, but preserve positions
  useEffect(() => {
    const prevNodes = graphDataRef.current.nodes;
    const existingMap = new Map<string, GraphNode>();
    prevNodes.forEach(n => existingMap.set(n.id, n));
    const saved = loadPositions();

    const nodes: GraphNode[] = filteredIdeas.map(idea => {
      const existing = existingMap.get(idea.id);
      if (existing) {
        // Preserve position from existing node
        existing.name = idea.title;
        existing.color = idea.color;
        existing.val = idea.type === 'direction' ? 6 : 2;
        existing.idea = idea;
        return existing;
      }
      // New node — use saved position or camera position
      const s = saved[idea.id];
      let px: number, py: number, pz: number;
      if (s) { px = s.x; py = s.y; pz = s.z; }
      else {
        let cx = 0, cy = 0, cz = 350;
        try { if (fgRef.current) { const c = fgRef.current.camera(); cx = c.position.x; cy = c.position.y; cz = c.position.z; } } catch (e) { /* ignore */ }
        px = cx + (Math.random() - 0.5) * 200;
        py = cy + (Math.random() - 0.5) * 150;
        pz = cz - 150 - Math.random() * 100;
      }
      const n: GraphNode = { id: idea.id, name: idea.title, color: idea.color, val: idea.type === 'direction' ? 6 : 2, idea, x: px, y: py, z: pz };
      n.fx = px; n.fy = py; n.fz = pz;
      return n;
    });

    const links: GraphLink[] = filteredLinks.map(l => ({
      source: l.sourceId,
      target: l.targetId,
      linkData: l,
    }));

    // Assign new object so library detects the change
    graphDataRef.current = { nodes, links };
    forceRender(v => v + 1);
  }, [filteredIdeas, filteredLinks, bcReady]);

  // Init scene + auto zoom to fit on first load
  useEffect(() => {
    if (!fgRef.current) return;
    const t = setTimeout(() => {
      try {
        const scene = fgRef.current.scene();
        if (scene) { createCosmicBackground(scene); setupLights(scene); }
        // Auto zoom to fit if there are nodes
        if (graphDataRef.current.nodes.length > 0) {
          fgRef.current.zoomToFit(400, 50);
        }
      } catch (e) { /* ignore */ }
    }, 800);
    return () => clearTimeout(t);
  }, []);

  // Kill forces + configure camera
  useEffect(() => {
    if (!fgRef.current) return;
    const t = setTimeout(() => {
      try {
        const d3 = fgRef.current.d3Force;
        if (d3) { d3.force('link')?.strength(0); d3.force('charge')?.strength(0); d3.force('center')?.strength(0); d3.alpha(0).stop(); }
        const ctrl = fgRef.current.controls();
        if (ctrl) {
          ctrl.minDistance = 5; ctrl.maxDistance = 2000;
          ctrl.enableDamping = true; ctrl.dampingFactor = 0.05;
          ctrl.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
          ctrl.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
        }
      } catch (e) { /* ignore */ }
    }, 500);
    return () => clearTimeout(t);
  }, []);

  // Re-fix positions
  useEffect(() => {
    if (!fgRef.current) return;
    const t = setTimeout(() => {
      try {
        const d3 = fgRef.current.d3Force;
        if (d3) { d3.force('link')?.strength(0); d3.force('charge')?.strength(0); d3.force('center')?.strength(0); d3.alpha(0).stop(); }
        graphDataRef.current.nodes.forEach((n: any) => { if (n.x !== undefined && n.fx === undefined) { n.fx = n.x; n.fy = n.y; n.fz = n.z; } });
      } catch (e) { /* ignore */ }
    }, 100);
    return () => clearTimeout(t);
  });

  // Animate nodes
  useEffect(() => {
    let animId: number;
    const animate = () => {
      try {
        if (fgRef.current) {
          const scene = fgRef.current.scene();
          if (scene) animateNodes(scene);
        }
      } catch (e) { /* ignore */ }
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Camera to selected — smooth cinematic fly
  useEffect(() => {
    if (selectedId && fgRef.current) {
      const n = graphDataRef.current.nodes.find(n => n.id === selectedId);
      if (n && n.x !== undefined && n.y !== undefined && n.z !== undefined) {
        // Offset camera slightly above and to the right for a cinematic angle
        const dist = 100;
        const angle = Math.atan2(n.y, n.x) + 0.3;
        fgRef.current.cameraPosition(
          { x: n.x + Math.cos(angle) * dist, y: n.y + 60, z: n.z + Math.sin(angle) * dist },
          { x: n.x, y: n.y, z: n.z },
          2000
        );
      }
    }
  }, [selectedId]);

  const handleNodeClick = useCallback((node: any) => {
    console.log('[IdeaGraph] node click:', node?.id, 'linkMode:', linkMode, 'linkSource:', linkSource);
    if (linkMode) {
      if (!linkSource) { onLinkSource(node.id); }
      else if (linkSource !== node.id) { onLinkTarget(node.id); onLinkSource(null); }
      return;
    }
    onSelect(node.id); onSelectLink(null);
  }, [linkMode, linkSource, onSelect, onLinkSource, onLinkTarget, onSelectLink]);

  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const handleNodeClickWithDouble = useCallback((node: any) => {
    console.log('[IdeaGraph] click with double:', node?.id);
    const now = Date.now(), last = lastClickRef.current;
    if (last && last.id === node.id && now - last.time < 400) { onDrillDown(node.id); lastClickRef.current = null; return; }
    lastClickRef.current = { id: node.id, time: now }; handleNodeClick(node);
  }, [handleNodeClick, onDrillDown]);

  const handleLinkClick = useCallback((link: any) => {
    const d = link.linkData as IdeaLink;
    if (d) { onSelectLink(d.id); onSelect(null); }
  }, [onSelectLink, onSelect]);

  const handleBackgroundClick = useCallback(() => {
    onSelect(null);
    onSelectLink(null);
    // Get camera position and place new node in front
    try {
      if (fgRef.current) {
        const cam = fgRef.current.camera();
        // Place node 150 units in front of camera with some random offset
        const dir = { x: 0, y: 0, z: -1 };
        // Apply camera rotation to direction
        cam.getWorldDirection(dir);
        const pos = {
          x: cam.position.x + dir.x * 150 + (Math.random() - 0.5) * 50,
          y: cam.position.y + dir.y * 150 + (Math.random() - 0.5) * 50,
          z: cam.position.z + dir.z * 150,
        };
        onBackgroundClickAt(pos);
      }
    } catch (e) { /* ignore */ }
  }, [onSelect, onSelectLink, onBackgroundClickAt]);
  const handleNodeHover = useCallback((node: any) => {
    setHoveredNodeId(node?.id || null);
    try { const r = fgRef.current?.renderer(); if (r) r.domElement.style.cursor = node ? 'pointer' : 'default'; } catch (e) { /* ignore */ }
  }, []);

  // Right-click context menu
  const handleNodeRightClick = useCallback((node: any, event: MouseEvent) => {
    console.log('[IdeaGraph] right-click:', node?.id, event);
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, node });
    onSelect(node.id);
  }, [onSelect]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  const getLinkColor = useCallback((link: any) => {
    const d = link.linkData as IdeaLink;
    if (selectedLinkId === d?.id) return 'rgba(0, 255, 200, 0.9)';
    const s = typeof link.source === 'object' ? link.source : graphDataRef.current.nodes.find(n => n.id === link.source);
    const t = typeof link.target === 'object' ? link.target : graphDataRef.current.nodes.find(n => n.id === link.target);
    if (s?.idea?.type === 'direction' || t?.idea?.type === 'direction') return 'rgba(255, 34, 0, 0.6)';
    return 'rgba(120, 180, 255, 0.35)';
  }, [selectedLinkId]);

  const getLinkWidth = useCallback((link: any) => {
    const d = link.linkData as IdeaLink;
    return selectedLinkId === d?.id ? 3 : 1.2;
  }, [selectedLinkId]);

  const nodeLabel = useCallback((node: any) => {
    const idea = node.idea as Idea;
    const tl = IDEA_TYPE_CONFIG[idea.type]?.label || '';
    return `<div style="background:rgba(5,5,15,0.92);padding:10px 14px;border-radius:12px;border:1px solid ${idea.color}40;font-family:'JetBrains Mono',monospace;font-size:12px;color:#e0e0e0;box-shadow:0 0 30px ${idea.color}15,0 8px 24px rgba(0,0,0,0.6);min-width:130px">
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;color:${idea.color}">${idea.title}</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:10px;opacity:0.5">
        <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${idea.color};box-shadow:0 0 6px ${idea.color}80"></span>${tl}
      </div></div>`;
  }, []);

  return (
    <>
    {contextMenu && (
      <div className="fixed inset-0 z-[200]" onClick={() => setContextMenu(null)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute rounded-2xl overflow-hidden py-1.5"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 220),
            top: Math.min(contextMenu.y, window.innerHeight - 300),
            background: 'linear-gradient(135deg, rgba(20,20,35,0.95) 0%, rgba(15,15,25,0.98) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
            minWidth: 200,
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="font-mono text-xs font-bold truncate" style={{ color: contextMenu.node.color }}>
              {contextMenu.node.name}
            </div>
            <div className="font-mono text-[9px] mt-0.5" style={{ color: '#5a5a70' }}>
              {IDEA_TYPE_CONFIG[contextMenu.node.idea.type]?.label || 'Без типа'}
            </div>
          </div>

          {/* Actions */}
          <button onClick={() => { onSelect(contextMenu.node.id); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-mono hover:bg-white/5 transition-colors"
            style={{ color: '#c0c0d0' }}>
            <span className="w-4 text-center" style={{ color: '#00d4ff' }}>👁</span> Выбрать
          </button>
          <button onClick={() => { onEdit(contextMenu.node.id); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-mono hover:bg-white/5 transition-colors"
            style={{ color: '#c0c0d0' }}>
            <span className="w-4 text-center" style={{ color: '#eab308' }}>✏</span> Редактировать
          </button>
          <button onClick={() => { onDrillDown(contextMenu.node.id); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-mono hover:bg-white/5 transition-colors"
            style={{ color: '#c0c0d0' }}>
            <span className="w-4 text-center" style={{ color: '#bf00ff' }}>🔍</span> Вложенные идеи
          </button>
          <div className="mx-3 my-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <button onClick={() => { onDelete(contextMenu.node.id); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-mono hover:bg-red-500/10 transition-colors"
            style={{ color: '#ff6b6b' }}>
            <span className="w-4 text-center">🗑</span> Удалить
          </button>
        </motion.div>
      </div>
    )}
    <ForceGraph3D
      ref={fgRef}
      graphData={graphDataRef.current}
      nodeId="id" nodeLabel={nodeLabel} nodeColor="color" nodeVal="val"
      nodeResolution={16}
      nodeThreeObject={(node: any) => {
        const idea = node.idea as Idea;
        const isSel = selectedId === node.id;
        const isHov = hoveredNodeId === node.id;
        const sel = isSel ? 1.25 : isHov ? 1.1 : 1.0;

        let g: THREE.Group;

        // Battlecruiser for "direction" type — sprite from GLB model
        if (idea.type === 'direction' && bcReady && isBattlecruiserLoaded()) {
          g = createBattlecruiserNode(sel);
          g.userData = { nodeType: 'direction', isBattlecruiser: true };
        } else if (idea.type === 'direction') {
          // Fallback while loading
          g = NODE_BUILDERS.direction(sel);
          g.userData = { nodeType: 'direction' };
        } else {
          const builder = NODE_BUILDERS[idea.type] || NODE_BUILDERS.default;
          g = builder(sel);
          g.userData = { nodeType: idea.type };
        }
        if (isSel) {
          const r1 = new THREE.Mesh(
            new THREE.TorusGeometry(14, 0.3, 8, 48),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(idea.color), transparent: true, opacity: 0.35 })
          );
          r1.rotation.x = Math.PI / 2; g.add(r1);
          const r2 = new THREE.Mesh(
            new THREE.TorusGeometry(14, 0.2, 8, 48),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 })
          );
          r2.rotation.x = Math.PI / 3; r2.rotation.y = Math.PI / 4; g.add(r2);
        }
        return g;
      }}
      nodeThreeObjectExtend={false}
      linkColor={getLinkColor}
      linkWidth={getLinkWidth}
      linkOpacity={0.4}
      linkCurvature={0.1}
      linkDirectionalParticles={2}
      linkDirectionalParticleWidth={3}
      linkDirectionalParticleColor={() => 'rgba(120, 180, 255, 0.6)'}
      linkDirectionalParticleSpeed={0.005}
      onLinkClick={handleLinkClick}
      onNodeHover={handleNodeHover}
      onNodeDrag={(node: any) => {
        if (!isDraggingRef.current) {
          isDraggingRef.current = true;
          const c = fgRef.current?.renderer()?.domElement?.parentElement;
          if (c) c.classList.add('graph-dragging');
        }
        node.fx = node.x; node.fy = node.y; node.fz = node.z;
        const m = graphDataRef.current.nodes.find(n => n.id === node.id);
        if (m) { m.x = node.x; m.y = node.y; m.z = node.z; m.fx = node.x; m.fy = node.y; m.fz = node.z; }
      }}
      onNodeDragEnd={(node: any) => {
        isDraggingRef.current = false;
        const c = fgRef.current?.renderer()?.domElement?.parentElement;
        if (c) c.classList.remove('graph-dragging');
        node.fx = node.x; node.fy = node.y; node.fz = node.z;
        const m = graphDataRef.current.nodes.find(n => n.id === node.id);
        if (m) { m.x = node.x; m.y = node.y; m.z = node.z; m.fx = node.x; m.fy = node.y; m.fz = node.z; }
        savePositions(graphDataRef.current.nodes);
      }}
      backgroundColor="rgba(0,0,0,0)"
      controlType="trackball"
      enableNavigationControls
      onNodeClick={handleNodeClickWithDouble}
      onNodeRightClick={handleNodeRightClick}
      onBackgroundClick={handleBackgroundClick}
      warmupTicks={0}
      cooldownTime={0}
      d3VelocityDecay={1}
    />
    </>
  );
}
