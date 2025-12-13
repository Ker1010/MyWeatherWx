import './style.css';
import { MapComponent } from './components/MapComponent';
import { WarningFilter } from './components/WarningFilter';
import { RawWarningViewer } from './components/RawWarningViewer';
import { RainViewerService } from './services/RainViewerService';
import { WeatherWarningService, WeatherWarningDecoder } from './services/WeatherWarning';

const mapComponent = new MapComponent('map');
const rawWarningViewer = new RawWarningViewer();

let currentWarnings: any[] = [];

// Initialize Filter
new WarningFilter(
    (filterState) => {
        mapComponent.setFilter(filterState);
    },
    () => {
        // Toggle Raw View
        rawWarningViewer.show(currentWarnings);
    }
);

// About Panel Toggle
const aboutToggle = document.getElementById('about-toggle');
const aboutPanel = document.querySelector('.about-panel');

aboutToggle?.addEventListener('click', () => {
    aboutPanel?.classList.toggle('collapsed');
});

mapComponent.onLoad(async () => {
    // 1. Load Radar
    const data = await RainViewerService.fetchData();
    if (data?.radar?.past?.length) {
        const latestPast = data.radar.past[data.radar.past.length - 1];
        mapComponent.addRainViewerLayer(latestPast.time);
    }

    mapComponent.showUserLocation();
    
    // 2. Load and highlight warnings
    const warningData = await WeatherWarningService.fetchData();
    if (warningData) {
        const decoded = WeatherWarningDecoder.decode(warningData);
        currentWarnings = decoded;
        mapComponent.highlightWarningAreas(decoded);
    }
});