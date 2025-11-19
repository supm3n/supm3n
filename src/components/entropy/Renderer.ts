// src/components/entropy/Renderer.ts
import { COLORS, MAT_EMPTY } from './Constants';

export class Renderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private width: number;
    private height: number;
    private imageData: ImageData;
    private buf32: Uint32Array;

    constructor(canvas: HTMLCanvasElement, width: number, height: number) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: true })!; // Alpha true for transparency
        this.width = width;
        this.height = height;

        // Initialize buffer
        this.imageData = this.ctx.createImageData(width, height);
        this.buf32 = new Uint32Array(this.imageData.data.buffer);
    }

    public draw(gridBuffer: ArrayBuffer) {
        const grid = new Int32Array(gridBuffer);
        const len = grid.length;

        // Direct pixel manipulation
        for (let i = 0; i < len; i++) {
            const cellType = grid[i];
            if (cellType !== MAT_EMPTY) {
                // Use predefined colors
                this.buf32[i] = COLORS[cellType as keyof typeof COLORS] || 0xFFFFFFFF;
            } else {
                this.buf32[i] = 0x00000000; // Transparent
            }
        }

        this.ctx.putImageData(this.imageData, 0, 0);
    }

    public resize(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
        this.imageData = this.ctx.createImageData(width, height);
        this.buf32 = new Uint32Array(this.imageData.data.buffer);
    }
}