<p align="center">
  <img src="public/MyWeatherWx.png" alt="MyWeatherWX Logo" width="120" />
</p>

<h1 align="center">MyWeatherWX</h1>

<p align="center">
  <strong>Real-time weather radar, lightning tracking, and warning system for Malaysia</strong>
</p>

<p align="center">
  <a href="https://mywx.kerserver.org">🌐 Live App</a> &nbsp;·&nbsp;
  <a href="#features">✨ Features</a> &nbsp;·&nbsp;
  <a href="#tech-stack">🛠️ Tech Stack</a> &nbsp;·&nbsp;
  <a href="#getting-started">🚀 Getting Started</a>
</p>

---

## About

**MyWeatherWX** is a free, open-source web application that provides real-time weather monitoring for Malaysia. It combines rain radar imagery, live lightning detection, official MetMalaysia weather warnings, and regional forecasts — all displayed on an interactive dark-themed map.

> **Disclaimer:** This is not an official government service. Data comes from third-party open sources and may be inaccurate or delayed. Do not use for safety-critical decisions.

## Features

### 🌧️ Rain Radar
- Real-time rain radar overlay powered by **RainViewer API**
- Timeline playback with play/pause controls and scrubber slider
- "Now" button to snap back to the latest frame
- Toggle radar layer on/off
- Auto-refreshes every 5 minutes

### ⚡ Live Lightning Detection
- Real-time lightning strike visualization via **Blitzortung** WebSocket
- Filtered to the Malaysia region (Peninsular & East Malaysia)
- Animated strike markers on the map

### ⚠️ Weather Warnings
- Live weather warnings from **MetMalaysia** (data.gov.my API)
- Categorized warnings: Strong Wind/Rough Sea, Continuous Rain, Thunderstorm Warning/Watch, Tropical Cyclone, and more
- Highlighted warning areas on the map with GeoJSON region boundaries
- Filterable by warning category via side panel
- Raw warning data viewer
- Auto-refreshes every 3 minutes

### 🌤️ Weather Forecast
- Daily forecasts from **MetMalaysia** (data.gov.my API)
- Morning, afternoon, and night breakdown per region
- Temperature range display
- Toggle between warning view and forecast view

### 🗺️ Interactive Map
- Built with **MapLibre GL JS** for smooth, vector-based mapping
- Glassmorphism-styled dark UI panels
- User geolocation ("Show My Location")
- Drawing tool — freehand annotations on the map
- Probe tool — inspect radar pixel color/dBZ values (desktop)

### 🌐 Multi-Language Support
- English, Bahasa Melayu, and Chinese (中文)
- Language preference saved in `localStorage`

### 📱 Progressive Web App
- Installable on mobile and desktop
- Standalone display mode
- Responsive design for all screen sizes

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Vite](https://vitejs.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Map** | [MapLibre GL JS](https://maplibre.org/) |
| **Styling** | Vanilla CSS + [Bootstrap 5](https://getbootstrap.com/) + [Bootstrap Icons](https://icons.getbootstrap.com/) |
| **Lightning** | [Blitzortung](https://www.blitzortung.org/) (WebSocket) |
| **Rain Radar** | [RainViewer API](https://www.rainviewer.com/api.html) |
| **Warnings & Forecasts** | [data.gov.my](https://developer.data.gov.my/) (MetMalaysia) |
| **GeoJSON** | [jakim.geojson](https://github.com/mptwaktusolat/jakim.geojson/) + Natural Earth |

## Data Sources

| Source | Usage |
|---|---|
| [MetMalaysia](https://www.met.gov.my/) | Weather warnings & forecasts |
| [RainViewer](https://www.rainviewer.com/) | Radar tile imagery |
| [Blitzortung](https://www.blitzortung.org/) | Real-time lightning data |
| [data.gov.my](https://developer.data.gov.my/) | Malaysian open data API |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/Ker1010/MyWeatherWx.git
cd MyWeatherWx

# Install dependencies
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```
MyWeatherWx/
├── index.html                     # Main HTML entry
├── public/
│   ├── MyWeatherWx.png            # App icon
│   ├── malaysia.geojson           # State boundaries
│   ├── malaysia_detail.geojson    # Detailed region boundaries
│   ├── ne_50.geojson              # Natural Earth base data
│   ├── region_mapping.json        # Warning-to-region mapping
│   ├── manifest.json              # PWA manifest
│   └── sitemap.xml
├── src/
│   ├── main.ts                    # App entry point
│   ├── style.css                  # Global styles
│   ├── components/
│   │   ├── MapComponent.ts        # Core map logic & rendering
│   │   ├── WarningFilter.ts       # Side panel with filters & forecast tabs
│   │   └── RawWarningViewer.ts    # Raw warning data modal
│   ├── services/
│   │   ├── RainViewerService.ts   # RainViewer API client
│   │   ├── LightningService.ts    # Blitzortung WebSocket client
│   │   ├── WeatherWarning.ts      # MetMalaysia warning decoder
│   │   ├── ForecastService.ts     # MetMalaysia forecast client
│   │   └── LanguageService.ts     # i18n singleton
│   ├── i18n/
│   │   └── translations.json      # EN / BM / CN translations
│   └── utils/
│       ├── changelog.ts           # Version history data
│       └── Snowfall.ts            # December holiday easter egg 🎄
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## FAQ

**Will official meteorological radar data be available?**
> No. Refer to the [MET Malaysia FAQ](https://www.met.gov.my/en/info/soalan-lazim) for details.

**Why are some warning area mappings missing?**
> Government warning data is text-only. Region boundaries are manually mapped from descriptions, which may cause slight mismatches.

**Why RainViewer instead of Windy?**
> RainViewer provides a free API for radar tile overlays. Windy does not offer the specific map overlays needed for this project.

## Author

Developed by **[Ker](https://www.kerserver.org)**

© 2025–2026 MyWeatherWX
