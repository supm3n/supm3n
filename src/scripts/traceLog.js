export class TraceSystem {
    constructor() {
        this.consoleEl = document.getElementById('console-out');
        this.statusEl = document.getElementById('status-text');
        this.terminal = document.getElementById('terminal');
        this.ipDisplay = document.getElementById('big-ip');
        this.summaryBox = document.getElementById('summary');
        this.rerunBtn = document.getElementById('rerun');

        this.canvas = document.getElementById('neural-canvas');
        this.ctx = this.canvas?.getContext('2d');

        if (!this.canvas || !this.ctx) return;

        this.isTracing = false;
        this.animId = null;
        this.points = [];
        this.rotation = 0;
        this.mode = 'idle';

        // Init
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        if (this.rerunBtn) this.rerunBtn.addEventListener('click', () => this.start());

        // Start loop immediately for idle animation
        this.initPoints();
        this.startAnimation();

        // Auto Start Trace
        setTimeout(() => { if (!this.isTracing) this.start(); }, 1000);
    }

    resizeCanvas() {
        const panel = this.terminal.querySelector('.panel-visual');
        if (!panel) return;

        const rect = panel.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.cx = this.canvas.width / 2;
        this.cy = this.canvas.height / 2;
    }

    /* --- 3D MATH --- */
    initPoints() {
        this.points = [];
        const numPoints = 250;
        const radius = 140;

        // Fibonacci Sphere distribution
        const phi = Math.PI * (3 - Math.sqrt(5));

        for (let i = 0; i < numPoints; i++) {
            const y = 1 - (i / (numPoints - 1)) * 2;
            const radiusAtY = Math.sqrt(1 - y * y);
            const theta = phi * i;

            const x = Math.cos(theta) * radiusAtY;
            const z = Math.sin(theta) * radiusAtY;

            this.points.push({
                x: x * radius,
                y: y * radius,
                z: z * radius,
                ox: x * radius,
                oy: y * radius,
                oz: z * radius,
                active: Math.random() > 0.9,
                pulseOffset: Math.random() * 100
            });
        }
    }

    startAnimation() {
        if (this.animId) cancelAnimationFrame(this.animId);

        const animate = () => {
            // 1. Clear & Glitch
            this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            // 2. Rotate
            if (this.mode === 'scanning') this.rotation += 0.01;
            if (this.mode === 'idle') this.rotation += 0.002;
            if (this.mode === 'locked') {
                this.rotation += 0.002; // Slow drift
            }

            // 3. Projection
            this.points.forEach(p => {
                // Rotation Matrix Y
                let x1 = p.x * Math.cos(this.rotation) - p.z * Math.sin(this.rotation);
                let z1 = p.z * Math.cos(this.rotation) + p.x * Math.sin(this.rotation);

                // Rotation Matrix X (Tilt)
                let tilt = 0.3;
                let y2 = p.y * Math.cos(tilt) - z1 * Math.sin(tilt);
                let z2 = z1 * Math.cos(tilt) + p.y * Math.sin(tilt);

                // 3D Project
                const fov = 300;
                const scale = fov / (fov + z2);
                const x2d = this.cx + x1 * scale;
                const y2d = this.cy + y2 * scale;

                // Store 2d for line drawing
                p.sx = x2d;
                p.sy = y2d;
                p.scale = scale;

                // Draw Node (Depth cull)
                if (scale > 0) {
                    const alpha = (z2 + 140) / 280;
                    let color = (this.mode === 'locked') ? '#ff003c' : '#00f0ff';

                    this.ctx.fillStyle = color;
                    this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

                    let size = (this.mode === 'locked' && p.active) ? 3 : 1.5;

                    // PULSE EFFECT
                    if (this.mode === 'locked' && p.active) {
                        size += Math.sin((Date.now() / 200) + p.pulseOffset) * 1.5;
                    }

                    // Draw Rect instead of Arc for tech look
                    this.ctx.fillRect(x2d, y2d, Math.max(0, size * scale), Math.max(0, size * scale));
                }
            });

            // Draw Connections
            this.ctx.lineWidth = 0.5;
            let connectColor = (this.mode === 'locked') ? 'rgba(255, 0, 60, 0.15)' : 'rgba(0, 240, 255, 0.15)';
            this.ctx.strokeStyle = connectColor;

            for (let i = 0; i < this.points.length; i++) {
                const p1 = this.points[i];
                if (p1.scale <= 0) continue;

                for (let j = 1; j < 4; j++) {
                    const p2 = this.points[(i + j) % this.points.length];
                    if (p2.scale <= 0) continue;

                    const dx = p1.sx - p2.sx;
                    const dy = p1.sy - p2.sy;
                    if (dx * dx + dy * dy < 1600) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(p1.sx, p1.sy);
                        this.ctx.lineTo(p2.sx, p2.sy);
                        this.ctx.stroke();
                    }
                }
            }

            // DATA EXTRACTION EFFECT
            if (this.mode === 'locked') {
                this.ctx.strokeStyle = 'rgba(255, 0, 60, 0.4)';
                this.ctx.lineWidth = 2;
                const time = Date.now() / 500;
                for (let i = 0; i < 5; i++) {
                    const offset = (time + i * 0.2) % 1;
                    const r = offset * 200;
                    const alpha = 1 - offset;

                    this.ctx.globalAlpha = alpha;
                    this.ctx.beginPath();
                    this.ctx.arc(this.cx, this.cy, r, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
            }

            // Glitch Effect
            if (Math.random() > 0.97) {
                const sliceH = Math.random() * 50;
                const sliceY = Math.random() * this.canvas.height;
                const offset = (Math.random() - 0.5) * 10;
                try {
                    const imgData = this.ctx.getImageData(0, sliceY, this.canvas.width, sliceH);
                    this.ctx.putImageData(imgData, offset, sliceY);
                } catch (e) { }
            }

            this.animId = requestAnimationFrame(animate);
        };
        animate();
    }

    /* --- LOGIC FLOW --- */
    async start() {
        if (this.isTracing) return;
        this.isTracing = true;

        this.resetUI();

        // 1. Init
        this.setStatus('INITIALIZING', 'scanning');
        this.mode = 'scanning';
        await this.typeLog("Initiating neural handshake...", 100);
        await this.typeLog("Connecting to global node mesh...", 600);

        // 2. Fetch Data
        const data = await this.fetchData();

        await this.wait(500);
        await this.typeLog("Analyzing packet headers...", 300);
        await this.typeLog("Bypassing proxy layer [1/3]...", 400);
        await this.typeLog("Bypassing proxy layer [2/3]...", 400);

        // 3. Threat Detection
        await this.typeLog("Anomaly detected in sector: " + data.countryCode, 'highlight');
        await this.wait(800);

        // 4. Lock Sequence
        await this.typeLog("Triangulating origin...", 500);
        this.setStatus('LOCKING...', 'scanning');

        await this.wait(1500);

        // LOCK!
        this.mode = 'locked';
        this.terminal.classList.add('locked');
        this.setStatus('TARGET LOCKED', 'locked');
        await this.typeLog("HOST IDENTIFIED.", 'danger');

        // 5. Reveal
        this.reveal(data);

        // 6. Post-Lock Monitoring
        await this.wait(1000);
        await this.typeLog("Establishing persistent surveillance...", 500);
        await this.typeLog("Intercepting data packets...", 'highlight');
    }

    async fetchData() {
        try {
            // Client-side fetch. In prod, use a backend proxy if CORS issues arise.
            const req = await fetch('https://ipapi.co/json/');
            const json = await req.json();
            return {
                ip: json.ip,
                loc: `${json.city}, ${json.country_name}`,
                countryCode: json.country_code,
                isp: json.org,
                latency: Math.floor(Math.random() * 30 + 10)
            };
        } catch (e) {
            // Fallback
            return { ip: "192.168.0.X", loc: "Unknown Region", countryCode: "XX", isp: "Encrypted", latency: 1 };
        }
    }

    async typeLog(text, delay = 50, type = '') {
        const div = document.createElement('div');
        div.className = `log-line ${type}`;
        this.consoleEl.appendChild(div);
        this.consoleEl.scrollTop = this.consoleEl.scrollHeight;

        const chars = text.split('');
        for (let c of chars) {
            div.textContent += c;
            await this.wait(Math.random() * 10 + 5);
        }
        if (delay) await this.wait(delay);
    }

    reveal(data) {
        this.isTracing = false;
        this.ipDisplay.textContent = data.ip;
        this.ipDisplay.classList.add('visible');

        document.getElementById('val-loc').innerText = data.loc.toUpperCase();
        document.getElementById('val-isp').innerText = data.isp.toUpperCase();
        document.getElementById('val-lat').innerText = data.latency + "ms";

        this.summaryBox.classList.add('visible');
        this.rerunBtn.classList.add('visible');
    }

    resetUI() {
        this.consoleEl.innerHTML = '';
        this.ipDisplay.classList.remove('visible');
        this.summaryBox.classList.remove('visible');
        this.rerunBtn.classList.remove('visible');
        this.terminal.classList.remove('locked');
        this.mode = 'idle';
        document.getElementById('val-loc').innerText = "--";
    }

    setStatus(text, type) {
        this.statusEl.textContent = text;
        this.statusEl.className = `console-header-status ${type}`;
    }

    wait(ms) { return new Promise(r => setTimeout(r, ms)); }
}