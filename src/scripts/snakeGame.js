// src/scripts/snakeGame.js

// Import Firebase SDKs from CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, onSnapshot, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

export class SnakeGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.wrapper = document.querySelector('.game-wrapper');
    if (!this.canvas || !this.wrapper) return;

    this.ctx = this.canvas.getContext('2d');
    this.tileCount = 20; // Number of tiles per row/col

    // State
    this.snake = [{ x: 10, y: 10 }];
    this.food = { x: 15, y: 15 };
    this.dx = 0;
    this.dy = 0;
    this.score = 0;

    // Initialize High Score from local storage first
    this.highScore = parseInt(localStorage.getItem('snakeHighScore') || '0');

    this.gameRunning = false;
    this.gamePaused = false;
    this.isGameOver = false; // New strict state
    this.gameLoop = null;
    this.nextDirection = null;

    // Firebase Refs
    this.db = null;
    this.globalDocRef = null;

    // Initial Setup
    this.init();

    // Start connection to global leaderboard
    this.connectGlobalScore();
  }

  async connectGlobalScore() {
    if (typeof __firebase_config === 'undefined') return;

    try {
      const config = JSON.parse(__firebase_config);
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default';

      const app = initializeApp(config);
      const auth = getAuth(app);
      const db = getFirestore(app);

      this.globalDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'snake_scores', 'global');
      this.db = db;

      await signInAnonymously(auth);

      onSnapshot(this.globalDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const remoteBest = data.score || 0;
          if (remoteBest > this.highScore) {
            this.highScore = remoteBest;
            this.updateHighScore();
            localStorage.setItem('snakeHighScore', this.highScore.toString());
            this.flashHighScore("NEW RECORD");
          }
        }
      });
    } catch (err) {
      console.warn("Could not connect to global scores:", err);
    }
  }

  async uploadGlobalScore(newScore) {
    if (!this.db || !this.globalDocRef) return;
    try {
      await setDoc(this.globalDocRef, {
        score: newScore,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to upload score:", err);
    }
  }

  init() {
    this.updateHighScore();
    this.setupEventListeners();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.wrapper) return;
    const rect = this.wrapper.getBoundingClientRect();
    const padding = 20;
    const availableW = rect.width - padding;
    const availableH = rect.height - padding;
    let size = Math.min(availableW, availableH);
    this.gridSize = Math.floor(size / this.tileCount);
    const finalSize = this.gridSize * this.tileCount;
    this.canvas.width = finalSize;
    this.canvas.height = finalSize;
    this.draw();
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    this.canvas.addEventListener('click', (e) => this.handleInputAt(e.clientX, e.clientY));
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        this.handleInputAt(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    document.getElementById('start-btn')?.addEventListener('click', () => this.start());
    document.getElementById('pause-btn')?.addEventListener('click', () => this.togglePause());
    document.getElementById('reset-btn')?.addEventListener('click', () => this.reset());
    document.getElementById('play-again-btn')?.addEventListener('click', () => {
      document.getElementById('game-over').classList.add('hidden');
      this.reset();
      this.start();
    });
  }

  handleKeyPress(e) {
    // Prevent scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' '].includes(e.key)) {
      if (this.gameRunning || this.isGameOver) e.preventDefault();
    }

    const key = e.key.toLowerCase();

    // 1. CRITICAL FIX: Handle Game Over state (Strict Restart)
    if (this.isGameOver) {
      const restartKeys = ['enter', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];
      if (restartKeys.includes(key)) {
        this.reset();
        this.start();
        // Allow logic below to set initial direction immediately
      } else {
        return;
      }
    }

    // 2. Pause
    if (key === ' ' && !this.isGameOver) {
      this.togglePause();
      return;
    }

    // 3. Initial Start (from Idle)
    if (!this.gameRunning && !this.gamePaused && !this.isGameOver) {
      if (key === 'enter' || key.startsWith('arrow') || ['w', 'a', 's', 'd'].includes(key)) {
        this.start();
      }
    }

    // 4. Direction Logic
    let newDx = this.dx;
    let newDy = this.dy;

    if (key === 'arrowup' || key === 'w') { if (this.dy === 0) { newDx = 0; newDy = -1; } }
    else if (key === 'arrowdown' || key === 's') { if (this.dy === 0) { newDx = 0; newDy = 1; } }
    else if (key === 'arrowleft' || key === 'a') { if (this.dx === 0) { newDx = -1; newDy = 0; } }
    else if (key === 'arrowright' || key === 'd') { if (this.dx === 0) { newDx = 1; newDy = 0; } }

    // Apply direction if game is running
    if (this.gameRunning && !this.gamePaused) {
      this.nextDirection = { dx: newDx, dy: newDy };
    } else if (!this.gameRunning && !this.gamePaused) {
      // Set initial direction for next start
      this.dx = newDx;
      this.dy = newDy;
    }
  }

  handleInputAt(clientX, clientY) {
    if (this.isGameOver) {
      this.reset();
      this.start();
      return;
    }

    if (!this.gameRunning || this.gamePaused) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2;
    const deltaX = x - headX;
    const deltaY = y - headY;

    let newDx = this.dx;
    let newDy = this.dy;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 0 && this.dx === 0) { newDx = 1; newDy = 0; }
      else if (deltaX < 0 && this.dx === 0) { newDx = -1; newDy = 0; }
    } else {
      if (deltaY > 0 && this.dy === 0) { newDx = 0; newDy = 1; }
      else if (deltaY < 0 && this.dy === 0) { newDx = 0; newDy = -1; }
    }
    this.nextDirection = { dx: newDx, dy: newDy };
  }

  start() {
    if (this.gameRunning) return;
    this.gameRunning = true;
    this.gamePaused = false;
    this.isGameOver = false; // Ensure flag is clear

    document.getElementById('game-start')?.classList.add('hidden');
    document.getElementById('game-over')?.classList.add('hidden');

    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    if (startBtn) startBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = false;

    // Default to Right if no direction set
    if (this.dx === 0 && this.dy === 0) { this.dx = 1; this.dy = 0; }

    if (this.gameLoop) clearInterval(this.gameLoop);
    this.gameLoop = setInterval(() => this.update(), 150);
  }

  togglePause() {
    if (!this.gameRunning || this.isGameOver) return;
    this.gamePaused = !this.gamePaused;
    const pauseBtn = document.getElementById('pause-btn');
    if (this.gamePaused) {
      clearInterval(this.gameLoop);
      if (pauseBtn) pauseBtn.textContent = 'Resume';
      this.drawPaused();
    } else {
      this.gameLoop = setInterval(() => this.update(), 150);
      if (pauseBtn) pauseBtn.textContent = 'Pause';
    }
  }

  reset() {
    this.gameRunning = false;
    this.gamePaused = false;
    this.isGameOver = false; // Reset flag

    if (this.gameLoop) { clearInterval(this.gameLoop); this.gameLoop = null; }

    this.snake = [{ x: 10, y: 10 }];
    this.food = this.generateFood();
    this.dx = 0; this.dy = 0;
    this.score = 0;
    this.nextDirection = null;

    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) { pauseBtn.disabled = true; pauseBtn.textContent = 'Pause'; }

    document.getElementById('game-start')?.classList.remove('hidden');
    this.updateScore();
    this.draw();
  }

  update() {
    if (this.gamePaused || this.isGameOver) return;

    if (this.nextDirection) {
      if (this.nextDirection.dx !== -this.dx || this.nextDirection.dy !== -this.dy) {
        this.dx = this.nextDirection.dx;
        this.dy = this.nextDirection.dy;
      }
      this.nextDirection = null;
    }

    const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };

    // Collision (Walls)
    if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
      this.gameOver();
      return;
    }
    // Collision (Self)
    if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      this.gameOver();
      return;
    }

    this.snake.unshift(head);

    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      this.updateScore();
      this.food = this.generateFood();
      // Prevent food spawning on snake
      let safe = false;
      while (!safe) {
        safe = true;
        for (let s of this.snake) {
          if (s.x === this.food.x && s.y === this.food.y) {
            this.food = this.generateFood();
            safe = false;
            break;
          }
        }
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
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Food
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = "#EF4444";
    this.ctx.fillStyle = '#EF4444';
    const foodX = this.food.x * this.gridSize + this.gridSize / 2;
    const foodY = this.food.y * this.gridSize + this.gridSize / 2;
    const foodR = this.gridSize / 2 - 2;
    this.ctx.beginPath();
    this.ctx.arc(foodX, foodY, Math.max(0, foodR), 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    // Snake
    this.snake.forEach((segment, index) => {
      if (index === 0) {
        this.ctx.fillStyle = '#10B981';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = "#10B981";
      } else {
        this.ctx.shadowBlur = 0;
        const alpha = 1 - (index / (this.snake.length + 5)) * 0.6;
        this.ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
      }
      this.ctx.fillRect(
        segment.x * this.gridSize + 1,
        segment.y * this.gridSize + 1,
        this.gridSize - 2,
        this.gridSize - 2
      );
    });
    this.ctx.shadowBlur = 0;
  }

  drawPaused() {
    this.ctx.fillStyle = "rgba(0,0,0,0.5)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#fff";
    this.ctx.font = "20px monospace";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText("PAUSED", this.canvas.width / 2, this.canvas.height / 2);
  }

  flashHighScore(msg) {
    const el = document.getElementById('high-score-label');
    if (el) {
      const original = el.textContent;
      el.textContent = msg;
      el.style.color = '#fff';
      setTimeout(() => {
        el.textContent = original;
        el.style.color = '';
      }, 2000);
    }
  }

  gameOver() {
    this.gameRunning = false;
    this.isGameOver = true; // Activate strict game over state
    clearInterval(this.gameLoop);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.updateHighScore();
      localStorage.setItem('snakeHighScore', this.highScore.toString());
      this.uploadGlobalScore(this.score);
    }

    const finalEl = document.getElementById('final-score');
    if (finalEl) finalEl.textContent = this.score;

    document.getElementById('game-over')?.classList.remove('hidden');
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) pauseBtn.disabled = true;
  }

  updateScore() {
    const el = document.getElementById('score');
    if (el) el.textContent = this.score;
  }
  updateHighScore() {
    const el = document.getElementById('high-score');
    if (el) el.textContent = this.highScore;
  }
}