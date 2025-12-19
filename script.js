/**
 * Arabic Letter Tracing Application
 * Main JavaScript Engine
 * 
 * This application provides an interactive canvas for children to practice
 * tracing Arabic letters with real-time feedback and progress tracking.
 */

// ========================================
// LETTER TRACING ENGINE
// ========================================

class LetterTracingEngine {
    constructor(canvasElement, lettersData, settings = {}) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.lettersData = lettersData;
        this.settings = {
            sensitivity: 5,
            audioEnabled: true,
            dotGuidesEnabled: true,
            highContrast: false,
            ... settings
        };

        // State management
        this.currentLetter = null;
        this.isDrawing = false;
        this. userPath = [];
        this.tracedPixels = new Set();
        this.pathPixels = new Set();
        this.completionPercentage = 0;
        this.startTime = null;
        this. hintShown = false;

        // Bindings
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);

        this.init();
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas. addEventListener('mousemove', this. handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);

        this.canvas.addEventListener('touchstart', this.handleTouchStart);
        this.canvas.addEventListener('touchmove', this.handleTouchMove);
        this.canvas.addEventListener('touchend', this.handleTouchEnd);

        // Prevent scroll on touch
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        this.setupCanvasSize();
        window.addEventListener('resize', () => this.setupCanvasSize());
    }

    setupCanvasSize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect. height * dpr;

        this.ctx.scale(dpr, dpr);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (this.currentLetter) {
            this. render();
        }
    }

    loadLetter(letterId) {
        const letterData = this.lettersData. find(l => l.id === letterId);
        if (!letterData) {
            console.error(`Letter ${letterId} not found`);
            return false;
        }

        this. currentLetter = letterData;
        this.userPath = [];
        this.tracedPixels = new Set();
        this.pathPixels = new Set();
        this.completionPercentage = 0;
        this.startTime = Date.now();
        this.hintShown = false;

        this.parseLetterPath();
        this.render();

        return true;
    }

    parseLetterPath() {
        // Parse SVG path data into coordinates
        this.letterPathCoords = this.svgPathToCoords(this.currentLetter.svgPath);
    }

    svgPathToCoords(pathData) {
        // Simple SVG path parser for M (move) and L (line) commands
        const coords = [];
        const commands = pathData.match(/[MLCQmlcq][^MLCQmlcq]*/g) || [];

        let currentPos = { x: 0, y: 0 };

        commands.forEach(cmd => {
            const type = cmd[0];
            const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

            if (type === 'M' || type === 'm') {
                currentPos = {
                    x: type === 'M' ? args[0] : currentPos.x + args[0],
                    y: type === 'M' ?  args[1] : currentPos. y + args[1]
                };
                coords.push({ ... currentPos, isStart: true });
            } else if (type === 'L' || type === 'l') {
                for (let i = 0; i < args.length; i += 2) {
                    currentPos = {
                        x: type === 'L' ? args[i] : currentPos.x + args[i],
                        y: type === 'L' ?  args[i + 1] :  currentPos.y + args[i + 1]
                    };
                    coords.push({ ... currentPos });
                }
            } else if (type === 'C' || type === 'c') {
                // Quadratic bezier approximation (simplified)
                for (let i = 0; i < args.length; i += 6) {
                    const cp1x = type === 'C' ? args[i] : currentPos.x + args[i];
                    const cp1y = type === 'C' ? args[i + 1] : currentPos.y + args[i + 1];
                    const cp2x = type === 'C' ? args[i + 2] : currentPos.x + args[i + 2];
                    const cp2y = type === 'C' ? args[i + 3] : currentPos.y + args[i + 3];
                    const x = type === 'C' ? args[i + 4] : currentPos.x + args[i + 4];
                    const y = type === 'C' ? args[i + 5] : currentPos.y + args[i + 5];

                    // Generate points along bezier curve
                    for (let t = 0; t <= 1; t += 0.02) {
                        const bx = this.bezierPoint(currentPos. x, cp1x, cp2x, x, t);
                        const by = this.bezierPoint(currentPos. y, cp1y, cp2y, y, t);
                        coords.push({ x: bx, y: by });
                    }
                    currentPos = { x, y };
                }
            }
        });

        return coords;
    }

    bezierPoint(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        return mt * mt * mt * p0 +
               3 * mt * mt * t * p1 +
               3 * mt * t * t * p2 +
               t * t * t * p3;
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (e.clientX - rect.left) * (this.canvas.width / (rect.width * dpr));
        const y = (e.clientY - rect.top) * (this.canvas.height / (rect.height * dpr));

        this.startStroke(x, y);
    }

    handleMouseMove(e) {
        if (!this.isDrawing) return;

        const rect = this. canvas.getBoundingClientRect();
        const dpr = window. devicePixelRatio || 1;
        const x = (e.clientX - rect.left) * (this.canvas.width / (rect.width * dpr));
        const y = (e. clientY - rect.top) * (this.canvas.height / (rect.height * dpr));

        this.continueStroke(x, y);
    }

    handleMouseUp() {
        this.endStroke();
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (touch. clientX - rect.left) * (this.canvas.width / (rect.width * dpr));
        const y = (touch.clientY - rect.top) * (this.canvas.height / (rect.height * dpr));

        this.startStroke(x, y);
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (!this.isDrawing) return;

        const touch = e. touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (touch.clientX - rect.left) * (this.canvas.width / (rect.width * dpr));
        const y = (touch.clientY - rect. top) * (this.canvas.height / (rect.height * dpr));

        this.continueStroke(x, y);
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.endStroke();
    }

    startStroke(x, y) {
        this.isDrawing = true;
        this.userPath = [{ x, y }];
        this.render();
    }

    continueStroke(x, y) {
        if (!this.isDrawing) return;

        this.userPath.push({ x, y });
        this.updateTracedPixels();
        this.updateCompletion();
        this.render();
    }

    endStroke() {
        this.isDrawing = false;
        this.render();
    }

    updateTracedPixels() {
        const tolerance = (11 - this.settings.sensitivity) * 2;

        this.letterPathCoords.forEach((pathPoint, index) => {
            this.userPath. forEach(userPoint => {
                const distance = Math.hypot(
                    pathPoint.x - userPoint.x,
                    pathPoint.y - userPoint.y
                );

                if (distance < tolerance) {
                    this.tracedPixels.add(index);
                }
            });
        });
    }

    updateCompletion() {
        if (this.letterPathCoords.length === 0) {
            this.completionPercentage = 0;
            return;
        }

        this.completionPercentage = Math.round(
            (this. tracedPixels.size / this. letterPathCoords.length) * 100
        );
    }

    getCompletion() {
        return this.completionPercentage;
    }

    isLetterComplete() {
        return this.completionPercentage >= 85;
    }

    getAccuracy() {
        // Count correctly traced pixels vs incorrectly traced pixels
        if (this.userPath.length === 0) return 0;
        return this.completionPercentage;
    }

    showHint() {
        this.hintShown = true;
        this.render();
    }

    resetCanvas() {
        this.userPath = [];
        this.tracedPixels = new Set();
        this.completionPercentage = 0;
        this.hintShown = false;
        this.render();
    }

    render() {
        // Clear canvas
        this.ctx. clearRect(0, 0, this.canvas.width, this. canvas.height);

        if (!this.currentLetter) return;

        // Draw guide dots
        if (this.settings.dotGuidesEnabled) {
            this. drawGuideDots();
        }

        // Draw letter path (faint)
        this.drawLetterPath();

        // Draw user path
        this.drawUserPath();

        // Draw direction arrow
        if (this.userPath.length === 0 && ! this.hintShown) {
            this.drawDirectionIndicator();
        }

        // Draw hint if active
        if (this.hintShown) {
            this. drawHint();
        }
    }

    drawGuideDots() {
        if (!this.currentLetter. guideDots) return;

        this.ctx.fillStyle = '#cbd5e0';
        this.ctx.globalAlpha = 0.5;

        this.currentLetter.guideDots.forEach(dot => {
            this.ctx.beginPath();
            this.ctx.arc(dot.x, dot.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });

        this.ctx.globalAlpha = 1;
    }

    drawLetterPath() {
        this.ctx.strokeStyle = '#e2e8f0';
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = 0.3;

        const path = new Path2D(this.currentLetter.svgPath);
        this.ctx.stroke(path);

        this.ctx.globalAlpha = 1;
    }

    drawUserPath() {
        if (this.userPath.length < 2) return;

        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 6;
        this.ctx.globalAlpha = 0.8;

        this.ctx.beginPath();
        this.ctx.moveTo(this.userPath[0].x, this.userPath[0].y);

        for (let i = 1; i < this.userPath.length; i++) {
            this. ctx.lineTo(this.userPath[i].x, this. userPath[i].y);
        }

        this.ctx. stroke();
        this.ctx.globalAlpha = 1;

        // Draw end circle
        const lastPoint = this.userPath[this.userPath.length - 1];
        this.ctx.fillStyle = '#667eea';
        this.ctx.beginPath();
        this.ctx.arc(lastPoint.x, lastPoint. y, 8, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawDirectionIndicator() {
        if (!this.currentLetter.startPoint) return;

        const start = this.currentLetter.startPoint;
        const size = 20;

        // Draw arrow
        this.ctx. strokeStyle = '#f6ad55';
        this.ctx. fillStyle = '#f6ad55';
        this.ctx.lineWidth = 2;

        // Arrow shaft
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start. y - size);
        this.ctx.lineTo(start.x, start. y + size);
        this.ctx.stroke();

        // Arrow head
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y + size);
        this.ctx.lineTo(start.x - 8, start.y + size - 10);
        this.ctx.lineTo(start.x + 8, start.y + size - 10);
        this.ctx.closePath();
        this.ctx.fill();

        // Start circle
        this.ctx.strokeStyle = '#f6ad55';
        this.ctx.beginPath();
        this.ctx.arc(start.x, start.y - size - 10, 6, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    drawHint() {
        this.ctx.strokeStyle = '#48bb78';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.globalAlpha = 0.6;

        const path = new Path2D(this. currentLetter.svgPath);
        this.ctx.stroke(path);

        this.ctx. setLineDash([]);
        this.ctx.globalAlpha = 1;
    }

    destroy() {
        this.canvas. removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this. handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);

        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this. handleTouchEnd);
    }
}

