import { useEffect, useRef } from 'react';
import { drawFrame, hitTestText, FrameState, TextBBox } from './framePresets';

interface Props {
  state: FrameState;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onOffsetChange: (ox: number, oy: number) => void;
  onScaleChange: (scale: number) => void;
  /** перетаскивание текста по холсту (доли от размера) */
  onTextMove: (tx: number, ty: number) => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Превью-холст: rAF-анимация + drag картинки/текста + колесо-зум + пинч */
export default function FrameCanvas({ state, canvasRef, onOffsetChange, onScaleChange, onTextMove }: Props) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const cbRef = useRef({ onOffsetChange, onScaleChange, onTextMove });
  cbRef.current = { onOffsetChange, onScaleChange, onTextMove };

  const timeRef = useRef(0);
  const bboxRef = useRef<TextBBox | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{ mode: 'image' | 'text'; x: number; y: number; ox: number; oy: number; tx: number; ty: number } | null>(null);
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
      if (c && ctx) bboxRef.current = drawFrame(ctx, c.width, c.height, stateRef.current, timeRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef]);

  // зум колесом вокруг курсора
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

  const toCanvasXY = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
      rect,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2) {
      dragRef.current = null;
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        scale: stateRef.current.scale,
      };
      return;
    }

    const { x, y } = toCanvasXY(e);
    const st = stateRef.current;
    const bb = bboxRef.current;
    if (st.text.trim() && hitTestText(bb, x, y) && bb) {
      // стартуем из фактической позиции bbox — текстY=null (авто-низ) не прыгает в центр
      dragRef.current = {
        mode: 'text',
        x: e.clientX, y: e.clientY,
        ox: st.ox, oy: st.oy,
        tx: bb.cx / c.width,
        ty: bb.cy / c.height,
      };
    } else {
      dragRef.current = { mode: 'image', x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy, tx: st.textX, ty: st.textY ?? 0.5 };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointersRef.current.has(e.pointerId)) {
      // hover без нажатия: показываем, что текст можно схватить
      const ch = canvasRef.current;
      if (ch && e.pointerType === 'mouse') {
        const rect = ch.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * ch.width;
        const y = ((e.clientY - rect.top) / rect.height) * ch.height;
        const overText = !!stateRef.current.text.trim() && hitTestText(bboxRef.current, x, y);
        ch.style.cursor = overText ? 'move' : stateRef.current.image ? 'grab' : 'default';
      }
      return;
    }
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

    const drag = dragRef.current;
    if (!drag) return;
    const rect = c.getBoundingClientRect();
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (drag.mode === 'text') {
      cbRef.current.onTextMove(
        clamp(drag.tx + dx / rect.width, -0.1, 1.1),
        clamp(drag.ty + dy / rect.height, -0.1, 1.1),
      );
    } else {
      cbRef.current.onOffsetChange(drag.ox + dx / rect.width, drag.oy + dy / rect.height);
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
