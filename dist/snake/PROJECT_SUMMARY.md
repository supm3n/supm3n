# Snake Game - Project Summary

## Overview

The Snake Game is a classic browser-based game implementation that follows the Supm3n project architecture. It's a fully responsive, mobile-friendly game built with pure JavaScript and HTML5 Canvas, integrated with the shared component system for consistent branding and navigation.

**Live URL**: `https://snake.supm3n.com/`  
**Deployment**: Cloudflare Pages  
**Tech Stack**: Vanilla JavaScript, HTML5 Canvas, CSS3

---

## Core Concept & Ideas

### Game Design Philosophy
- **Classic Gameplay**: Traditional Snake game mechanics - grow by eating food, avoid walls and self-collision
- **Accessibility**: Multiple input methods (keyboard, mouse, touch) for universal playability
- **Responsive Design**: Adapts to any screen size while maintaining game integrity
- **Performance**: Lightweight, no dependencies, smooth 60fps gameplay
- **Persistence**: High score saved in localStorage across sessions

### Key Features
- 🎮 **Multi-input Controls**: Arrow keys, WASD, mouse clicks, touch gestures
- ⏸️ **Pause/Resume**: Space bar or button control
- 📊 **Score Tracking**: Real-time score and persistent high score
- 🎨 **Visual Feedback**: Gradient snake body, grid background, smooth animations
- 📱 **Mobile Optimized**: Touch controls, responsive canvas sizing
- 🎯 **Collision Detection**: Wall and self-collision with proper game over handling

---

## Styling Approach

### Design System Integration
The Snake game uses the Supm3n shared design system while maintaining project-specific styling:

#### Shared Components
- **CSS Variables**: Uses `--color-*`, `--font-*`, `--space-*`, `--text-*` from shared variables
- **Shared Styles**: Loads `variables.css` and `components.css` from `https://supm3n.com/shared/styles/`
- **Component System**: Header, footer, and breadcrumbs loaded dynamically via `Supm3nComponents`

#### Project-Specific Styling (`assets/styles.css`)

**Base Styles**:
- Full viewport height with flexbox layout
- Radial gradient background matching Supm3n theme
- Font smoothing and consistent typography
- Base reset for consistent rendering

**Layout Strategy**:
- **Flexbox Container**: `main.container` uses flex column to fit content without scrolling
- **Responsive Canvas**: Dynamically sized based on viewport (max 400px, maintains aspect ratio)
- **Compact Spacing**: Reduced margins/padding using `clamp()` for fluid scaling
- **Mobile-First**: Controls info hidden by default, shown only on larger screens

**Key CSS Techniques**:
- `clamp()` for fluid typography and spacing
- `!important` flags on critical flex properties to override shared component styles
- Media queries for viewport-based layout adjustments:
  - `@media (max-width: 768px)`: Mobile layout optimizations
  - `@media (max-height: 800px)`: Compact layout for short screens
  - `@media (min-height: 900px) and (min-width: 768px)`: Show controls info

**Visual Design**:
- Glass morphism effects on overlays (game over, start screen)
- Gradient buttons matching Supm3n accent colors
- Monospace font for scores (JetBrains Mono)
- Smooth transitions and hover effects
- Box shadows for depth

**Color Scheme**:
- Background: Dark base (`#0B0C10`) with gradient overlays
- Snake: Cyan gradient (`#06B6D4`) with alpha fade for body segments
- Food: Red circle (`#EF4444`)
- Grid: Subtle dark lines (`#151820`)
- UI: Uses shared color variables for consistency

---

## Functionality & Game Logic

### Game Architecture (`assets/script.js`)

**Class Structure**: `SnakeGame` class encapsulates all game logic

#### Core Properties
- `canvas`, `ctx`: Canvas element and 2D rendering context
- `gridSize`, `tileCount`: Grid configuration (20x20 tiles)
- `snake`: Array of `{x, y}` coordinates representing snake body
- `food`: `{x, y}` coordinate for food position
- `dx`, `dy`: Direction vectors (-1, 0, 1)
- `score`, `highScore`: Current and best scores
- `gameRunning`, `gamePaused`: State flags
- `nextDirection`: Queued direction change for smooth controls

#### Key Methods

**`setCanvasSize()`**:
- Calculates responsive canvas size based on viewport
- Maintains square aspect ratio
- Rounds to nearest multiple of `tileCount` for clean grid
- Updates `gridSize` to match new canvas dimensions
- Redraws if game is initialized

