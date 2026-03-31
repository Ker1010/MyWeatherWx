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
        { id: 2, name: "Universal Blue", colors: ["#d6e2ff", "#b5c9ff", "#8eafff", "#7d96ff", "#6b7dff", "#5662ff", "#2932ff", "#1218bd", "#f7ff00", "#ffc800", "#ff9600", "#ff6400", "#ff0000", "#c80000", "#960000", "#640000"] },
    ];

    private static API_URL = 'https://api.rainviewer.com/public/weather-maps.json';
    private static timeToPathMap = new Map<number, string>();

    static async fetchData(): Promise<RainViewerData | null> {
        try {
            const response = await fetch(this.API_URL);
            if (!response.ok) {
                throw new Error(`RainViewer API error: ${response.status}`);
            }
            const data = await response.json();
            
            // Map the parsed time to the newer path hashes
            if (data?.radar?.past) {
                data.radar.past.forEach((f: any) => this.timeToPathMap.set(f.time, f.path));
            }
            if (data?.radar?.nowcast) {
                data.radar.nowcast.forEach((f: any) => this.timeToPathMap.set(f.time, f.path));
            }
            
            return data;
        } catch (error) {
            console.error("Failed to fetch RainViewer data:", error);
            return null;
        }
    }

    static getTileUrl(timestamp: number, size: number = 256): string {
        const path = this.timeToPathMap.get(timestamp);
        if (path) {
            return `https://tilecache.rainviewer.com${path}/${size}/{z}/{x}/{y}/${this.colorScheme}/1_1.png`;
        }
        // Fallback for older timestamps if missing from current dataset
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