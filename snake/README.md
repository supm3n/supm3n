# Snake Game

Classic Snake game playable in your browser with keyboard and mouse/touch controls.

## Features

- 🎮 Keyboard controls (Arrow keys, WASD)
- 🖱️ Mouse/touch controls (click/tap to change direction)
- 📊 Score tracking with high score (saved in localStorage)
- ⏸️ Pause/Resume functionality
- 🎨 Beautiful, responsive design matching Supm3n theme
- 📱 Mobile-friendly touch controls

## Controls

### Keyboard
- **Arrow Keys** or **WASD** - Change direction
- **Space** - Pause/Resume

### Mouse/Touch
- Click or tap on the game area to change direction
- Direction is determined by click position relative to snake head

## How to Play

1. Click "Start" to begin
2. Use arrow keys, WASD, or click/tap to control the snake
3. Eat the red food to grow and increase your score
4. Avoid hitting walls or yourself
5. Try to beat your high score!

## Deployment

Deploy to Cloudflare Pages:

```bash
cd snake
wrangler pages deploy . --project-name snake
```

Or use the deployment script from the root directory.

## Technology

- Pure JavaScript (no dependencies)
- HTML5 Canvas for rendering
- Shared components from `supm3n.com/shared/`

