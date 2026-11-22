declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array | Uint8ClampedArray,
      width: number,
      height: number,
      opts?: { palette?: number[][]; delay?: number; first?: boolean; transparent?: boolean },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  };
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    format?: 'rgb565' | 'rgba4444' | 'rgb444',
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: 'rgb565' | 'rgba4444' | 'rgb444',
  ): Uint8Array;
}
