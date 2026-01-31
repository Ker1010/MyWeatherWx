export interface RainViewerData {
    version: string;
    generated: number;
    host: string;
    radar: {
        past: Array<{ time: number; path: string }>;
        nowcast: Array<{ time: number; path: string }>;
    };
}

export class RainViewerService {
    public static colorScheme: number = 2; // Default to 2 (Universal Blue)

    // https://www.rainviewer.com/api/color-schemes.html
    public static readonly COLOR_SCHEMES = [
        { id: 1, name: "Original", colors: ["#d6e2ff", "#b5c9ff", "#8eafff", "#7d96ff", "#6b7dff", "#5662ff", "#2932ff", "#1218bd", "#f7ff00", "#ffc800", "#ff9600", "#ff6400", "#ff0000", "#c80000", "#960000", "#640000"] },
        { id: 2, name: "Universal Blue", colors: ["#d6e2ff", "#b5c9ff", "#8eafff", "#7d96ff", "#6b7dff", "#5662ff", "#2932ff", "#1218bd", "#f7ff00", "#ffc800", "#ff9600", "#ff6400", "#ff0000", "#c80000", "#960000", "#640000"] },
        { id: 3, name: "TITAN", colors: ["#00000000", "#c8c8c8", "#00c8ff", "#0096ff", "#0064ff", "#00ff00", "#00c800", "#009600", "#ffff00", "#ffc800", "#ff9600", "#ff0000", "#c80000", "#960000", "#ff00ff", "#960096"] },
        { id: 4, name: "The Weather Channel", colors: ["#00000000", "#d4f0ff", "#a5d2ff", "#8ebeff", "#6496ff", "#00d28c", "#00a000", "#006400", "#ffff00", "#ffc800", "#ff9600", "#ff0000", "#cd0000", "#9c0000", "#ff00ff", "#9d00b4"] },
        { id: 5, name: "NEXRAD Level-III", colors: ["#00000000", "#00ecec", "#01a0f6", "#0000f6", "#00ff00", "#00c800", "#009000", "#ffff00", "#e7c000", "#ff9000", "#ff0000", "#d60000", "#c00000", "#ff00ff", "#9955c9"] },
        { id: 6, name: "Rainbow @ SELEX-SI", colors: ["#00000000", "#00ffff", "#00a5ff", "#0000ff", "#00ff00", "#00c800", "#009600", "#ffff00", "#ffc800", "#ff9600", "#ff0000", "#c80000", "#960000", "#ff00ff", "#960096"] },
        { id: 7, name: "Dark Sky", colors: ["#00000000", "#c9d2ff", "#94a9ff", "#5e7eff", "#002fff", "#00c400", "#009600", "#006800", "#ffff00", "#e3b800", "#ff7a00", "#f50000", "#b20000", "#840000", "#ff00ff", "#ad00c9"] },
        { id: 8, name: "JMA", colors: ["#f2f2ff", "#a0d2ff", "#218cff", "#0041ff", "#faf500", "#ff9900", "#ff2800", "#b40068"] }
    ];

    private static API_URL = 'https://api.rainviewer.com/public/weather-maps.json';

    static async fetchData(): Promise<RainViewerData | null> {
        try {
            const response = await fetch(this.API_URL);
            if (!response.ok) {
                throw new Error(`RainViewer API error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch RainViewer data:", error);
            return null;
        }
    }

    static getTileUrl(timestamp: number, size: number = 256): string {
        return `https://tilecache.rainviewer.com/v2/radar/${timestamp}/${size}/{z}/{x}/{y}/${this.colorScheme}/1_1.png`;
    }

    private static hexToRgb(hex: string): { r: number, g: number, b: number } | null {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    static getDbz(r: number, g: number, b: number): string | null {
        const scheme: any = this.COLOR_SCHEMES.find(s => s.id === this.colorScheme) || this.COLOR_SCHEMES[0];
        
        let minDist = Infinity;
        let bestIndex = -1;
        
        scheme.colors.forEach((hex: string, index: number) => {
            const target = this.hexToRgb(hex);
            if (!target) return;
            
            const dist = Math.sqrt(
                Math.pow(target.r - r, 2) + 
                Math.pow(target.g - g, 2) + 
                Math.pow(target.b - b, 2)
            );
            
            if (dist < minDist) {
                minDist = dist;
                bestIndex = index;
            }
        });
        
        if (bestIndex === -1) return null;
        
        // Map to dBZ
        if (scheme.dbzValues && scheme.dbzValues[bestIndex] !== undefined) {
            return `${scheme.dbzValues[bestIndex]} dBZ`;
        }
        
        return `${10 + (bestIndex * 5)} dBZ`;
    }
}