// ========================================
// PROGRESS TRACKER
// ========================================

class ProgressTracker {
    constructor() {
        this.storageKey = 'arabicLetterTracingProgress';
        this.loadProgress();
    }

    loadProgress() {
        try {
            const data = localStorage.getItem(this. storageKey);
            this.progress = data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Error loading progress:', error);
            this.progress = {};
        }
    }

    saveProgress() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.progress));
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }

    recordAttempt(letterId, accuracy, timeTaken) {
        if (!this.progress[letterId]) {
            this.progress[letterId] = {
                attempts: [],
                bestAccuracy: 0,
                mastered: false,
                firstAttemptDate: new Date().toISOString()
            };
        }

        this.progress[letterId].attempts. push({
            accuracy,
            timeTaken,
            date:  new Date().toISOString()
        });

        // Update best accuracy
        if (accuracy > this.progress[letterId].bestAccuracy) {
            this. progress[letterId].bestAccuracy = accuracy;
        }

        // Check for mastery (3 consecutive attempts >= 90%)
        const recentAttempts = this.progress[letterId].attempts.slice(-3);
        if (recentAttempts.length >= 3 && recentAttempts.every(a => a.accuracy >= 90)) {
            this.progress[letterId].mastered = true;
        }

        this.saveProgress();
    }

    getLetterProgress(letterId) {
        return this.progress[letterId] || null;
    }

    getAllProgress() {
        return this.progress;
    }

    getStatistics() {
        const allAttempts = [];
        const allLetters = Object.keys(this.progress);

        allLetters.forEach(letterId => {
            const letterData = this.progress[letterId];
            letterData.attempts.forEach(attempt => {
                allAttempts. push({
                    ... attempt,
                    letterId
                });
            });
        });

        const avgAccuracy = allAttempts. length > 