**`handleKeyPress(e)`**:
- Supports Arrow keys, WASD, Space (pause)
- Prevents default behavior for game keys
- Queues direction changes (prevents instant 180° turns)
- Allows direction setting before game starts

**`handleMouseClick(e)`**:
- Calculates click position relative to snake head
- Determines direction based on larger axis difference (dx vs dy)
- Only allows perpendicular direction changes (prevents reverse)
- Works with both mouse and touch events

**`update()`** - Game Loop:
1. Applies queued direction change
2. Calculates new head position
3. **Wall Collision Check**: Bounds checking against grid edges
4. **Self Collision Check**: Checks against current snake body (before adding head)
5. Adds new head to snake array
6. **Food Collision Check**: If head matches food position:
   - Increment score
   - Generate new food (ensures not on snake)
   - Don't remove tail (snake grows)
7. If no food eaten, remove tail
8. Redraw canvas

**`draw()`** - Rendering:
- Clears canvas with base color
- Draws grid lines
- Draws snake with gradient (head = full cyan, body = alpha fade)
- Draws food as red circle
- All rendering uses calculated `gridSize` for proper scaling

**`generateFood()`**:
- Random position within grid bounds
- Validated to not spawn on snake body

**State Management**:
- `start()`: Begins game loop (150ms interval), enables controls
- `togglePause()`: Pauses/resumes game loop
- `reset()`: Resets game state, clears interval, shows start screen
- `gameOver()`: Stops game, updates high score, shows overlay

#### Collision Detection Logic

**Critical Implementation Detail**:
Self-collision is checked **before** adding the new head to the snake array. This prevents the game from immediately ending when the snake starts moving, as the head would otherwise collide with its own first segment.

```javascript
// Correct order:
const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };
if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
  this.gameOver();
  return;
}
this.snake.unshift(head); // Add head AFTER collision check
```

---

## Infrastructure & Architecture

### File Structure
```
snake/
├── index.html              # Main HTML file
├── assets/
│   ├── script.js          # Game logic (SnakeGame class)
│   └── styles.css         # Project-specific styles
├── wrangler.toml          # Cloudflare Pages config
└── PROJECT_SUMMARY.md     # This file
```

### Shared Component Integration

**HTML Structure** (`index.html`):
```html
<!-- Shared styles loaded in <head> -->
<link rel="stylesheet" href="https://supm3n.com/shared/styles/variables.css">
<link rel="stylesheet" href="https://supm3n.com/shared/styles/components.css">

<!-- Project-specific styles -->
<link rel="stylesheet" href="/assets/styles.css">

<!-- Empty containers for shared components -->
<header class="site-header"></header>
<nav class="breadcrumbs" id="breadcrumbs"></nav>
<footer class="site-footer"></footer>

<!-- Component loader -->
<script src="https://supm3n.com/shared/scripts/components.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    await Supm3nComponents.init({
      header: true,
      footer: true,
      breadcrumbs: true,
      styles: false, // Already loaded in <head>
      utils: true
    });
  });
</script>
```

**Component Loader**:
- Auto-detects development vs production (localhost vs supm3n.com)
- Dynamically injects header, footer, breadcrumbs HTML
- Loads utility functions if requested
- Handles errors gracefully with fallbacks

#### Inline overrides & cache busting
- `index.html` ships with an inline `<style>` block that constrains the header/footer and appends a cache-busting query string (`/assets/styles.css?v=20241108`). Increment the version whenever you ship CSS changes so browsers fetch the new file immediately.
- The `DOMContentLoaded` handler rebuilds the shared header (logo + navigation links) after `Supm3nComponents.init(...)` completes. This insulates the project from stale component HTML while keeping branding identical to the landing page.
- The same handler replaces the shared footer markup with a compact `.snake-footer-content` layout. On small or short viewports the footer is hidden entirely to reclaim vertical space for the canvas.
- If the global navigation gains new links, update the `links` array in `index.html` to keep the rebuilt menu in sync.

### Deployment

**Cloudflare Pages**:
- Project name: `snake`
- Build output: `.` (current directory)
- Compatibility date: `2024-11-01`
- Custom domain: `snake.supm3n.com`

**Deployment Script** (`deploy-snake.cmd`):
```cmd
@echo off
cd snake
wrangler pages deploy . --project-name snake
```

**Deployment Process**:
1. Navigate to `snake/` directory
2. Run `wrangler pages deploy . --project-name snake`
3. Files are uploaded to Cloudflare Pages
4. Site becomes available at configured domain

