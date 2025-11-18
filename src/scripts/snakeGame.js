// src/scripts/snakeGame.js
export class SnakeGame {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      if (!this.canvas) return;
  
      this.ctx = this.canvas.getContext('2d');
      this.gridSize = 20;
      this.tileCount = 20;
      
      this.setCanvasSize();
      window.addEventListener('resize', () => this.setCanvasSize());
      this.snake = [{ x: 10, y: 10 }];
      this.food = { x: 15, y: 15 };
      this.dx = 0;
      this.dy = 0;
      this.score = 0;
      this.highScore = parseInt(localStorage.getItem('snakeHighScore') || '0');
      this.gameRunning = false;
      this.gamePaused = false;
      this.gameLoop = null;
      this.nextDirection = null;
      
      this.init();
    }
    
    setCanvasSize() {
      const isMobile = window.innerWidth <= 768;
      const isShortScreen = window.innerHeight <= 800;
      
      const padding = isMobile ? 20 : 40;
      const headerFooterSpace = isMobile || isShortScreen ? 160 : 280;
      
      const maxWidth = Math.min(400, window.innerWidth - padding);
      const availableHeight = window.innerHeight - headerFooterSpace;
      const maxHeight = Math.min(400, availableHeight);
      
      const size = Math.min(maxWidth, maxHeight);
      const canvasSize = Math.floor(size / this.tileCount) * this.tileCount;
      const finalSize = Math.max(canvasSize, this.tileCount * 10);
      
      this.canvas.width = finalSize;
      this.canvas.height = finalSize;
      this.canvas.style.width = finalSize + 'px';
      this.canvas.style.height = finalSize + 'px';
      
      this.gridSize = finalSize / this.tileCount;
      if (this.snake) this.draw();
    }
    
    init() {
      this.updateHighScore();
      this.setupEventListeners();
      this.draw();
    }
    
    setupEventListeners() {
      document.addEventListener('keydown', (e) => this.handleKeyPress(e));
      
      this.canvas.addEventListener('click', (e) => this.handleMouseClick(e));
      this.canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.handleMouseClick(e.touches[0]);
      });
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
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' '].includes(e.key)) {
        e.preventDefault();
      }
      
      if (e.key === ' ') {
        this.togglePause();
        return;
      }
      
      const key = e.key.toLowerCase();
      let newDx = this.dx;
      let newDy = this.dy;
      
      if (key === 'arrowup' || key === 'w') {
        if (this.dy === 0) { newDx = 0; newDy = -1; }
      } else if (key === 'arrowdown' || key === 's') {
        if (this.dy === 0) { newDx = 0; newDy = 1; }
      } else if (key === 'arrowleft' || key === 'a') {
        if (this.dx === 0) { newDx = -1; newDy = 0; }
      } else if (key === 'arrowright' || key === 'd') {
        if (this.dx === 0) { newDx = 1; newDy = 0; }
      }
      
      if (this.gameRunning && !this.gamePaused) {
        this.nextDirection = { dx: newDx, dy: newDy };
      } else if (!this.gameRunning) {
        this.dx = newDx;
        this.dy = newDy;
      }
    }
    
    handleMouseClick(e) {
      if (!this.gameRunning || this.gamePaused) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const head = this.snake[0];
      const headX = head.x * this.gridSize + this.gridSize / 2;
      const headY = head.y * this.gridSize + this.gridSize / 2;
      const dx = x - headX;
      const dy = y - headY;
      
      let newDx = this.dx;
      let newDy = this.dy;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && this.dx === 0) { newDx = 1; newDy = 0; }
        else if (dx < 0 && this.dx === 0) { newDx = -1; newDy = 0; }
      } else {
        if (dy > 0 && this.dy === 0) { newDx = 0; newDy = 1; }
        else if (dy < 0 && this.dy === 0) { newDx = 0; newDy = -1; }
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
      this.dx = 0; this.dy = 0;
      this.score = 0;
      this.nextDirection = null;
      
      if (this.gameLoop) { clearInterval(this.gameLoop); this.gameLoop = null; }
      
      document.getElementById('start-btn').disabled = false;
      document.getElementById('pause-btn').disabled = true;
      document.getElementById('pause-btn').textContent = 'Pause';
      document.getElementById('game-start').classList.remove('hidden');
      
      this.updateScore();
      this.draw();
    }
    
    update() {
      if (this.gamePaused) return;
      if (this.nextDirection) {
        this.dx = this.nextDirection.dx;
        this.dy = this.nextDirection.dy;
        this.nextDirection = null;
      }
      
      const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };
      if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
        this.gameOver();
        return;
      }
      
      if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        this.gameOver();
        return;
      }
      
      this.snake.unshift(head);
      if (head.x === this.food.x && head.y === this.food.y) {
        this.score += 10;
        this.updateScore();
        this.food = this.generateFood();
        while (this.snake.some(segment => segment.x === this.food.x && segment.y === this.food.y)) {
          this.food = this.generateFood();
        }
      } else {
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
      this.ctx.fillStyle = '#0B0C10';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
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
      
      this.snake.forEach((segment, index) => {
        if (index === 0) this.ctx.fillStyle = '#06B6D4';
        else {
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
    
    updateScore() { document.getElementById('score').textContent = this.score; }
    updateHighScore() { document.getElementById('high-score').textContent = this.highScore; }
  }