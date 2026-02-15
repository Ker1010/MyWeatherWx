import './style.css';
import { MapComponent } from './components/MapComponent';
import { WarningFilter } from './components/WarningFilter';
import { RawWarningViewer } from './components/RawWarningViewer';
import { RainViewerService } from './services/RainViewerService';
import { WeatherWarningService, WeatherWarningDecoder } from './services/WeatherWarning';
import { ForecastService } from './services/ForecastService';

import { changelogData } from './utils/changelog';
import { LanguageService } from './services/LanguageService';
import { Snowfall } from './utils/Snowfall';

// import { RainLegend } from './components/RainLegend';

const mapComponent = new MapComponent('map');
const rawWarningViewer = new RawWarningViewer();




let currentWarnings: any[] = [];

// Configuration for Default Active Filters
// Pass specific category IDs to active them by default, or leave undefined to active all
// Available IDs: 
// 'first', 'second', 'third' (Strong Wind/Rough Sea)
// 'thunderstorm_warning', 'thunderstorm_watch'
// 'continuous_rain', 'sea_level', 'tropical_cyclone', 'alert'
const DEFAULT_ACTIVE_WARNINGS: string[] = ['continuous_rain', 'alert', 'thunderstorm_warning'];

// WarningFilter initialization moved to map.load to handle forecast dependencies


// About Panel Toggle
const aboutToggle = document.getElementById('about-toggle');
const aboutPanel = document.querySelector('.about-panel');

// Initialize Snowfall
const snowfall = new Snowfall();
const isDecember = new Date().getMonth() === 11;

aboutToggle?.addEventListener('click', () => {
    aboutPanel?.classList.toggle('collapsed');
    
    // Check if panel is currently open (not collapsed)
    const isOpen = !aboutPanel?.classList.contains('collapsed');
    
    if (isDecember) {
        if (isOpen) {
            snowfall.start();
        } else {
            snowfall.stop();
        }
    }
});

function updateAboutPanel() {
    const t = (key: string) => languageService.translate(key);

    const desc = document.querySelector('.app-desc');
    if (desc) desc.textContent = t('app_description');

    const sourcesLabel = document.querySelector('.source-section label');
    if (sourcesLabel) sourcesLabel.textContent = t('data_sources');

    const faqItems = document.querySelectorAll('.faq-item');
    if (faqItems.length >= 3) {
        // Safe access by index assuming structure matches
        const q1 = faqItems[0].querySelector('summary');
        const a1 = faqItems[0].querySelector('span');
        if (q1) q1.textContent = t('faq_title_level3');
        // A1 contains HTML (link), so we need to be careful not to destroy it, or we just rewrite innerHTML
        if (a1) a1.innerHTML = t('faq_tldr_level3').replace('MET Malaysia FAQ', '<a href="https://www.met.gov.my/en/info/soalan-lazim" target="_blank" rel="noopener noreferrer">MET Malaysia FAQ</a>');

        const q2 = faqItems[1].querySelector('summary');
        const a2 = faqItems[1].querySelector('p');
        if (q2) q2.textContent = t('faq_title_mappings');
        if (a2) a2.textContent = t('faq_text_mappings');

        const q3 = faqItems[2].querySelector('summary');
        const a3 = faqItems[2].querySelector('p');
        if (q3) q3.textContent = t('faq_title_rainviewer');
        if (a3) a3.textContent = t('faq_text_rainviewer');
    }

    const disclaimerBox = document.querySelector('.disclaimer-box p');
    if (disclaimerBox) {
        disclaimerBox.innerHTML = `<strong>${t('disclaimer_title')}</strong> ${t('disclaimer_text')}`;
    }

    const dev = document.querySelector('.developer');
    if (dev) {
        dev.innerHTML = `${t('developed_by')} <a href="https://www.kerserver.org" target="_blank" rel="noopener noreferrer">Ker</a>.`;
    }
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

const playbackSlider = document.getElementById('playback-slider') as HTMLInputElement;
const playPauseBtn = document.getElementById('play-pause-btn');
const playbackTimeDisplay = document.getElementById('playback-time');
const playIcon = '<i class="bi bi-play-fill"></i>';
const pauseIcon = '<i class="bi bi-pause-fill"></i>';

let availableTimestamps: number[] = [];
let isPlaying = false;
let playbackInterval: any;
let currentIndex = 0;

function formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function updatePlaybackState(index: number) {
    if (!availableTimestamps.length) return;
    
    // Ensure index is valid
    index = Math.max(0, Math.min(index, availableTimestamps.length - 1));
    currentIndex = index;
    
    const timestamp = availableTimestamps[index];
    
    // Update Slider
    if (playbackSlider) {
        playbackSlider.value = index.toString();
        // Update background gradient to show progress if desired, or just standard slider
    }
    
    // Update Time Display
    if (playbackTimeDisplay) {
        playbackTimeDisplay.innerText = formatTime(timestamp);
    }
    
    // Update Map
    mapComponent.setDisplayTime(timestamp);
}

function togglePlay() {
    isPlaying = !isPlaying;
    
    if (playPauseBtn) {
        playPauseBtn.innerHTML = isPlaying ? pauseIcon : playIcon;
    }
    
    if (isPlaying) {
        playbackInterval = setInterval(() => {
            let nextIndex = currentIndex + 1;
            if (nextIndex >= availableTimestamps.length) {
                nextIndex = 0; // Loop back to start
            }
            updatePlaybackState(nextIndex);
        }, 1000); // 1 second per frame
    } else {
        clearInterval(playbackInterval);
    }
}

if (playPauseBtn) {
    playPauseBtn.addEventListener('click', togglePlay);
}

let debounceTimer: any;

if (playbackSlider) {
    playbackSlider.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const index = parseInt(target.value);
        
        // Update UI immediately for responsiveness
        if (availableTimestamps.length > index) {
            const timestamp = availableTimestamps[index];
            if (playbackTimeDisplay) {
                playbackTimeDisplay.innerText = formatTime(timestamp);
            }
        }
        
        // Debounce map update
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updatePlaybackState(index);
        }, 300); // Wait 300ms before reloading map tiles

        // Pause if user interacts
        if (isPlaying) {
            togglePlay();
        }
    });
}