> **Tip:** Update the `?v=` suffix on the stylesheet link inside `index.html` whenever you make CSS changes. This invalidates CDN/browser caches so the new styling takes effect immediately after deployment.

### Dependencies
- **None**: Pure vanilla JavaScript, no npm packages
- **External Resources**:
  - Google Fonts (Inter, JetBrains Mono)
  - Shared components from `supm3n.com/shared/`

---

## Skeleton & Loading States

### Initial State
- **Game Start Screen**: Overlay shown when page loads
- **Canvas**: Rendered with initial snake and food positions
- **Buttons**: Start enabled, Pause/Reset disabled
- **Scores**: Display 0 (high score loaded from localStorage)

### Loading Behavior
- **No Async Loading**: All assets are static, no loading states needed
- **Component Loading**: Shared components load asynchronously but don't block game initialization
- **High Score**: Loaded synchronously from localStorage on initialization

### State Transitions
1. **Initial → Ready**: Page load, game initialized, start screen visible
2. **Ready → Running**: Start button clicked, game loop begins
3. **Running → Paused**: Pause button or Space pressed
4. **Paused → Running**: Resume button or Space pressed
5. **Running → Game Over**: Collision detected, overlay shown
6. **Game Over → Ready**: Reset button clicked, state cleared
7. **Any → Ready**: Reset button clicked from any state

### UI Feedback
- **Button States**: Disabled states for Start/Pause based on game state
- **Overlays**: Game over and start screens use glass morphism with backdrop blur
- **Score Updates**: Real-time score display updates on food consumption
- **High Score**: Updates and persists when new record achieved

---

## Technical Implementation Details

### Canvas Rendering
- **Resolution**: Dynamic based on viewport, maintains square aspect ratio
- **Grid System**: 20x20 tiles, `gridSize` calculated from canvas dimensions
- **Rendering Loop**: Called on every game update (150ms interval) and window resize
- **Performance**: Single canvas, efficient drawing operations, no unnecessary redraws

### Responsive Design
- **Canvas Sizing**: `setCanvasSize()` called on initialization and window resize
- **Viewport Calculations**: 
  - Max width: `min(400, window.innerWidth - 40)`
  - Max height: `min(400, window.innerHeight - 300)`
  - Final size: `min(maxWidth, maxHeight)` rounded to grid multiple
- **Mobile Optimizations**:
  - Reduced padding/margins on small screens
  - Controls info hidden on mobile
  - Touch event support
  - Larger tap targets

### Local Storage
- **Key**: `snakeHighScore`
- **Format**: String (converted to/from integer)
- **Persistence**: Survives page reloads, browser restarts
- **Fallback**: Defaults to 0 if not set

### Event Handling
- **Keyboard**: Global `keydown` listener (prevents default for game keys)
- **Mouse**: Canvas `click` listener
- **Touch**: Canvas `touchstart` listener (prevents default scroll)
- **Window**: `resize` listener for canvas recalculation
- **Buttons**: Individual click listeners for Start, Pause, Reset, Play Again

### Game Loop
- **Interval**: 150ms (approximately 6.67 updates per second)
- **Timing**: Uses `setInterval` (could be upgraded to `requestAnimationFrame` for smoother rendering)
- **Pause**: Clears interval, resumes by creating new interval
- **Cleanup**: Interval cleared on game over and reset

---

## Key Design Decisions

### Why 150ms Game Loop?
- Balance between responsiveness and difficulty
- Classic Snake game feel
- Smooth enough for enjoyable gameplay
- Not too fast for mobile touch controls

### Why Direction Queue?
- Prevents accidental 180° turns (instant death)
- Allows input buffering for better responsiveness
- Smooth control feel, especially on mobile

### Why Check Collision Before Adding Head?
- Prevents false positive self-collision
- Head would immediately collide with first body segment otherwise
- Critical for game to function correctly

### Why Responsive Canvas?
- Mobile-first design philosophy
- Ensures game fits on any screen
- Maintains game integrity (square grid)
- Better user experience across devices

### Why Hide Controls Info by Default?
- Space optimization for mobile
- Most users understand Snake controls
- Progressive disclosure (show when space available)
- Cleaner, less cluttered interface

### Why Shared Components?
- Consistent branding across Supm3n projects
- Unified navigation experience
- Theme persistence (dark/light mode)
- Reduced maintenance overhead
- Breadcrumb navigation for context

