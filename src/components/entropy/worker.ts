// src/components/entropy/worker.ts
import { MAT_EMPTY, MAT_DATA, MAT_CACHE, MAT_VIRUS, MAT_PROCESS } from './Constants';

let width = 0;
let height = 0;
let grid: Int32Array;
let nextGrid: Int32Array;

// We use a shared buffer logic or transferables. 
// For simplicity in this setup, we'll use transferables.
// 0 = Empty, 1 = Data, 2 = Cache, 3 = Virus, 4 = Process

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'INIT') {
        width = payload.width;
        height = payload.height;
        grid = new Int32Array(width * height).fill(MAT_EMPTY);
        nextGrid = new Int32Array(width * height).fill(MAT_EMPTY);
        loop();
    } else if (type === 'PAINT') {
        // User interaction
        const { x, y, brushSize, material } = payload;
        paint(x, y, brushSize, material);
    } else if (type === 'RESET') {
        grid.fill(MAT_EMPTY);
    }
};

function paint(cx: number, cy: number, radius: number, material: number) {
    const r2 = radius * radius;
    for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
            if (x * x + y * y <= r2) {
                const px = cx + x;
                const py = cy + y;
                if (px >= 0 && px < width && py >= 0 && py < height) {
                    const idx = py * width + px;
                    // Overwrite rules
                    if (material === MAT_EMPTY || grid[idx] !== MAT_CACHE) {
                        grid[idx] = material;
                    }
                }
            }
        }
    }
}

function getIndex(x: number, y: number) {
    return y * width + x;
}

function update() {
    // Copy current state to next state effectively
    // Or verify in-place. Falling sand is easier with bottom-up iteration in-place usually, 
    // but let's be precise. We will iterate bottom-up.

    // Randomize X direction traversal to prevent "leaning" towers
    const randomDir = Math.random() > 0.5 ? 1 : -1;

    for (let y = height - 1; y >= 0; y--) {
        // Alternate L/R scan per row for symmetry
        const startX = randomDir === 1 ? 0 : width - 1;
        const endX = randomDir === 1 ? width : -1;
        const step = randomDir === 1 ? 1 : -1;

        for (let x = startX; x !== endX; x += step) {
            const idx = getIndex(x, y);
            const cell = grid[idx];

            if (cell === MAT_EMPTY) continue;
            if (cell === MAT_CACHE) continue; // Walls don't move

            if (cell === MAT_DATA) {
                updateData(idx, x, y);
            } else if (cell === MAT_VIRUS) {
                updateVirus(idx, x, y);
            } else if (cell === MAT_PROCESS) {
                updateProcess(idx, x, y);
            }
        }
    }
}

function updateData(i: number, x: number, y: number) {
    if (y >= height - 1) return; // Bottom

    const below = getIndex(x, y + 1);

    // 1. Try fall straight down
    if (grid[below] === MAT_EMPTY) {
        move(i, below);
    }
    // 2. Try fall diagonally
    else {
        const dir = Math.random() > 0.5 ? 1 : -1;
        const bl = getIndex(x - dir, y + 1);
        const br = getIndex(x + dir, y + 1);

        // Check bounds and availability
        const canLeft = x - dir >= 0 && x - dir < width && grid[bl] === MAT_EMPTY;
        const canRight = x + dir >= 0 && x + dir < width && grid[br] === MAT_EMPTY;

        if (canLeft) {
            move(i, bl);
        } else if (canRight) {
            move(i, br);
        }
        // Else: Stay put
    }
}

function updateVirus(i: number, x: number, y: number) {
    // Virus behaves like gas/liquid but eats things
    // Random movement
    const dirX = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
    const dirY = Math.floor(Math.random() * 3) - 1;

    if (dirX === 0 && dirY === 0) return;

    const tx = x + dirX;
    const ty = y + dirY;

    if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
        const target = getIndex(tx, ty);
        const targetCell = grid[target];

        if (targetCell === MAT_EMPTY) {
            // Move randomly
            move(i, target);
        } else if (targetCell === MAT_DATA || targetCell === MAT_CACHE) {
            // Corrupt!
            grid[target] = MAT_EMPTY; // Eat it
            // Small chance to die
            if (Math.random() > 0.9) {
                grid[i] = MAT_EMPTY;
            } else {
                move(i, target);
            }
        }
    }
}

function updateProcess(i: number, x: number, y: number) {
    // Spawns Data below it randomly
    if (y >= height - 1) return;
    const below = getIndex(x, y + 1);
    if (grid[below] === MAT_EMPTY && Math.random() > 0.8) {
        grid[below] = MAT_DATA;
    }
}

function move(from: number, to: number) {
    grid[to] = grid[from];
    grid[from] = MAT_EMPTY;
}

function loop() {
    update();

    // Send state back to main thread to render
    // We clone the buffer to avoid race conditions since we aren't using SharedArrayBuffer
    const bufferToSend = new Int32Array(grid);

    self.postMessage({ type: 'UPDATE', buffer: bufferToSend.buffer }, [bufferToSend.buffer]);

    // Schedule next tick
    setTimeout(loop, 1000 / 60); // Target 60 FPS
}