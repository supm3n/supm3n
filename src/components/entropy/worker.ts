// src/components/entropy/worker.ts
import { MAT_EMPTY, MAT_DATA, MAT_CACHE, MAT_VIRUS, MAT_PROCESS, MAT_FIREWALL, MAT_ANTIDATA } from './Constants';

let width = 0;
let height = 0;
let grid: Int32Array;

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'INIT') {
        width = payload.width;
        height = payload.height;
        grid = new Int32Array(width * height).fill(MAT_EMPTY);
        loop();
    } else if (type === 'PAINT') {
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
                    // Allow overwriting unless it's a Wall (Cache), unless we are erasing
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
    const randomDir = Math.random() > 0.5 ? 1 : -1;

    // PASS 1: GRAVITY (Bottom -> Up)
    for (let y = height - 1; y >= 0; y--) {
        const startX = randomDir === 1 ? 0 : width - 1;
        const endX = randomDir === 1 ? width : -1;
        const step = randomDir === 1 ? 1 : -1;

        for (let x = startX; x !== endX; x += step) {
            const idx = getIndex(x, y);
            const cell = grid[idx];

            if (cell === MAT_DATA) updateData(idx, x, y);
            else if (cell === MAT_VIRUS) updateVirus(idx, x, y);
            else if (cell === MAT_PROCESS) updateProcess(idx, x, y);
        }
    }

    // PASS 2: ANTI-GRAVITY (Top -> Down)
    for (let y = 0; y < height; y++) {
        const startX = randomDir === 1 ? 0 : width - 1;
        const endX = randomDir === 1 ? width : -1;
        const step = randomDir === 1 ? 1 : -1;

        for (let x = startX; x !== endX; x += step) {
            const idx = getIndex(x, y);
            const cell = grid[idx];

            if (cell === MAT_FIREWALL) updateFirewall(idx, x, y);
            else if (cell === MAT_ANTIDATA) updateAntiData(idx, x, y);
        }
    }
}

// --- BEHAVIOR FUNCTIONS ---

function updateData(i: number, x: number, y: number) {
    if (y >= height - 1) return; // Bottom
    const below = getIndex(x, y + 1);
    const cellBelow = grid[below];

    if (cellBelow === MAT_EMPTY) {
        move(i, below);
    } else if (cellBelow === MAT_ANTIDATA) {
        grid[i] = MAT_EMPTY; // Annihilate
        grid[below] = MAT_EMPTY;
    } else if (cellBelow === MAT_FIREWALL) {
        grid[i] = MAT_EMPTY; // Evaporate
    } else {
        slide(i, x, y, 1); // Slide Down
    }
}

function updateAntiData(i: number, x: number, y: number) {
    if (y <= 0) return; // Top
    const above = getIndex(x, y - 1);
    const cellAbove = grid[above];

    if (cellAbove === MAT_EMPTY) {
        move(i, above);
    } else if (cellAbove === MAT_DATA) {
        grid[i] = MAT_EMPTY; // Annihilate
        grid[above] = MAT_EMPTY;
    } else {
        slide(i, x, y, -1); // Slide Up
    }
}

function updateFirewall(i: number, x: number, y: number) {
    // 1. Decay (Very slow now: 1% chance)
    if (Math.random() > 0.99) {
        grid[i] = MAT_EMPTY;
        return;
    }

    // 2. Rise (Gas physics)
    if (y > 0) {
        const above = getIndex(x, y - 1);
        const cellAbove = grid[above];
        if (cellAbove === MAT_EMPTY) {
            // 30% chance to rise straight up
            if (Math.random() > 0.7) move(i, above);
        } else if (cellAbove === MAT_DATA || cellAbove === MAT_VIRUS) {
            // Burn what's above
            grid[above] = MAT_FIREWALL;
        }
    }

    // 3. Expand/Burn Neighbors
    // We only burn sideways occasionally to prevent instant screen fill
    if (Math.random() > 0.8) {
        const dir = Math.random() > 0.5 ? 1 : -1;
        const nx = x + dir;
        if (nx >= 0 && nx < width) {
            const nIdx = getIndex(nx, y);
            const neighbor = grid[nIdx];
            if (neighbor === MAT_VIRUS || neighbor === MAT_DATA) {
                grid[nIdx] = MAT_FIREWALL;
            }
        }
    }
}

function updateVirus(i: number, x: number, y: number) {
    const dirX = Math.floor(Math.random() * 3) - 1;
    const dirY = Math.floor(Math.random() * 3) - 1;
    if (dirX === 0 && dirY === 0) return;

    const tx = x + dirX;
    const ty = y + dirY;

    if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
        const target = getIndex(tx, ty);
        const targetCell = grid[target];

        if (targetCell === MAT_EMPTY) {
            move(i, target);
        } else if (targetCell === MAT_DATA || targetCell === MAT_CACHE) {
            grid[target] = MAT_EMPTY; // Eat
            // 5% Chance to replicate, else move
            if (Math.random() > 0.95) grid[i] = MAT_VIRUS;
            else move(i, target);
        } else if (targetCell === MAT_FIREWALL) {
            grid[i] = MAT_FIREWALL; // Die to fire
        }
    }
}

function updateProcess(i: number, x: number, y: number) {
    // Spawner
    if (y >= height - 1) return;
    const below = getIndex(x, y + 1);
    // 10% chance per frame to spawn data
    if (grid[below] === MAT_EMPTY && Math.random() > 0.9) {
        grid[below] = MAT_DATA;
    }
}

function slide(i: number, x: number, y: number, dirY: number) {
    // dirY is 1 for gravity (down), -1 for anti-gravity (up)
    const rand = Math.random();
    const dx = rand > 0.5 ? 1 : -1;

    const targetY = y + dirY;
    if (targetY < 0 || targetY >= height) return;

    const diag1 = getIndex(x + dx, targetY);
    const diag2 = getIndex(x - dx, targetY);

    const valid1 = (x + dx >= 0 && x + dx < width && grid[diag1] === MAT_EMPTY);
    const valid2 = (x - dx >= 0 && x - dx < width && grid[diag2] === MAT_EMPTY);

    if (valid1) move(i, diag1);
    else if (valid2) move(i, diag2);
}

function move(from: number, to: number) {
    grid[to] = grid[from];
    grid[from] = MAT_EMPTY;
}

function loop() {
    update();
    // Clone buffer to send to main thread
    const bufferToSend = new Int32Array(grid);
    self.postMessage({ type: 'UPDATE', buffer: bufferToSend.buffer }, [bufferToSend.buffer]);

    // 60 FPS loop
    setTimeout(loop, 1000 / 60);
}