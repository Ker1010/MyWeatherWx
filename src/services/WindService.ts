export interface WindData {
    latitude: number;
    longitude: number;
    windDirection: number;
    windSpeed: number;
    name: string;
}

export class WindService {
    private static readonly STEP = 0.75; // degrees, ~83km spacing

    private static readonly BOUNDS = [
        { id: "PM", latMin: 1.2,  latMax: 7.3,  lonMin: 99.6,  lonMax: 104.5 }, // Peninsular
        { id: "EM", latMin: 0.8,  latMax: 7.8,  lonMin: 109.5, lonMax: 119.3 }, // Sabah + Sarawak
    ];

    private static generateGrid() {
        const points: { lat: number; lon: number; name: string }[] = [];
        for (const b of this.BOUNDS) {
            for (let lat = b.latMin; lat <= b.latMax + 1e-9; lat += this.STEP) {
                for (let lon = b.lonMin; lon <= b.lonMax + 1e-9; lon += this.STEP) {
                    const la = +lat.toFixed(3);
                    const lo = +lon.toFixed(3);
                    points.push({ lat: la, lon: lo, name: `${b.id} ${la},${lo}` });
                }
            }
        }
        return points;
    }

    static async fetchWindData(): Promise<WindData[] | null> {
        try {
            const locations = this.generateGrid();
            const lats = locations.map(l => l.lat).join(",");
            const lons = locations.map(l => l.lon).join(",");

            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=wind_speed_10m,wind_direction_10m`;

            const response = await fetch(url);
            if (!response.ok) throw new Error(`Open-Meteo API error: ${response.status}`);

            const data = await response.json();
            const results = Array.isArray(data) ? data : [data];

            return results.map((res: any, i: number) => ({
                latitude: res.latitude,
                longitude: res.longitude,
                windDirection: res.current.wind_direction_10m,
                windSpeed: res.current.wind_speed_10m,
                name: locations[i].name,
            }));
        } catch (error) {
            console.error("Failed to fetch Wind data:", error);
            return null;
        }
    }
}