/// <reference types="react-scripts" />

declare module 'html-to-image' {
  export function toPng(
    node: HTMLElement,
    options?: {
      backgroundColor?: string;
      style?: Partial<CSSStyleDeclaration>;
      quality?: number;
      pixelRatio?: number;
    }
  ): Promise<string>;
  export function toJpeg(node: HTMLElement, options?: any): Promise<string>;
  export function toSvg(node: HTMLElement, options?: any): Promise<string>;
}

declare module 'jspdf' {
  export class jsPDF {
    constructor(options?: {
      orientation?: 'portrait' | 'landscape';
      unit?: 'mm' | 'pt' | 'px' | 'in' | 'cm';
      format?: string | [number, number];
    });
    addImage(
      imageData: string,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number
    ): void;
    save(filename: string): void;
  }
}
