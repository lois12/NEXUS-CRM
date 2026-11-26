import { useEffect, useRef, useState } from 'react';
import { drawFrame, hitTestText, textHandlePos, computeLogoBox, FrameState, TextBBox } from './framePresets';

interface Props {
  state: FrameState;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onOffsetChange: (ox: number, oy: number) => void;
  onScaleChange: (scale: number) => void;
  /** перетаскивание текста по холсту (доли от размера) */
  onTextMove: (tx: number, ty: number) => void;
  /** наклон текста, градусы (ручка над текстом) */
  onAngleChange: (deg: number) => void;
  /** перетаскивание логотипа (доли холста, центр) */
  onLogoMove: (x: number, y: number) => void;
  /** режим сравнения «до/после» с ползунком */
  compareOn: boolean;
  /** замки: элемент нельзя сдвинуть / картинку — зумить */
  locks: { photo: boolean; text: boolean; logo: boolean };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type DragMode = 'image' | 'text' | 'rotate' | 'logo' | 'compare' | 'pan';

/** Превью-холст: rAF-анимация + drag картинки/текста/лого + ручка + зум + сравнение */
export default function FrameCanvas({ state, canvasRef, onOffsetChange, onScaleChange, onTextMove, onAngleChange, onLogoMove, compareOn, locks }: Props) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const locksRef = useRef(locks);
  locksRef.current = locks;
  const cbRef = useRef({ onOffsetChange, onScaleChange, onTextMove, onAngleChange, onLogoMove });
  cbRef.current = { onOffsetChange, onScaleChange, onTextMove, onAngleChange, onLogoMove };

