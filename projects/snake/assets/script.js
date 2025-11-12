// ============================================
// Snake Game
// ============================================

class SnakeGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.gridSize = 20;
    this.tileCount = 20;
    
    // Set canvas size - make it responsive
    this.setCanvasSize();
    
    // Update canvas size on window resize
    window.addEventListener('resize', () => this.setCanvasSize());
    
    // Game state
    this.snake = [{ x: 10, y: 10 }];
    this.food = { x: 15, y: 15 };
    this.dx = 0;
    this.dy = 0;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('snakeHighScore') || '0');
    this.gameRunning = false;
    this.gamePaused = false;
    this.gameLoop = null;
    
    // Direction queue for smooth controls
    this.nextDirection = null;
    
    // Initialize
    this.init();
  }
  
  setCanvasSize() {
    // Detect mobile
    const isMobile = window.innerWidth <= 768;
    const isShortScreen = window.innerHeight <= 800;
    
    // Calculate available space more aggressively on mobile
    // Footer is hidden on mobile, so we can use more space
    const padding = isMobile ? 20 : 40;
    
    // Reduced space needed since footer is hidden on mobile/short screens
    // Account for: header (~60px), breadcrumbs (~40px), game info (~60px), padding
    const headerFooterSpace = isMobile || isShortScreen 
      ? 160  // Footer hidden, minimal space needed
      : 280; // Footer visible but minimized
    
    // Get available viewport dimensions
    const maxWidth = Math.min(400, window.innerWidth - padding);
    
    // For mobile, use more aggressive height calculation
    // Account for header, breadcrumbs, game info, and minimal padding
    const availableHeight = window.innerHeight - headerFooterSpace;
    const maxHeight = Math.min(400, availableHeight);
    
    const size = Math.min(maxWidth, maxHeight);
    
    // Round down to nearest multiple of tileCount for clean grid
    const canvasSize = Math.floor(size / this.tileCount) * this.tileCount;
    
    // Ensure minimum size
    const minSize = this.tileCount * 10; // At least 10 tiles
    const finalSize = Math.max(canvasSize, minSize);
    
    this.canvas.width = finalSize;
    this.canvas.height = finalSize;
    this.canvas.style.width = finalSize + 'px';
    this.canvas.style.height = finalSize + 'px';
    
    // Update grid size to match canvas
    this.gridSize = finalSize / this.tileCount;
    
    // Redraw if game is initialized
    if (this.snake) {
      this.draw();
    }
  }
  
  init() {
    // Load high score
    this.updateHighScore();
    
    // Event listeners
    this.setupEventListeners();
    
    // Draw initial state
    this.draw();
  }
  
  setupEventListeners() {
    // Keyboard controls
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    
    // Mouse/touch controls
    this.canvas.addEventListener('click', (e) => this.handleMouseClick(e));
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleMouseClick(e.touches[0]);
    });
    
    // Button controls
    document.getElementById('start-btn').addEventListener('click', () => this.start());
    document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('reset-btn').addEventListener('click', () => this.reset());
    document.getElementById('play-again-btn').addEventListener('click', () => {
      document.getElementById('game-over').classList.add('hidden');
      this.reset();
      this.start();
    });
  }
  
  handleKeyPress(e) {
    if (!this.gameRunning && e.key !== ' ') return;
    
    // Prevent default for game keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D', ' '].includes(e.key)) {
      e.preventDefault();
    }
    
    // Pause/Resume with Space
    if (e.key === ' ') {
      this.togglePause();
      return;
    }
    
    // Direction controls
    const key = e.key.toLowerCase();
    let newDx = this.dx;
    let newDy = this.dy;
    
    // Arrow keys or WASD
    if (key === 'arrowup' || key === 'w') {
      if (this.dy === 0) { newDx = 0; newDy = -1; }
    } else if (key === 'arrowdown' || key === 's') {
      if (this.dy === 0) { newDx = 0; newDy = 1; }
    } else if (key === 'arrowleft' || key === 'a') {
      if (this.dx === 0) { newDx = -1; newDy = 0; }
    } else if (key === 'arrowright' || key === 'd') {
      if (this.dx === 0) { newDx = 1; newDy = 0; }
    }
    
    // Queue direction change if game is running
    if (this.gameRunning && !this.gamePaused) {
      this.nextDirection = { dx: newDx, dy: newDy };
    } else if (!this.gameRunning) {
      // Allow direction change before game starts
      this.dx = newDx;
      this.dy = newDy;
    }
  }
  
  handleMouseClick(e) {
    if (!this.gameRunning || this.gamePaused) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Get snake head position
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2;
    
    // Calculate direction based on click position relative to snake head
    const dx = x - headX;
    const dy = y - headY;
    
    let newDx = this.dx;
    let newDy = this.dy;
    
    // Determine direction based on which axis has larger difference
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal movement
      if (dx > 0 && this.dx === 0) {
        newDx = 1;
        newDy = 0;
      } else if (dx < 0 && this.dx === 0) {
        newDx = -1;
        newDy = 0;
      }
    } else {
      // Vertical movement
      if (dy > 0 && this.dy === 0) {
        newDx = 0;
        newDy = 1;
      } else if (dy < 0 && this.dy === 0) {
        newDx = 0;
        newDy = -1;
      }
    }
    
    this.nextDirection = { dx: newDx, dy: newDy };
  }
  
  start() {
    if (this.gameRunning) return;
    
    this.gameRunning = true;
    this.gamePaused = false;
    document.getElementById('game-start').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('start-btn').disabled = true;
    document.getElementById('pause-btn').disabled = false;
    
    // If no direction set, start moving right
    if (this.dx === 0 && this.dy === 0) {
      this.dx = 1;
      this.dy = 0;
    }
    
    this.gameLoop = setInterval(() => this.update(), 150);
  }
  
  togglePause() {
    if (!this.gameRunning) return;
    
    this.gamePaused = !this.gamePaused;
    const pauseBtn = document.getElementById('pause-btn');
    
    if (this.gamePaused) {
      clearInterval(this.gameLoop);
      pauseBtn.textContent = 'Resume';
    } else {
      this.gameLoop = setInterval(() => this.update(), 150);
      pauseBtn.textContent = 'Pause';
    }
  }
  
  reset() {
    this.gameRunning = false;
    this.gamePaused = false;
    this.snake = [{ x: 10, y: 10 }];
    this.food = this.generateFood();
    this.dx = 0;
    this.dy = 0;
    this.score = 0;
    this.nextDirection = null;
    
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    
    document.getElementById('start-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;
    document.getElementById('pause-btn').textContent = 'Pause';
    document.getElementById('game-start').classList.remove('hidden');
    
    this.updateScore();
    this.draw();
  }
  
  update() {
    if (this.gamePaused) return;
    
    // Apply queued direction change
    if (this.nextDirection) {
      this.dx = this.nextDirection.dx;
      this.dy = this.nextDirection.dy;
      this.nextDirection = null;
    }
    
    // Calculate new head position
    const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };
    
    // Check wall collision
    if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
      this.gameOver();
      return;
    }
    
    // Check self collision (check against current snake body, not including the new head)
    if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      this.gameOver();
      return;
    }
    
    // Add new head
    this.snake.unshift(head);
    
    // Check food collision
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      this.updateScore();
      
      // Generate new food (make sure it doesn't spawn on snake)
      this.food = this.generateFood();
      while (this.snake.some(segment => segment.x === this.food.x && segment.y === this.food.y)) {
        this.food = this.generateFood();
      }
    } else {
      // Remove tail if no food eaten
      this.snake.pop();
    }
    
    this.draw();
  }
  
  generateFood() {
    return {
      x: Math.floor(Math.random() * this.tileCount),
      y: Math.floor(Math.random() * this.tileCount)
    };
  }
  
  draw() {
    // Clear canvas
    this.ctx.fillStyle = '#0B0C10';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw grid
    this.ctx.strokeStyle = '#151820';
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= this.tileCount; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * this.gridSize, 0);
      this.ctx.lineTo(i * this.gridSize, this.canvas.height);
      this.ctx.stroke();
      
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * this.gridSize);
      this.ctx.lineTo(this.canvas.width, i * this.gridSize);
      this.ctx.stroke();
    }
    
    // Draw snake
    this.snake.forEach((segment, index) => {
      if (index === 0) {
        // Head
        this.ctx.fillStyle = '#06B6D4';
      } else {
        // Body - gradient from head to tail
        const alpha = 1 - (index / this.snake.length) * 0.5;
        this.ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
      }
      
      this.ctx.fillRect(
        segment.x * this.gridSize + 1,
        segment.y * this.gridSize + 1,
        this.gridSize - 2,
        this.gridSize - 2
      );
    });
    
    // Draw food
    this.ctx.fillStyle = '#EF4444';
    this.ctx.beginPath();
    this.ctx.arc(
      this.food.x * this.gridSize + this.gridSize / 2,
      this.food.y * this.gridSize + this.gridSize / 2,
      this.gridSize / 2 - 2,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
  }
  
  gameOver() {
    this.gameRunning = false;
    clearInterval(this.gameLoop);
    
    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('snakeHighScore', this.highScore.toString());
      this.updateHighScore();
    }
    
    document.getElementById('final-score').textContent = this.score;
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('start-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;
  }
  
  updateScore() {
    document.getElementById('score').textContent = this.score;
  }
  
  updateHighScore() {
    document.getElementById('high-score').textContent = this.highScore;
  }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.snakeGame = new SnakeGame();
});

