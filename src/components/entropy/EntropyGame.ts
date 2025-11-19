// src/components/entropy/EntropyGame.ts
import { CELL_SIZE, MAT_DATA } from './Constants';
import { Renderer } from './Renderer';

export class EntropyGame {
    private canvas: HTMLCanvasElement;
    private worker: Worker;
    private renderer: Renderer;
    private width: number = 0;
    private height: number = 0;

    private isDrawing: boolean = false;
    private currentMaterial: number = MAT_DATA;
    private brushSize: number = 3;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!this.canvas) throw new Error("Canvas not found");

        // Initialize Worker
        this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

        // Set dimensions
        this.updateDimensions();

        // Init Renderer
        this.renderer = new Renderer(this.canvas, this.width, this.height);

        // Worker Listeners
        this.worker.onmessage = (e) => {
            if (e.data.type === 'UPDATE') {
                this.renderer.draw(e.data.buffer);
            }
        };

        // Start Worker
        this.worker.postMessage({
            type: 'INIT',
            payload: { width: this.width, height: this.height }
        });

        this.bindEvents();
        window.addEventListener('resize', () => this.handleResize());
    }

    private updateDimensions() {
        // We divide screen size by CELL_SIZE for the simulation grid
        // Canvas visual size is 100% viewport, but internal resolution is lower for performance/pixel art look
        const rect = this.canvas.getBoundingClientRect();
        this.width = Math.floor(rect.width / CELL_SIZE);
        this.height = Math.floor(rect.height / CELL_SIZE);

        // Important: Set canvas logical resolution matches the simulation grid
        // CSS will scale it up to fill screen
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    private handleResize() {
        // Reloading page on resize is easiest for grid reconstruction, 
        // but for smoother UX we just re-init the worker
        this.updateDimensions();
        this.renderer.resize(this.width, this.height);
        this.worker.postMessage({
            type: 'INIT',
            payload: { width: this.width, height: this.height }
        });
    }

    private bindEvents() {
        // Mouse / Touch
        const start = (e: MouseEvent | TouchEvent) => {
            this.isDrawing = true;
            this.emitPaint(e);
        };
        const move = (e: MouseEvent | TouchEvent) => {
            if (this.isDrawing) this.emitPaint(e);
        };
        const end = () => {
            this.isDrawing = false;
        };

        this.canvas.addEventListener('mousedown', start);
        this.canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);

        this.canvas.addEventListener('touchstart', start, { passive: false });
        this.canvas.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', end);
    }

    private emitPaint(e: MouseEvent | TouchEvent) {
        e.preventDefault(); // Prevent scrolling on mobile

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as MouseEvent).clientX;
            clientY = (e as MouseEvent).clientY;
        }

        const rect = this.canvas.getBoundingClientRect();

        // Map screen coordinates to grid coordinates
        const x = Math.floor((clientX - rect.left) / CELL_SIZE);
        const y = Math.floor((clientY - rect.top) / CELL_SIZE);

        this.worker.postMessage({
            type: 'PAINT',
            payload: {
                x,
                y,
                brushSize: this.brushSize,
                material: this.currentMaterial
            }
        });
    }

    // Public API for UI
    public setMaterial(mat: number) {
        this.currentMaterial = mat;
    }

    public clear() {
        this.worker.postMessage({ type: 'RESET' });
    }
}