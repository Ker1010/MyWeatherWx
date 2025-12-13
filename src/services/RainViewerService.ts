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
        return `https://tilecache.rainviewer.com/v2/radar/${timestamp}/${size}/{z}/{x}/{y}/2/1_1.png`;
    }
}