  const overlayRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const bboxRef = useRef<TextBBox | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{ mode: DragMode; x: number; y: number; ox: number; oy: number; tx: number; ty: number; vx: number; vy: number; cpos: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const guidesRef = useRef({ gx: false, gy: false });
  const compareRef = useRef(0.5);
  const offA = useRef<HTMLCanvasElement | null>(null);
  const offB = useRef<HTMLCanvasElement | null>(null);

  // зум вида (Ctrl+колесо) + панорама (Shift/средняя кнопка)
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });

  // оба холста всегда в размере экспорта — превью = будущий файл пиксель в пиксель
  useEffect(() => {
    const c = canvasRef.current;
    const o = overlayRef.current;
    if (c) {
      c.width = state.preset.w;
      c.height = state.preset.h;
    }
    if (o) {
      o.width = state.preset.w;
      o.height = state.preset.h;
    }
    offA.current = null;
    offB.current = null;
  }, [state.preset, canvasRef]);

  const cleanState = (): FrameState => ({
    ...stateRef.current,
    windOn: false,
    snowOn: false,
    curtainsOn: false,
    auroraOn: false,
    leavesOn: false,
    rainOn: false,
    sparksOn: false,
    bokehOn: false,
    textAnim: 'none',
  });

  // цикл отрисовки: кадр (+сравнение) + оверлей ручек/направляющих
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      timeRef.current += dt;
      const c = canvasRef.current;
      const ctx = c ? c.getContext('2d') : null;
      const t = timeRef.current;

      if (c && ctx) {
        if (compareOn) {
          const w = c.width;
          const h = c.height;
          if (!offA.current || offA.current.width !== w) {
            const mk = () => {
              const el = document.createElement('canvas');
              el.width = w;
              el.height = h;
              return el;
            };
            offA.current = mk();
            offB.current = mk();
          }
          const a = offA.current!;
          const b = offB.current!;
          drawFrame(a.getContext('2d')!, w, h, cleanState(), t);
          const bb = drawFrame(b.getContext('2d')!, w, h, stateRef.current, t);
          bboxRef.current = bb;
          const px = compareRef.current * w;
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(a, 0, 0);
          ctx.save();
          ctx.beginPath();
          ctx.rect(px, 0, w - px, h);
          ctx.clip();
          ctx.drawImage(b, 0, 0);
          ctx.restore();
          // линия-разделитель
          const minDim = Math.min(w, h);
          ctx.save();
          ctx.fillStyle = 'rgba(10,14,24,0.65)';
          ctx.fillRect(px - minDim * 0.003, 0, minDim * 0.006, h);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(px, h / 2, minDim * 0.028, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0a0e18';
          ctx.font = `700 ${Math.round(minDim * 0.03)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('↔', px, h / 2);
          ctx.restore();
        } else {
          bboxRef.current = drawFrame(ctx, c.width, c.height, stateRef.current, t);
        }
      }

      const o = overlayRef.current;
      const octx = o ? o.getContext('2d') : null;
      if (o && octx) {
        octx.clearRect(0, 0, o.width, o.height);
        const bb = bboxRef.current;
        const st = stateRef.current;
        const bandMode = st.plateOn && st.plateStyle === 'band';

        // направляющие по центру при перетаскивании
        const drag = dragRef.current;
        if (drag && (drag.mode === 'text' || drag.mode === 'logo')) {
          octx.strokeStyle = 'rgba(0,255,136,0.55)';
          octx.lineWidth = Math.max(1, Math.min(o.width, o.height) * 0.0022);
          octx.setLineDash([o.width * 0.012, o.width * 0.009]);
          if (guidesRef.current.gx) {
            octx.beginPath();
            octx.moveTo(o.width / 2, 0);
            octx.lineTo(o.width / 2, o.height);
            octx.stroke();
          }
          if (guidesRef.current.gy) {
            octx.beginPath();
            octx.moveTo(0, o.height / 2);
            octx.lineTo(o.width, o.height / 2);
            octx.stroke();
          }
          octx.setLineDash([]);
        }

        // ручка вращения текста
        if (bb && st.text.trim() && !bandMode && !compareOn) {
          const minDim = Math.min(o.width, o.height);
          const hp = textHandlePos(bb, minDim);
          octx.strokeStyle = 'rgba(255,255,255,0.55)';
          octx.lineWidth = Math.max(1.5, minDim * 0.0028);
          octx.beginPath();
          octx.moveTo(hp.lineX, hp.lineY);
          octx.lineTo(hp.x, hp.y);
          octx.stroke();
          octx.beginPath();
          octx.arc(hp.x, hp.y, hp.r, 0, Math.PI * 2);
          octx.fillStyle = 'rgba(10,14,24,0.8)';
          octx.fill();
          octx.strokeStyle = 'rgba(255,255,255,0.85)';
          octx.lineWidth = Math.max(1.5, minDim * 0.0032);
          octx.stroke();
          octx.beginPath();
          octx.arc(hp.x, hp.y, hp.r * 0.42, Math.PI * 0.35, Math.PI * 1.9);
          octx.stroke();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, compareOn]);

  // Ctrl+колесо — зум вида; Alt+колесо — масштаб картинки; просто колесо — страница скроллится
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        setView((v) => {
          const z = clamp(v.z * k, 0.5, 4);
          return { z, x: v.x * (z / v.z), y: v.y * (z / v.z) };
        });
        return;
      }
      if (e.altKey) {
        e.preventDefault();
        if (locksRef.current.photo) return; // замок — не зумим картинку
        const st = stateRef.current;
        const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const rect = c.getBoundingClientRect();
        const cx = (e.clientX - rect.left) / rect.width - 0.5;
        const cy = (e.clientY - rect.top) / rect.height - 0.5;
        const next = clamp(st.scale * k, 0.25, 4);
        const ratio = next / st.scale;
        cbRef.current.onScaleChange(next);
        cbRef.current.onOffsetChange(cx - (cx - st.ox) * ratio, cy - (cy - st.oy) * ratio);
      }
      // без модификаторов — не перехватываем колесо: страница скроллится как обычно
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

  /** геометрия ручки вращения (null, если текста нет или текст в полосе) */
  const handleHit = (): { hx: number; hy: number; grab: number } | null => {
    const c = canvasRef.current;
    const bb = bboxRef.current;
    const st = stateRef.current;
    if (!c || !bb || !st.text.trim()) return null;
    if (st.plateOn && st.plateStyle === 'band') return null; // полоса фиксирована
    const hp = textHandlePos(bb, Math.min(c.width, c.height));
    return { hx: hp.x, hy: hp.y, grab: hp.r * 1.7 };
  };

  const bandMode = () => {
    const st = stateRef.current;
    return st.plateOn && st.plateStyle === 'band';
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2) {
      dragRef.current = null;
      if (!locksRef.current.photo) {
        const [a, b] = [...pointersRef.current.values()];
        pinchRef.current = {
          dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
          scale: stateRef.current.scale,
        };
      }
      return;
    }

    const { x, y } = toCanvasXY(e);
    const st = stateRef.current;
    const bb = bboxRef.current;

    // 0) ползунок сравнения / панорама вида
    if (compareOn && Math.abs(x - compareRef.current * c.width) <= Math.min(c.width, c.height) * 0.035) {
      dragRef.current = { mode: 'compare', x: e.clientX, y: e.clientY, ox: 0, oy: 0, tx: 0, ty: 0, vx: 0, vy: 0, cpos: compareRef.current };
      return;
    }
    if (e.button === 1 || e.shiftKey) {
      dragRef.current = { mode: 'pan', x: e.clientX, y: e.clientY, ox: 0, oy: 0, tx: 0, ty: 0, vx: view.x, vy: view.y, cpos: 0 };
      return;
    }

    // 1) логотип — тянется прямо в кадре (если не под замком)
    const lb = computeLogoBox(st, c.width, c.height);
    if (!locksRef.current.logo && lb && x >= lb.x && x <= lb.x + lb.w && y >= lb.y && y <= lb.y + lb.h) {
      dragRef.current = { mode: 'logo', x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy, tx: st.logoX, ty: st.logoY, vx: 0, vy: 0, cpos: 0 };
      return;
    }

    // 2) ручка вращения — приоритет над текстом (текст под замком — не трогаем)
    const hh = handleHit();
    if (!locksRef.current.text && hh && Math.hypot(x - hh.hx, y - hh.hy) <= hh.grab) {
      dragRef.current = { mode: 'rotate', x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy, tx: st.textX, ty: st.textY ?? 0.5, vx: 0, vy: 0, cpos: 0 };
      return;
    }

    // 3) текст: стартуем из фактического bbox — текстY=null (авто-низ) не прыгает в центр
    if (!locksRef.current.text && st.text.trim() && !bandMode() && hitTestText(bb, x, y) && bb) {
      dragRef.current = {
        mode: 'text',
        x: e.clientX, y: e.clientY,
        ox: st.ox, oy: st.oy,
        tx: bb.cx / c.width,
        ty: bb.cy / c.height,
        vx: 0, vy: 0, cpos: 0,
      };
    } else if (!locksRef.current.photo) {
      dragRef.current = { mode: 'image', x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy, tx: st.textX, ty: st.textY ?? 0.5, vx: 0, vy: 0, cpos: 0 };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointersRef.current.has(e.pointerId)) {
      // hover без нажатия: ручка / лого / текст / картинка
      const ch = canvasRef.current;
      if (ch && e.pointerType === 'mouse') {
        const rect = ch.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * ch.width;
        const y = ((e.clientY - rect.top) / rect.height) * ch.height;
        const hh = handleHit();
        const lb = computeLogoBox(stateRef.current, ch.width, ch.height);
        const lk = locksRef.current;
        if (compareOn && Math.abs(x - compareRef.current * ch.width) <= Math.min(ch.width, ch.height) * 0.035) {
          ch.style.cursor = 'ew-resize';
        } else if (!lk.text && hh && Math.hypot(x - hh.hx, y - hh.hy) <= hh.grab) {
          ch.style.cursor = 'grab';
        } else if (!lk.logo && lb && x >= lb.x && x <= lb.x + lb.w && y >= lb.y && y <= lb.y + lb.h) {
          ch.style.cursor = 'move';
        } else if (!lk.text && stateRef.current.text.trim() && !bandMode() && hitTestText(bboxRef.current, x, y)) {
          ch.style.cursor = 'move';
        } else {
          ch.style.cursor = stateRef.current.image && !lk.photo ? 'grab' : 'default';
        }
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

    if (drag.mode === 'compare') {
      const { x } = toCanvasXY(e);
      compareRef.current = clamp(x / c.width, 0.03, 0.97);
      return;
    }

    if (drag.mode === 'pan') {
      setView((v) => ({ ...v, x: drag.vx + (e.clientX - drag.x), y: drag.vy + (e.clientY - drag.y) }));
      return;
    }

    if (drag.mode === 'logo') {
      const rect = c.getBoundingClientRect();
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      let nx = clamp(drag.tx + dx / rect.width, -0.05, 1.05);
      let ny = clamp(drag.ty + dy / rect.height, -0.05, 1.05);
      // магнит к центру
      guidesRef.current.gx = Math.abs(nx - 0.5) < 0.015;
      guidesRef.current.gy = Math.abs(ny - 0.5) < 0.015;
      if (guidesRef.current.gx) nx = 0.5;
      if (guidesRef.current.gy) ny = 0.5;
      cbRef.current.onLogoMove(nx, ny);
      return;
    }

    if (drag.mode === 'rotate') {
      const bb = bboxRef.current;
      if (bb) {
        const { x, y } = toCanvasXY(e);
        let ang = (Math.atan2(y - bb.cy, x - bb.cx) * 180) / Math.PI + 90;
        while (ang > 180) ang -= 360;
        while (ang < -180) ang += 360;
        cbRef.current.onAngleChange(clamp(ang, -40, 40));
      }
      return;
    }

    const rect = c.getBoundingClientRect();
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (drag.mode === 'text') {
      let nx = clamp(drag.tx + dx / rect.width, -0.1, 1.1);
      let ny = clamp(drag.ty + dy / rect.height, -0.1, 1.1);
      guidesRef.current.gx = Math.abs(nx - 0.5) < 0.015;
      guidesRef.current.gy = Math.abs(ny - 0.5) < 0.015;
      if (guidesRef.current.gx) nx = 0.5;
      if (guidesRef.current.gy) ny = 0.5;
      cbRef.current.onTextMove(nx, ny);
    } else {
      cbRef.current.onOffsetChange(drag.ox + dx / rect.width, drag.oy + dy / rect.height);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
      guidesRef.current = { gx: false, gy: false };
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
          transformOrigin: 'center center',
          transition: dragRef.current?.mode === 'pan' ? 'none' : 'transform 0.12s ease-out',
        }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-auto rounded-xl select-none"
          style={{ touchAction: 'none', cursor: state.image ? 'grab' : 'default', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <canvas
          ref={overlayRef}
          aria-hidden
          className="absolute inset-0 w-full h-full rounded-xl pointer-events-none"
        />
      </div>

      {/* зум-контролы */}
      <div className="absolute right-2 bottom-2 flex items-center gap-1 pointer-events-auto">
        <button
          type="button"
          onClick={() => setView((v) => ({ ...v, z: clamp(v.z * 1 / 1.25, 0.5, 4) }))}
          className="w-7 h-7 rounded-lg font-mono text-xs nx-press flex items-center justify-center"
          style={{ background: 'rgba(10,14,24,0.72)', color: '#cfd8e3' }}
          aria-label="Уменьшить"
        >−</button>
        <button
          type="button"
          onClick={() => setView({ z: 1, x: 0, y: 0 })}
          className="px-2 h-7 rounded-lg font-mono text-[10px] nx-press"
          style={{ background: 'rgba(10,14,24,0.72)', color: '#cfd8e3' }}
          title="Сбросить зум вида"
        >{Math.round(view.z * 100)}%</button>
        <button
          type="button"
          onClick={() => setView((v) => ({ ...v, z: clamp(v.z * 1.25, 0.5, 4) }))}
          className="w-7 h-7 rounded-lg font-mono text-xs nx-press flex items-center justify-center"
          style={{ background: 'rgba(10,14,24,0.72)', color: '#cfd8e3' }}
          aria-label="Увеличить"
        >+</button>
      </div>
    </div>
  );
}
