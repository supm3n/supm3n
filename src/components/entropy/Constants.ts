// src/components/entropy/Constants.ts

export const CELL_SIZE = 4; // Low resolution for "pixel art" feel

// Material IDs
export const MAT_EMPTY = 0;
export const MAT_DATA = 1;      // Liquid (Cyan)
export const MAT_CACHE = 2;     // Wall (Emerald)
export const MAT_VIRUS = 3;     // Acid (Fuchsia)
export const MAT_PROCESS = 4;   // Generator (Amber)
export const MAT_FIREWALL = 5;  // Plasma (Orange/Red)
export const MAT_ANTIDATA = 6;  // Glitch (Magenta)

// Physics Config
export const FPS = 60;

// Colors (Int32 Little Endian: AABBGGRR)
export const COLORS = {
    [MAT_EMPTY]: 0x00000000,
    [MAT_DATA]: 0xFFD4B606,     // Cyan #06b6d4
    [MAT_CACHE]: 0xFF81B910,    // Emerald #10b981
    [MAT_VIRUS]: 0xFFEF46D9,    // Fuchsia #d946ef
    [MAT_PROCESS]: 0xFF0B9EF5,  // Amber #f59e0b
    [MAT_FIREWALL]: 0xFF0055FF, // Orange #FF5500
    [MAT_ANTIDATA]: 0xFFFF00FF  // Magenta #FF00FF
};