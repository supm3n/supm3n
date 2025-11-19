// src/components/entropy/Constants.ts

export const CELL_SIZE = 4; // Pixels per cell (Lower = more resolution, higher CPU load)

// Material IDs
export const MAT_EMPTY = 0;
export const MAT_DATA = 1;   // Liquid/Sand (Cyan)
export const MAT_CACHE = 2;  // Wall (Emerald)
export const MAT_VIRUS = 3;  // Acid (Fuchsia)
export const MAT_PROCESS = 4; // Generator (Amber)

// Physics Config
export const GRAVITY = 1;
export const FPS = 60;
export const TICK_RATE = 1000 / FPS;

// Colors (Hex to Int32 ABGR for fast buffer writing in Renderer)
// Format: 0xAABBGGRR (Little Endian)
export const COLORS = {
    [MAT_EMPTY]: 0x00000000,    // Transparent
    [MAT_DATA]: 0xFFD4B606,     // Cyan #06b6d4 (A=FF, B=D4, G=B6, R=06)
    [MAT_CACHE]: 0xFF81B910,    // Emerald #10b981
    [MAT_VIRUS]: 0xFFEF46D9,    // Fuchsia #d946ef
    [MAT_PROCESS]: 0xFF0B9EF5   // Amber #f59e0b
};

export const COLORS_HEX = {
    [MAT_DATA]: '#06b6d4',
    [MAT_CACHE]: '#10b981',
    [MAT_VIRUS]: '#d946ef',
    [MAT_PROCESS]: '#f59e0b'
};