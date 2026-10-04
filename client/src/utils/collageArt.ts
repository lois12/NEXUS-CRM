/** Decorative vector clipart (SVG path in 0..24 viewBox). Filled with zone.fillColor. */
export interface ArtItem {
  key: string;
  label: string;
  path: string;
}

export const CLIPART: ArtItem[] = [
  { key: 'ribbon', label: 'Лента', path: 'M3 8h12l-2 4 2 4H3l2-4zM15 8h4l-2 4 2 4h-4' },
  { key: 'banner', label: 'Баннер', path: 'M2 6h20v12H2z M2 6l3 6-3 6 M22 6l-3 6 3 6' },
  { key: 'seal', label: 'Печать', path: 'M12 2l2.5 2.2 3.2-.4.8 3.2 2.9 1.5-1.2 3 2.1 2.5-2.5 2 0 3.3-3.2.5-1.5 2.9L12 19l-2.6 1.8-1.5-2.9-3.2-.5 0-3.3-2.5-2 2.1-2.5-1.2-3 2.9-1.5.8-3.2 3.2.4z' },
  { key: 'burst', label: 'Взрыв', path: 'M12 2l1.5 5.5L18 5l-2 5 5.5.5-4.5 3 4 3.5-5.5-.5L17 22l-5-3.5L7 22l1.5-5.5L3 17l4-3.5L2.5 10 8 9.5 6 4.5l4.5 2.5z' },
  { key: 'corpus', label: 'Бант', path: 'M12 12c-2-4-8-6-9-3s3 7 9 3zm0 0c2-4 8-6 9-3s-3 7-9 3zm0 0v8' },
  { key: 'flower4', label: 'Цветок 4', path: 'M12 4c2 0 3 2 3 4s-1 3-3 3-3-1-3-3 1-4 3-4zm0 0c-2 0-3 2-3 4m3-4c2 0 3 2 3 4m-3-4v-3M8 8c0-2 2-3 4-3s3 1 3 3m-7 0H5m14 0h-3M12 20c2 0 3-2 3-4s-1-3-3-3-3 1-3 3 1 4 3 4z' },
  { key: 'heart2', label: 'Двойное сердце', path: 'M8 14s-4-2.5-4-5.5A2.5 2.5 0 0 1 8 7a2.5 2.5 0 0 1 4 1.5A2.5 2.5 0 0 1 16 7a2.5 2.5 0 0 1 4 1.5C20 11.5 16 14 16 14l-4 5z' },
  { key: 'leaf', label: 'Лист', path: 'M5 19C5 10 12 4 20 4c0 8-6 15-15 15z M5 19c3-4 7-8 11-10' },
  { key: 'waveBand', label: 'Волна', path: 'M2 12c3-6 6 6 10 0s7 6 10 0v4c-3 6-6-6-10 0s-7-6-10 0z' },
  { key: 'zigzag', label: 'Зигзаг', path: 'M2 16l4-8 4 8 4-8 4 8 4-8v6l-4 8-4-8-4 8-4-8-4 8z' },
  { key: 'dotRing', label: 'Точки-кольцо', path: 'M12 3a9 9 0 1 0 .01 0zm0 4a5 5 0 1 0 .01 0z' },
  { key: 'star6', label: 'Звезда 6', path: 'M12 2l2 6h6l-5 4 2 7-5-4-5 4 2-7-5-4h6z' },
  { key: 'star8', label: 'Звезда 8', path: 'M12 2l1.5 5.5L18 5l-2.5 5L20 12l-4.5 2 2 5-4.5-2.5L12 22l-1.5-5.5L6 19l2-5L4 12l4.5-2-2-5 5 2.5z' },
  { key: 'diamond2', label: 'Ромб-страза', path: 'M12 2l6 6-6 14L6 8z M6 8h12 M12 2v20' },
  { key: 'ticket', label: 'Тикет', path: 'M3 7h18v4a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z M9 7v10' },
  { key: 'badgeStar', label: 'Бейдж', path: 'M5 4h14v12l-7 4-7-4z M12 7l1.2 2.5 2.8.3-2 2 .5 2.8L12 13.2 9.5 14.6l.5-2.8-2-2 2.8-.3z' },
  { key: 'scissors', label: 'Ножницы-вырубка', path: 'M4 4c4 4 4 8 0 12 M20 4c-4 4-4 8 0 12 M8 14l8 6 M16 14L8 20 M8 4l8 6 M16 4L8 10' },
  { key: 'cornerTL', label: 'Уголок', path: 'M3 3h8v2H5v6H3z M21 21h-8v-2h6v-6h2z' },
  { key: 'frameOrn', label: 'Рамка-орнамент', path: 'M4 4h16v16H4z M6 6h12v12H6z M12 4v2 M12 18v2 M4 12h2 M18 12h2' },
  { key: 'arrowRibbon', label: 'Стрелка-лента', path: 'M2 8h14l4 4-4 4H2l3-4z' },
  { key: 'checkBadge', label: 'Галочка', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M7 12l3 3 7-7' },
  { key: 'boltCircle', label: 'Молния-круг', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M13 5l-6 8h4l-1 6 6-8h-4z' },
  { key: 'flame', label: 'Огонь', path: 'M12 2c3 4 1 6 3 8 3 3 3 8-3 12-6-3-8-8-4-12 2-2 2-5 4-8z' },
  { key: 'crown', label: 'Корона', path: 'M3 8l4 4 5-7 5 7 4-4v11H3z' },
  { key: 'medal', label: 'Медаль', path: 'M8 2h8l-2 8H10z M10 10h4a5 5 0 1 1-4 0z M12 13l.8 2h2.2l-1.5 1.5.6 2.2L12 17.5 9.9 18.7l.6-2.2L9 15h2.2z' },
  { key: 'mapPin', label: 'Пин', path: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z M12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
  { key: 'clock', label: 'Часы', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2' },
  { key: 'speech', label: 'Пузырь', path: 'M4 4h16v12H8l-4 4z' },
  { key: 'starBurstSm', label: 'Искра+', path: 'M12 2l1.5 7.5L21 12l-7.5 1.5L12 21l-1.5-7.5L3 12l7.5-1.5z' },
  { key: 'hexFrame', label: 'Гекс-рамка', path: 'M12 2l8 5v10l-8 5-8-5V7z M12 5.5l5.5 3.4v6.2L12 18.5 6.5 15.1V8.9z' },
  { key: 'plusCircle', label: 'Плюс-круг', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M11 7h2v4h4v2h-4v4h-2v-4H7v-2h4z' },
  { key: 'minusCircle', label: 'Минус-круг', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M7 11h10v2H7z' },
  { key: 'clover', label: 'Клевер', path: 'M12 12c0-4-5-6-6-3s3 6 6 3zm0 0c4 0 6-5 3-6s-6 3-3 6zm0 0c0 4 5 6 6 3s-3-6-6-3zm0 0c-4 0-6 5-3 6s6-3 3-6z' },
  { key: 'sparkle2', label: 'Блик', path: 'M8 4l1 4 4 1-4 1-1 4-1-4-4-1 4-1z M16 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1z' },
  { key: 'inkDrop', label: 'Клякса', path: 'M12 3c2 3 5 5 5 9a5 5 0 1 1-10 0c0-4 3-6 5-9z' },
  { key: 'tornBand', label: 'Рваная лента', path: 'M3 8h2l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2v8l-2-2-2 2-2-2-2 2-2-2-2 2-2-2-2 2z' },
];