### Why rebuild shared components after init?
- Cloudflare can serve cached versions of `shared/components/header.html`; rebuilding the header ensures the logo and navigation links always match the landing page.
- The inline override keeps the menu available even if the shared component fetch fails, which is critical when the game is embedded or accessed via stale caches.
- Replacing the footer with a compact variant preserves screen real estate so the canvas remains centred, especially on laptops and mobile devices.

---

## Browser Compatibility

### Supported Features
- **Canvas API**: All modern browsers
- **LocalStorage**: All modern browsers
- **Flexbox**: All modern browsers
- **CSS Variables**: All modern browsers
- **Touch Events**: Mobile browsers
- **ES6 Classes**: All modern browsers

### Fallbacks
- Shared component loader has fallback HTML if loading fails
- High score defaults to 0 if localStorage unavailable
- Canvas gracefully degrades (game won't work, but page loads)

---

## Future Enhancement Ideas

### Potential Improvements
- **Difficulty Levels**: Adjustable game speed
- **Power-ups**: Special food types with effects
- **Obstacles**: Static barriers on the grid
- **Multiplayer**: Local or online multiplayer modes
- **Leaderboard**: Global high score tracking
- **Animations**: Smooth snake movement interpolation
- **Sound Effects**: Audio feedback for actions
- **Themes**: Multiple visual themes
- **Statistics**: Track games played, average score, etc.
- **Replay System**: Record and replay games

### Technical Improvements
- **requestAnimationFrame**: Replace `setInterval` for smoother rendering
- **Web Workers**: Offload game logic for better performance
- **Service Worker**: Offline support and caching
- **Progressive Web App**: Installable, app-like experience
- **TypeScript**: Type safety for larger codebase
- **Unit Tests**: Test game logic independently

---

## Quick Reference

### Key Files
- `index.html`: Main HTML structure
- `assets/script.js`: Game logic (SnakeGame class)
- `assets/styles.css`: Project-specific styling
- `wrangler.toml`: Cloudflare Pages configuration

### Key Classes/IDs
- `#game-canvas`: Canvas element
- `#score`, `#high-score`: Score displays
- `#start-btn`, `#pause-btn`, `#reset-btn`: Control buttons
- `#game-over`, `#game-start`: Overlay screens
- `.game-container`: Main game wrapper
- `.game-wrapper`: Canvas container

### Key Methods
- `SnakeGame.setCanvasSize()`: Responsive canvas sizing
- `SnakeGame.start()`: Begin game loop
- `SnakeGame.update()`: Game logic update
- `SnakeGame.draw()`: Canvas rendering
- `SnakeGame.handleKeyPress()`: Keyboard input
- `SnakeGame.handleMouseClick()`: Mouse/touch input

### Key CSS Variables Used
- `--color-base`: Background color
- `--color-text-primary`: Primary text color
- `--color-text-muted`: Muted text color
- `--color-accent-start`, `--color-accent-end`: Accent gradients
- `--color-surface-1`, `--color-surface-2`: Surface colors
- `--font-sans`, `--font-mono`: Font families
- `--space-*`: Spacing scale
- `--text-*`: Typography scale
- `--glass-border`: Border color for glass effects

---

## Notes for AI Assistants

When working on this project:

1. **Styling Conflicts**: Shared component styles may conflict with project styles. Use `!important` sparingly and only on critical layout properties (`display`, `flex-direction`).

2. **Canvas Sizing**: Always call `setCanvasSize()` after any canvas-related changes. The canvas must maintain square aspect ratio and be a multiple of `tileCount`.

3. **Collision Detection**: Self-collision must be checked **before** adding the new head to the snake array. This is a critical bug that was fixed.

4. **Responsive Design**: Test on multiple viewport sizes. The game should fit without scrolling on mobile devices.

5. **Shared Components**: Components load asynchronously. Don't assume they're available immediately. Use `DOMContentLoaded` or component loader callbacks.

6. **Local Storage**: High score uses `localStorage.getItem('snakeHighScore')`. Handle cases where localStorage might not be available.

7. **Game Loop**: The 150ms interval is intentional for classic Snake feel. Changing it affects game difficulty significantly.

8. **Direction Queue**: The `nextDirection` queue prevents instant 180° turns. This is a feature, not a bug.

9. **Mobile Touch**: Touch events need `preventDefault()` to prevent scrolling while playing.

10. **Deployment**: Always test locally before deploying. The game should work without shared components (with fallbacks) for development.

---

*Last Updated: Based on current implementation as of latest deployment*

