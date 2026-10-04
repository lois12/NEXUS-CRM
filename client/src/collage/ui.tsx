import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CollagePage, ImgItem } from './types';
import { resolveSize } from './types';
import { clipPathFor } from './geometry';
import { CHECKER_BG_SM } from './constants';

/** Mini page preview for the page navigator / sheet */
export function PageThumb({ page: p, images, height }: { page: CollagePage; images: ImgItem[]; height: number }) {
  const sz = resolveSize(p.format, p.orient, p.customW, p.customH);
  const w = Math.max(40, Math.round(height * sz.w / sz.h));
  return (
    <div
      style={{
        background: p.bgTransparent ? CHECKER_BG_SM : p.bgColor,
        backgroundSize: p.bgTransparent ? '8px 8px' : undefined,
        width: '100%',
        height,
        maxWidth: w,
        margin: '0 auto',
        borderRadius: Math.min(8, (p.outerRadius / 100) * 8),
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {p.zones.map(z => {
        const imgItem = z.imgId ? images.find(im => im.id === z.imgId) : null;
        return (
          <div key={z.id} style={{
            position: 'absolute',
            left: `${z.x * 100}%`, top: `${z.y * 100}%`,
            width: `${Math.min(z.w, 1) * 100}%`, height: `${Math.min(z.h, 1) * 100}%`,
            background: imgItem ? `url(${imgItem.preview}) center/cover no-repeat` : (z.type === 'text' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)'),
            borderRadius: z.type === 'circle' || z.type === 'ellipse' ? '50%' : 1,
            clipPath: z.type === 'text' ? undefined : clipPathFor(z, p.zones),
            opacity: imgItem ? (z.imgOpacity ?? 1) : 1,
          }} />
        );
      })}
    </div>
  );
}

/** Collapsible inspector section */
export function Acc({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2.5 flex items-center gap-2 font-mono text-[11px] text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
        <span className="tracking-wider uppercase">{title}</span>
      </button>
      {open && <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">{children}</div>}
    </div>
  );
}