const nowBtn = document.getElementById('now-btn');
if (nowBtn) {
    nowBtn.addEventListener('click', () => {
        // Find the "Now" index (last timestamp <= Date.now() / 1000)
        // Or essentially the logic used for initial load: last PAST frame.
        // We can just find the timestamp that matches MapComponent.latestRadarTimestamp if we had access,
        // or re-calculate.
        const nowSec = Date.now() / 1000;
        let nowIndex = availableTimestamps.length - 1;
        
        // Find last index that is <= nowSec (ignoring Nowcast for "NOW" button ideally, or just last frame?)
        // User said "show the last one own data" for future. So "NOW" probably means "Current Real Time".
        
        for (let i = availableTimestamps.length - 1; i >= 0; i--) {
            if (availableTimestamps[i] <= nowSec) {
                nowIndex = i;
                break;
            }
        }
        
        updatePlaybackState(nowIndex);
        if (isPlaying) togglePlay(); // Stop playing if they click Now
    });
}

const drawBtn = document.getElementById('draw-btn');
const probeBtn = document.getElementById('probe-btn');

let isDrawingEnabled = false;
let isProbeEnabled = false;

if (drawBtn) {
    drawBtn.addEventListener('click', () => {
        isDrawingEnabled = !isDrawingEnabled;
        mapComponent.toggleDrawingMode(isDrawingEnabled);
        
        if (isDrawingEnabled) {
            // Disable Probe
            isProbeEnabled = false;
            if (probeBtn) probeBtn.classList.remove('active');

            drawBtn.classList.add('active');
            drawBtn.innerHTML = '<i class="bi bi-eraser-fill"></i>'; 
        } else {
            drawBtn.classList.remove('active');
            drawBtn.innerHTML = '<i class="bi bi-pen-fill"></i>';
            mapComponent.clearDrawings();
        }
    });
}

if (probeBtn) {
    probeBtn.addEventListener('click', () => {
        isProbeEnabled = !isProbeEnabled;
        
        if (isProbeEnabled) {
            // Disable Draw
            isDrawingEnabled = false;
            mapComponent.toggleDrawingMode(false); // Ensure map state is updated explicitly
            
            if (drawBtn) {
                drawBtn.classList.remove('active');
                drawBtn.innerHTML = '<i class="bi bi-pen-fill"></i>';
                // We don't automatically clear drawings when switching to probe,
                // allowing user to probe while drawings exist.
            }
        }

        mapComponent.toggleProbeMode(isProbeEnabled);

        if (isProbeEnabled) {
            probeBtn.classList.add('active');
        } else {
            probeBtn.classList.remove('active');
        }
    });
}

