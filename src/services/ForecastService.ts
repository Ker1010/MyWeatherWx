export interface ForecastLocation {
    location_id: string;
    location_name: string;
}

export interface ForecastData {
    location: ForecastLocation;
    date: string;
    morning_forecast: string;
    afternoon_forecast: string;
    night_forecast: string;
    summary_forecast: string;
    summary_when: string;
    min_temp: number;
    max_temp: number;
}

export class ForecastService {
    private static API_URL = "https://api.data.gov.my/weather/forecast";

    static async fetchData(): Promise<ForecastData[] | null> {
        try {
            const response = await fetch(this.API_URL);
            if (!response.ok) {
                throw new Error(`Forecast API error: ${response.status}`);
            }
            const data = await response.json();
            
            return data;
        } catch (error) {
            console.error("Failed to fetch Forecast data:", error);
            return null;
        }
    }

    static filterForecastsForDate(forecasts: ForecastData[], date: Date): ForecastData[] {
        const dateStr = date.toISOString().split('T')[0];
        return forecasts.filter(f => f.date === dateStr);
    }
}
