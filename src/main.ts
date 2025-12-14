import './style.css';
import { MapComponent } from './components/MapComponent';
import { WarningFilter } from './components/WarningFilter';
import { RawWarningViewer } from './components/RawWarningViewer';
import { RainViewerService } from './services/RainViewerService';
import { WeatherWarningService, WeatherWarningDecoder } from './services/WeatherWarning';

import { changelogData } from './utils/changelog';

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

// Auto-collapse on mobile
if (window.innerWidth <= 768) {
    aboutPanel?.classList.add('collapsed');
}

// Changelog Modal Logic
const appVersion = document.getElementById('app-version');
const changelogModal = document.getElementById('changelog-modal');
const closeChangelog = document.getElementById('close-changelog');
const changelogList = document.getElementById('changelog-list');

function renderChangelog() {
    if (!changelogList) return;
    changelogList.innerHTML = changelogData.map(entry => `
        <div class="changelog-entry">
            <div class="entry-header">
                <span class="entry-version">${entry.version}</span>
                <span class="entry-date">${entry.date}</span>
            </div>
            <ul class="entry-list">
                ${entry.changes.map(change => `<li>${change}</li>`).join('')}
            </ul>
        </div>
    `).join('');
}

if (appVersion) {
    appVersion.innerText = `${changelogData[0].version}`;
}

appVersion?.addEventListener('click', () => {
    renderChangelog();
    changelogModal?.classList.remove('hidden');
});

closeChangelog?.addEventListener('click', () => {
    changelogModal?.classList.add('hidden');
});

changelogModal?.addEventListener('click', (e) => {
    if (e.target === changelogModal) {
        changelogModal.classList.add('hidden');
    }
});

const locationBtn = document.getElementById('location-btn');
locationBtn?.addEventListener('click', () => {
    mapComponent.showUserLocation();
});


const rainToggleBtn = document.getElementById('rain-toggle-btn');
let rainViewerVisible = true;

rainToggleBtn?.addEventListener('click', () => {
    rainViewerVisible = !rainViewerVisible;
    mapComponent.toggleRainViewerLayer(rainViewerVisible);
    if (rainViewerVisible) {
        rainToggleBtn.classList.add('active');
    } else {
        rainToggleBtn.classList.remove('active');
    }
});

mapComponent.onLoad(async () => {
    // 1. Load Radar
    const data = await RainViewerService.fetchData();
    if (data?.radar?.past?.length) {
        const latestPast = data.radar.past[data.radar.past.length - 1];
        mapComponent.addRainViewerLayer(latestPast.time);
    }
    
    // 2. Load and highlight warnings
    const warningData = await WeatherWarningService.fetchData();
    if (warningData) {
        const decoded = WeatherWarningDecoder.decode(warningData);
        currentWarnings = decoded;
        mapComponent.highlightWarningAreas(decoded);
    }
});