mapComponent.onLoad(async () => {
    const fetchRainViewer = async () => {
        try {
            const data = await RainViewerService.fetchData();
            if (data?.radar?.past?.length || data?.radar?.nowcast?.length) {
                const past = data.radar.past || [];

                
                // Combine and sort timestamps
                // Only use past data for the timeline
                const allFrames = [...past].sort((a, b) => a.time - b.time);
                availableTimestamps = allFrames.map(f => f.time);                
                if (availableTimestamps.length > 0) {
                    // Initialize Slider
                    if (playbackSlider) {
                        playbackSlider.max = (availableTimestamps.length - 1).toString();
                        playbackSlider.disabled = false;
                    }

                    // Start at the latest PAST frame
                    let startIndex = past.length > 0 ? past.length - 1 : availableTimestamps.length - 1;
                    
                    if (past.length > 0) {
                        const latestPastTimestamp = past[past.length - 1].time;
                        mapComponent.setLatestRadarTimestamp(latestPastTimestamp);
                    } else if (availableTimestamps.length > 0) {
                        // Fallback if no past frames?
                        mapComponent.setLatestRadarTimestamp(availableTimestamps[availableTimestamps.length - 1]);
                    }

                    // Initial load - no debounce needed
                    updatePlaybackState(startIndex);
                }
            }
        } catch (err) {
            console.error("RainViewer fetch failed:", err);
            if (playbackTimeDisplay) playbackTimeDisplay.innerText = "Error";
        }
    };
    
    // ... rest of the file
    // run immediately
    await fetchRainViewer();

    // refresh every 5 minutes (standard RainViewer update cycle is ~10 min)
    setInterval(fetchRainViewer, 5 * 60 * 1000);

    // warnings (keep as-is)
    const fetchWarnings = async () => {
        try {
            const warningData = await WeatherWarningService.fetchData();
            if (warningData) {
                const decoded = WeatherWarningDecoder.decode(warningData);
                currentWarnings = decoded;
                mapComponent.highlightWarningAreas(decoded);
            }
        } catch (err) {
            console.error("Warning fetch failed:", err);
        }
    };

    await fetchWarnings();
    setInterval(fetchWarnings, 3 * 60 * 1000); // Poll every 3 minutes

    // forecasts
    let globalForecasts: any[] = [];
    
    const fetchForecasts = async () => {
        try {
            const forecasts = await ForecastService.fetchData();
            if (forecasts) {
               globalForecasts = forecasts;
               // Default: Render nothing until user clicks tab? 
               // Or render warnings as default.
            }
        } catch (err) {
            console.error("Forecast fetch failed:", err);
        }
    };

    await fetchForecasts();
    setInterval(fetchForecasts, 60 * 60 * 1000); // Poll every hour

    // Forecast Selection Handler (Using Side Panel)
    const handleForecastSelection = (dayIndex: number | null) => {
         if (dayIndex === null) {
            // "Warnings" mode
            mapComponent.renderForecast([]); 
            mapComponent.toggleWarnings(true);
            
            // Temporary Hack: Re-set existing warnings if needed, but toggleWarnings(true) should handle visibility
        } else {
            // "Forecast" mode
            if (globalForecasts.length) {
                 const today = new Date();
                 const targetDate = new Date(today);
                 targetDate.setDate(today.getDate() + dayIndex);
                 
                 const year = targetDate.getFullYear();
                 const month = String(targetDate.getMonth() + 1).padStart(2, '0');
                 const day = String(targetDate.getDate()).padStart(2, '0');
                 const dateStr = `${year}-${month}-${day}`;
                 
                 const dayForecasts = globalForecasts.filter(f => f.date === dateStr);
                 mapComponent.renderForecast(dayForecasts);
                 
                 // Hide Warnings
                 mapComponent.toggleWarnings(false); 
            }
        }
    };

    // Instantiate WarningFilter (Side Panel) with Forecast Support
    new WarningFilter(
        (filterState) => {
            mapComponent.setFilter(filterState);
        },
        () => {
            rawWarningViewer.show(currentWarnings);
        },
        handleForecastSelection, // Pass the forecast selection callback
        DEFAULT_ACTIVE_WARNINGS
    );

    // Initialize RainViewer Color Scheme
    const savedScheme = localStorage.getItem('rainviewer_color_scheme');
    if (savedScheme) {
        mapComponent.setRainViewerColorScheme(parseInt(savedScheme));
    }
});


// Initialize Language Service Connection
const languageService = LanguageService.getInstance();
languageService.subscribe((lang) => {
    mapComponent.setLanguage(lang);
    updateAboutPanel();
    
    // Update Playback Controls
    const nowBtn = document.getElementById('now-btn');
    if (nowBtn) {
        nowBtn.textContent = languageService.translate('now');
    }
});

// Set Copyright Year
const copyrightYear = document.getElementById('copyright-year');
if (copyrightYear) {
    copyrightYear.textContent = new Date().getFullYear().toString();
}
