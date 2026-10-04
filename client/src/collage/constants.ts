// Fonts, layout presets, checkerboard
import type { Zone } from './types';
import { uid } from './types';

export const FONTS = [
  'Montserrat', 'Play', 'Ubuntu', 'Fira Sans', 'Rubik', 'Roboto', 'Open Sans',
  'Noto Sans', 'PT Sans', 'PT Serif', 'Golos Text', 'Onest', 'Unbounded',
  'Manrope', 'Commissioner', 'Jost', 'Ruda', 'Underdog', 'Ruslan Display',
  'Cormorant Garamond',
];

export const FONT_STYLES: Record<string, string> = {
  'Montserrat': 'Montserrat:wght@400;700',
  'Play': 'Play:wght@400;700',
  'Ubuntu': 'Ubuntu:wght@400;700',
  'Fira Sans': 'Fira+Sans:wght@400;700',
  'Rubik': 'Rubik:wght@400;700',
  'Roboto': 'Roboto:wght@400;700',
  'Open Sans': 'Open+Sans:wght@400;700',
  'Noto Sans': 'Noto+Sans:wght@400;700',
  'PT Sans': 'PT+Sans:wght@400;700',
  'PT Serif': 'PT+Serif:wght@400;700',
  'Golos Text': 'Golos+Text:wght@400;700',
  'Onest': 'Onest:wght@400;700',
  'Unbounded': 'Unbounded:wght@400;700',
  'Manrope': 'Manrope:wght@400;700',
  'Commissioner': 'Commissioner:wght@400;700',
  'Jost': 'Jost:wght@400;700',
  'Ruda': 'Ruda:wght@400;700',
  'Underdog': 'Underdog',
  'Ruslan Display': 'Ruslan+Display',
  'Cormorant Garamond': 'Cormorant+Garamond:wght@400;700',
};

// inject Google Fonts (Cyrillic subsets included by default via css2)
if (typeof document !== 'undefined' && !document.getElementById('collage-fonts')) {
  const link = document.createElement('link');
  link.id = 'collage-fonts';
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${
    Object.values(FONT_STYLES).map(s => `family=${s}`).join('&')
  }&display=swap`;
  document.head.appendChild(link);
}

export const PRESETS: { id: string; label: string; build: () => Zone[] }[] = [
  {
    id: 'grid2', label: '2×2',
    build: () => {
      const mk = (x: number, y: number): Zone => ({ id: uid(), type: 'rect', x, y, w: 0.49, h: 0.49, radius: 0, imgRadius: 0, fit: 'cover', imgId: null });
      return [mk(0.005, 0.005), mk(0.505, 0.005), mk(0.005, 0.505), mk(0.505, 0.505)];
    },
  },
  {
    id: 'grid3', label: '3×3',
    build: () => {
      const out: Zone[] = [];
      const s = 0.326;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        out.push({ id: uid(), type: 'rect', x: 0.005 + c * 0.331, y: 0.005 + r * 0.331, w: s, h: s, radius: 0, imgRadius: 0, fit: 'cover', imgId: null });
      }
      return out;
    },
  },
  {
    id: 'hero', label: '1+2',
    build: () => [
      { id: uid(), type: 'rect', x: 0.005, y: 0.005, w: 0.6, h: 0.99, radius: 0, imgRadius: 0, fit: 'cover', imgId: null },
      { id: uid(), type: 'rect', x: 0.615, y: 0.005, w: 0.38, h: 0.49, radius: 0, imgRadius: 0, fit: 'cover', imgId: null },
      { id: uid(), type: 'rect', x: 0.615, y: 0.505, w: 0.38, h: 0.49, radius: 0, imgRadius: 0, fit: 'cover', imgId: null },
    ],
  },
  {
    id: 'circles', label: '4 круга',
    build: () => {
      const mk = (x: number, y: number): Zone => ({ id: uid(), type: 'circle', x, y, w: 0.48, h: 0.48, radius: 0, imgRadius: 0, fit: 'cover', imgId: null });
      return [mk(0.01, 0.01), mk(0.51, 0.01), mk(0.01, 0.51), mk(0.51, 0.51)];
    },
  },
];


export const CHECKER_BG =
  'repeating-conic-gradient(#c8c8c8 0% 25%, #ffffff 0% 50%) 0 0 / 16px 16px';
export const CHECKER_BG_SM =
  'repeating-conic-gradient(#c8c8c8 0% 25%, #ffffff 0% 50%) 0 0 / 8px 8px';

