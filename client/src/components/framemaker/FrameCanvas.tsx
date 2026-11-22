import { useEffect, useRef } from 'react';
import { drawFrame, FrameState } from './framePresets';

interface Props {
  state: FrameState;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onOffsetChange: (ox: number, oy: number) => void;
  onScaleChange: (scale: number) => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Превью-холст: rAF-анимация + drag-панорама + колесо-зум + пинч */
export default function FrameCanvas({ state, canvasRef, onOffsetChange, onScaleChange }: Props) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const cbRef = useRef({ onOffsetChange, onScaleChange });
  cbRef.current = { onOffsetChange, onScaleChange };

  const timeRef = useRef(0);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  // холст всегда в размере экспорта — превью = будущий файл пиксель в пиксель
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = state.preset.w;
    c.height = state.preset.h;
  }, [state.preset, canvasRef]);

  // цикл отрисовки
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      timeRef.current += dt;
      const c = canvasRef.current;
      const ctx = c ? c.getContext('2d') : null;
      if (c && ctx) drawFrame(ctx, c.width, c.height, stateRef.current, timeRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef]);

  // зум колесом вокруг курсора (нативный слушатель — нужен preventDefault)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = stateRef.current;
      const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const next = clamp(st.scale * k, 0.25, 4);
      const ratio = next / st.scale;
      const rect = c.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width - 0.5;
      const cy = (e.clientY - rect.top) / rect.height - 0.5;
      cbRef.current.onScaleChange(next);
      cbRef.current.onOffsetChange(cx - (cx - st.ox) * ratio, cy - (cy - st.oy) * ratio);
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [canvasRef]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = { x: e.clientX, y: e.clientY, ox: stateRef.current.ox, oy: stateRef.current.oy };
    } else if (pointersRef.current.size >= 2) {
      dragRef.current = null;
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        scale: stateRef.current.scale,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const c = canvasRef.current;
    if (!c) return;

    if (pinchRef.current && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      cbRef.current.onScaleChange(clamp(pinchRef.current.scale * (d / pinchRef.current.dist), 0.25, 4));
      pinchRef.current.dist = d;
      return;
    }
    if (dragRef.current) {
      const rect = c.getBoundingClientRect();
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      cbRef.current.onOffsetChange(
        dragRef.current.ox + dx / rect.width,
        dragRef.current.oy + dy / rect.height,
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-auto rounded-xl select-none"
      style={{ touchAction: 'none', cursor: state.image ? 'grab' : 'default', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
