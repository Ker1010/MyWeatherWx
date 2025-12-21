export class Snowfall {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private snowflakes: { x: number; y: number; radius: number; speed: number; drift: number }[] = [];
    private animationId: number | null = null;
    private count: number;

    constructor(count: number = 50) {
        this.count = count;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d')!;
        
        // Style the canvas to cover the screen but behave as an overlay
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100vw';
        this.canvas.style.height = '100vh';
        this.canvas.style.pointerEvents = 'none'; // Click-through
        this.canvas.style.zIndex = '9999'; // On top of everything
        this.canvas.id = 'snowfall-canvas';
    }

    private resize = () => {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    private initSnowflakes() {
        this.snowflakes = [];
        for (let i = 0; i < this.count; i++) {
            const flake = this.createSnowflake();
            // Start above the screen so they fall in naturally
            flake.y = -Math.random() * this.canvas.height;
            this.snowflakes.push(flake);
        }
    }

    private createSnowflake() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            radius: Math.random() * 3 + 1, // 1px to 4px
            speed: Math.random() * 2 + 0.5, // 0.5 to 2.5
            drift: Math.random() * 1 - 0.5 // -0.5 to 0.5
        };
    }

    private update = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.beginPath();

        for (const flake of this.snowflakes) {
            this.ctx.moveTo(flake.x, flake.y);
            this.ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);

            flake.y += flake.speed;
            flake.x += flake.drift;

            // Reset if out of view
            if (flake.y > this.canvas.height) {
                flake.y = -5;
                flake.x = Math.random() * this.canvas.width;
            }
            if (flake.x > this.canvas.width) {
                 flake.x = 0;
            } else if (flake.x < 0) {
                flake.x = this.canvas.width;
            }
        }

        this.ctx.fill();
        this.animationId = requestAnimationFrame(this.update);
    }

    public start() {
        if (this.animationId) return; // Already running

        document.body.appendChild(this.canvas);
        window.addEventListener('resize', this.resize);
        this.resize();
        this.initSnowflakes();
        this.update();
    }

    public stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        window.removeEventListener('resize', this.resize);
        if (this.canvas.parentNode) {
            document.body.removeChild(this.canvas);
        }
    }
}
