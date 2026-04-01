import maplibregl, { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DecodedWarning } from "../services/WeatherWarning";
import type { FilterState } from "./WarningFilter";
import type { LightningStrike } from "../services/LightningService";
import { LightningService } from "../services/LightningService";
import { RainViewerService } from "../services/RainViewerService";
import { LanguageService } from "../services/LanguageService";
import type { Language } from "../services/LanguageService";

interface Particle {
    lng: number;  // was x
    lat: number;  // was y
    age: number;
    maxAge: number;
    speed: number;
}

export class MapComponent {
  private userLocationMarker?: maplibregl.Marker;
  private map: MapLibreMap;
  private animationInterval: any;
  private containerId: string;
  private geojsonFeatures: any[] = [];
  private allWarnings: DecodedWarning[] = [];
  private lightningService: LightningService;
  private currentLanguage: Language = 'en';

  private windCanvas: HTMLCanvasElement | null = null;
  private windCtx: CanvasRenderingContext2D | null = null;
  private windAnimFrame: number | null = null;
  private windField: any[] = [];
  private particles: Particle[] = [];
  private readonly PARTICLE_COUNT = 1000;
  private isMapMoving = false;
  
  // Drawing State
  private isDrawingMode = false;
  private isDrawing = false;
  private drawnFeatures: any[] = [];
  private currentDrawingFeature: any = null;

  private currentFilter: FilterState = {
    categories: new Set([
      "first",
      "second",
      "third",
      "third",
      "thunderstorm_warning",
      "thunderstorm_watch",
      "continuous_rain",
      "sea_level",
      "tropical_cyclone",
      "alert",
    ]),
    status: new Set(["active"]),
  };

  private static REGION_MAPPING: Record<string, string[]> = {};
  private static regionMappingLoaded = false;

  private static BASE_MAP_STYLE: StyleSpecification = {
    version: 8,
    name: "Malaysia with World Background",
    sources: {
      "world-borders": {
        type: "geojson",
        data: "/ne_50.geojson",
      },
      "malaysia-borders": {
        type: "geojson",
        data: "/malaysia.geojson",
      },
      "malaysia-detailed": {
        type: "geojson",
        data: "/malaysia_detail.geojson",
      },
      "esri-dark-base-source": {
        type: "raster",
        tiles: ["https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      },
      "satellite-source": {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri'
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#1f2025" },
      },
      {
        id: "esri-dark-base",
        type: "raster",
        source: "esri-dark-base-source",
        layout: { visibility: "none" }
      },
      {
        id: "satellite-layer",
        type: "raster",
        source: "satellite-source",
        layout: { visibility: "none" }
      },
      {
        id: "world-fill",
        type: "fill",
        source: "world-borders",
        paint: {
          "fill-color": "#2C2D33",
          "fill-opacity": 1,
        },
      },
      {
        id: "malaysia-fill",
        type: "fill",
        source: "malaysia-borders",
        paint: {
          "fill-color": "#3F4045",
          "fill-opacity": 1,
        },
      },
      {
        id: "malaysia-outline",
        type: "line",
        source: "malaysia-borders",
        paint: {
          "line-color": "#a9b4bc",
          "line-width": 1.5,
        },
      },
      {
        id: "malaysia-outline-detailed",
        type: "line",
        source: "malaysia-detailed",
        paint: {
          "line-color": "#6B7C8C",
          "line-width": 1,
          "line-opacity": 0.5,
        },
      },
      {
        id: "malaysia-labels-detailed",
        type: "symbol",
        source: "malaysia-detailed",
        minzoom: 7,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-anchor": "center",
          "text-allow-overlap": false,
          "text-optional": true,
        },
        paint: {
          "text-color": "#a9b4bc",
          "text-halo-color": "#1f2025",
          "text-halo-width": 1.5,
        },
      },
    ],
  };

  constructor(containerId: string) {
    const isMobile =
      window.matchMedia("(max-width: 768px)").matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.containerId = containerId;

    // Load saved view
    const savedView = localStorage.getItem('weather_map_view');
    let center: [number, number] = [109.45, 4.11];
    let zoom = isMobile ? 3.5 : 5.5;

    if (savedView) {
        try {
            const parsed = JSON.parse(savedView);
            if (parsed.center && parsed.zoom) {
                center = parsed.center;
                zoom = parsed.zoom;
            }
        } catch (e) {
            console.error("Failed to parse saved map view", e);
        }
    }

    this.map = new maplibregl.Map({
      container: this.containerId,
      style: MapComponent.BASE_MAP_STYLE,
      center: center,
      maxZoom: 8,
      zoom: zoom,
      attributionControl: false,
    });

    this.map.on('moveend', () => {
        const center = this.map.getCenter();
        const zoom = this.map.getZoom();
        localStorage.setItem('weather_map_view', JSON.stringify({
            center: [center.lng, center.lat],
            zoom: zoom
        }));
    });

    this.lightningService = new LightningService();
    this.lightningService.connect();
    
    // Initial language
    this.currentLanguage = LanguageService.getInstance().getLanguage();
  }

  public onLoad(callback: () => void) {
    this.map.on("load", async () => {
      try {
        // Load malaysia detail geojson
        const res = await fetch("/malaysia_detail.geojson");
        if (res.ok) {
          const data = await res.json();
          this.geojsonFeatures = data.features || [];
          console.log(`Loaded ${this.geojsonFeatures.length} features`);
        }

        // Load region mapping if not already loaded
        if (!MapComponent.regionMappingLoaded) {
          const mappingRes = await fetch("/region_mapping.json");
          if (mappingRes.ok) {
            MapComponent.REGION_MAPPING = await mappingRes.json();
            MapComponent.regionMappingLoaded = true;
            console.log("Region mapping loaded");
          }
        }
      } catch (e) {
        console.error("Failed to load data", e);
      }

      this.initializeWarningLayers();
      this.map.resize();

      // Register lightning callback AFTER map is fully loaded
      this.lightningService.onStrikesUpdate((strikes) => {
        this.updateLightningLayer(strikes);
      });

      // 2. Start the visual fading animation loop
      this.startLightningAnimation();

      this.initializeWindLayer();

      callback();
    });
  }

  private initializeWarningLayers() {
    if (this.map.getSource("warnings-source")) return;

    // Warning source
    this.map.addSource("warnings-source", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    // Warning fill layer
    this.map.addLayer(
      {
        id: "warnings-fill",
        type: "fill",
        source: "warnings-source",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.4,
        },
      },
      "malaysia-outline"
    );

    // Warning line layer
    this.map.addLayer(
      {
        id: "warnings-line",
        type: "line",
        source: "warnings-source",
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["get", "strokeWeight"],
          "line-opacity": 0.9,
        },
      },
      "malaysia-outline"
    );

    // Initialize lightning source and layer
    if (!this.map.getSource("lightning-source")) {
      this.map.addSource("lightning-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      this.map.addLayer({
        id: "lightning-layer",
        type: "circle",
        source: "lightning-source",
        paint: {
          "circle-radius": 4,
          "circle-color": "#FFFFFF",
          "circle-stroke-color": "#FFEB3B",
          "circle-stroke-width": 2,
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["get", "time"],
            Date.now() - 60000, 0,
            Date.now(), 1
          ],
        },
        layout: {
          visibility: "visible",
        },
      });
    }

    // Initialize Drawing Source/Layer
    if (!this.map.getSource("drawn-source")) {
        this.map.addSource("drawn-source", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: []
            }
        });

        this.map.addLayer({
            id: "drawn-lines",
            type: "line",
            source: "drawn-source",
            layout: {
                "line-join": "round",
                "line-cap": "round"
            },
            paint: {
                "line-color": "#ff0",
                "line-width": 3
            }
        });
    }
    
    // Bind drawing events
    this.map.on('mousedown', this.onMouseDown.bind(this));
    this.map.on('mousemove', this.onMouseMove.bind(this));
    this.map.on('mouseup', this.onMouseUp.bind(this));
    this.map.on('touchstart', (e) => this.onMouseDown({ ...e, lngLat: e.lngLat } as any)); // Basic touch support conversion
    this.map.on('touchmove', (e) => this.onMouseMove({ ...e, lngLat: e.lngLat } as any));
    this.map.on('touchend', this.onMouseUp.bind(this));

    // Interaction for warnings
    this.map.on("click", "warnings-fill", (e) => {
      if (!e.features || !e.features.length) return;

      const feature = e.features[0];
      const props = feature.properties;
      if (!props) return;

      const color = props.color;
      const lang = this.currentLanguage;
      
      // Fallback to EN if CN (since API only has EN/BM for now)
      // If we had Heading_CN, we would use it.
      const heading = lang === 'bm' ? props.heading_bm : props.heading_en;
      const text = lang === 'bm' ? props.text_bm : props.text_en;
      const instruction = lang === 'bm' ? props.instruction_bm : props.instruction_en;
      
      const t = (key: string) => LanguageService.getInstance().translate(key);
      
      const issueLabel = t('issue');
      const expireLabel = t('expires');
      const copyTextLabel = t('copy_text');
      const validLabel = t('valid_from');
      const untilLabel = t('until');


      const popupContent = `
                <div class="warning-glass-panel p-2" style="font-family: sans-serif;">
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; border-bottom: 2px solid ${color}; padding-bottom: 4px;">${
                      heading
                    }</h3>
                    <p style="margin: 2px 0; font-size: 12px;"><strong>${validLabel}</strong> ${
                      this.formatTime(props.valid_from)
                    }</p>
                    <p style="margin: 2px 0; font-size: 12px;"><strong>${untilLabel}</strong> ${
                      this.formatTime(props.valid_to)
                    }</p>
                    <span class="grid grid-cols-2">
                        <span class="badge badge-primary">${issueLabel}${this.formatTimeAgo(props.valid_from)}</span>
                        <span class="badge badge-primary">${expireLabel}${this.formatTimeAgo(props.valid_to)}</span>
                        <span class="badge badge-secondary copy-btn">
                            <i class="bi bi-copy"></i> ${copyTextLabel}
                        </span>
                    </span>
                    <hr>
                    <p style="margin: 8px 0; font-size: 13px;">${
                      text
                    }</p>
                    ${
                      instruction
                        ? `<p style="margin: 8px 0; font-style: italic; font-size: 12px; color: #555;">${instruction}</p>`
                        : ""
                    }
                </div>
            `;

      new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        className: "warning-popup",
      })
        .setLngLat(e.lngLat)
        .setHTML(popupContent)
        .addTo(this.map);

        setTimeout(() => {
        const btn = document.querySelector(".warning-popup .copy-btn");
        if (btn) {
          btn.addEventListener("click", () => {
            this.copyText(text);
            btn.classList.add("copied");
            setTimeout(() => {
              btn.classList.remove("copied");
            }, 500);
          });
        }
      }, 0);
    });

    this.map.on("mouseenter", "warnings-fill", () => {
      this.map.getCanvas().style.cursor = "pointer";
    });
    this.map.on("mouseleave", "warnings-fill", () => {
      this.map.getCanvas().style.cursor = "";
    });
  }

  private initializeWindLayer() {
    if (this.map.getSource("wind-source")) return;

    const arrowSvg = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L19 21L12 17L5 21L12 2Z" fill="#FFF" stroke="#000" stroke-width="1" />
      </svg>
    `;

    const img = new Image(24, 24);
    img.onload = () => {
        this.map.addImage('wind-arrow', img);

        this.map.addSource("wind-source", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
        });
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(arrowSvg);
}

  public updateWindData(data: any[]) {
      this.windField = data;
      this.initWindCanvas();
      this.spawnParticles();
      
      const windEnabled = localStorage.getItem('weather_wind_visible') !== 'false';
      if (windEnabled) {
          this.startWindAnimation();
      } else {
          this.toggleWindLayer(false);
      }
  }

private initWindCanvas() {
    if (this.windCanvas) return;

    const container = this.map.getCanvas().parentElement!;
    this.windCanvas = document.createElement("canvas");
    this.windCanvas.style.cssText = `
        position: absolute; top: 0; left: 0;
        pointer-events: none; z-index: 0;
    `;
    this.resizeWindCanvas();
    container.appendChild(this.windCanvas);
    this.windCtx = this.windCanvas.getContext("2d");

    this.map.on("resize", () => {
        this.resizeWindCanvas();
        this.spawnParticles();
    });

    // NEW EVENT HANDLING FOR SMOOTH PANNING
    this.map.on("movestart", () => {
        this.isMapMoving = true;
    });

    this.map.on("move", () => {
        // Clear the canvas immediately so trails don't smear across the screen
        if (this.windCtx && this.windCanvas) {
            this.windCtx.clearRect(0, 0, this.windCanvas.width, this.windCanvas.height);
        }
    });

    this.map.on("moveend", () => {
        this.isMapMoving = false;
        this.spawnParticles(); // Re-seed particles at the new geographic locations
    });
}

private resizeWindCanvas() {
    if (!this.windCanvas) return;
    const c = this.map.getCanvas();
    this.windCanvas.width  = c.width;
    this.windCanvas.height = c.height;
}

private spawnParticles() {
    const w = this.windCanvas!.width;
    const h = this.windCanvas!.height;
    this.particles = Array.from({ length: this.PARTICLE_COUNT }, () =>
        this.newParticle(w, h)
    );
}

private newParticle(w: number, h: number): Particle {
    const ll = this.map.unproject([Math.random() * w, Math.random() * h]);
    return {
        lng: ll.lng,
        lat: ll.lat,
        age: Math.random() * 20,
        // Lowered maxAge so the particles die out faster
        maxAge: 30 + Math.random() * 30, 
        speed: 0,
    };
}


private interpolateWind(lng: number, lat: number): { u: number; v: number; speed: number } | null {
    if (!this.windField.length) return null;

    // 1. FAST CULLING: Check if the particle is inside your WindService bounds
    // We add a 0.5 degree margin so particles don't cut off harshly at the exact borders
    const margin = 0.5; 
    const inPM = (lat >= 1.2 - margin && lat <= 7.3 + margin && lng >= 99.6 - margin && lng <= 104.5 + margin);
    const inEM = (lat >= 0.8 - margin && lat <= 7.8 + margin && lng >= 109.5 - margin && lng <= 119.3 + margin);

    // If outside Peninsular AND outside East Malaysia, kill the particle
    if (!inPM && !inEM) {
        return null; 
    }

    // Find nearest neighbours by distance
    let n1d = Infinity, n1data = null as any;
    let n2d = Infinity, n2data = null as any;
    let n3d = Infinity, n3data = null as any;
    let n4d = Infinity, n4data = null as any;

    for (let i = 0; i < this.windField.length; i++) {
        const d_data = this.windField[i];
        const dx = d_data.longitude - lng;
        const dy = d_data.latitude  - lat;
        const d = dx * dx + dy * dy;

        if (d < n4d) {
            if (d < n1d) {
                n4d = n3d; n4data = n3data;
                n3d = n2d; n3data = n2data;
                n2d = n1d; n2data = n1data;
                n1d = d; n1data = d_data;
            } else if (d < n2d) {
                n4d = n3d; n4data = n3data;
                n3d = n2d; n3data = n2data;
                n2d = d; n2data = d_data;
            } else if (d < n3d) {
                n4d = n3d; n4data = n3data;
                n3d = d; n3data = d_data;
            } else {
                n4d = d; n4data = d_data;
            }
        }
    }

    // 2. DISTANCE CUTOFF: If even the nearest point is too far away 
    // (e.g., a particle over the ocean *between* PM and EM), kill it.
    // 2.0 squared degrees is roughly ~150km away
    if (n1d > 2.0) { 
        return null;
    }

    // IDW (inverse distance weighting)
    let sumW = 0, sumU = 0, sumV = 0;
    const nearest = [
        { d: n1d, data: n1data },
        { d: n2d, data: n2data },
        { d: n3d, data: n3data },
        { d: n4d, data: n4data }
    ];

    for (let i = 0; i < 4; i++) {
        const n = nearest[i];
        if (!n.data) continue;
        const w = n.d < 1e-10 ? 1e10 : 1 / n.d;
        
        // (Includes the 180 degree fix from earlier!)
        const rad = ((n.data.windDirection + 180) * Math.PI) / 180; 
        
        sumU += Math.sin(rad) * n.data.windSpeed * w;
        sumV += Math.cos(rad) * n.data.windSpeed * w;   // north-up: cos for v
        sumW += w;
    }

    const u = sumU / sumW;
    const v = sumV / sumW;
    return { u, v, speed: Math.sqrt(u * u + v * v) };
}

private speedToColor(speed: number): string {
    const t = Math.min(speed / 20, 1);
    // Lowered the base alpha values so overlapping lines build up a "glow"
    if (t < 0.33)  return `rgba(100, 180, 255, 0.4)`;
    else return `rgba(100, 255, 160, 0.5)`;
}

  private startWindAnimation() {
    if (this.windAnimFrame) cancelAnimationFrame(this.windAnimFrame);

    const step = () => {
        if (!this.windCanvas || !this.windCtx) {
            this.windAnimFrame = null;
            return;
        }
        const ctx = this.windCtx;
        const canvas = this.windCanvas;

        if (!this.isMapMoving) {
            const w = canvas.width;
            const h = canvas.height;

            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = "source-over";

            for (const p of this.particles) {
                const screen = this.map.project([p.lng, p.lat]);

                if (screen.x < 0 || screen.x > w || screen.y < 0 || screen.y > h) {
                    Object.assign(p, this.newParticle(w, h));
                    continue;
                }

                const wind = this.interpolateWind(p.lng, p.lat);
                if (!wind) {
                    Object.assign(p, this.newParticle(w, h));
                    continue;
                }

                const currentZoom = this.map.getZoom();
                const zoomFactor = Math.pow(2, currentZoom - 6);
                const scale = 0.12 * zoomFactor;

                const nx = screen.x + wind.u * scale;
                const ny = screen.y - wind.v * scale;

                ctx.beginPath();
                ctx.moveTo(screen.x, screen.y);
                ctx.lineTo(nx, ny);
                const color = this.speedToColor(wind.speed);
                ctx.strokeStyle = color;
                ctx.lineCap = "round";
                ctx.lineWidth = wind.speed > 15 ? 1.5 : 0.8;
                ctx.shadowBlur = 4;
                ctx.stroke();

                const moved = this.map.unproject([nx, ny]);
                p.lng = moved.lng;
                p.lat = moved.lat;
                p.speed = wind.speed;
                p.age++;

                if (p.age > p.maxAge) {
                    Object.assign(p, this.newParticle(w, h));
                }
            }
        }
        this.windAnimFrame = requestAnimationFrame(step);
    };

    this.windAnimFrame = requestAnimationFrame(step);
}

  public destroyWindLayer() {
      if (this.windAnimFrame) cancelAnimationFrame(this.windAnimFrame);
      this.windCanvas?.remove();
      this.windCanvas = null;
  }

  private formatTime(dateStr: string): string {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr).toLocaleString();
    return date;
  }

  private copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  private startLightningAnimation() {
    // Clear any existing interval just in case
    if (this.animationInterval) clearInterval(this.animationInterval);

    // Update the opacity rule every 1 second
    this.animationInterval = setInterval(() => {
        if (this.map.getLayer("lightning-layer")) {
            const now = Date.now();
            
            // This updates the paint property dynamically
            this.map.setPaintProperty("lightning-layer", "circle-opacity", [
                "interpolate",
                ["linear"],
                ["get", "time"],
                now - 60000, 0,  // If time was 60s ago (or more), opacity is 0
                now, 1           // If time is now, opacity is 1
            ]);
        }
    }, 1000); // Run every second
  }

  private updateLightningLayer(strikes: LightningStrike[]) {
    const source = this.map.getSource("lightning-source") as GeoJSONSource;
    if (!source) {
      console.warn("Lightning source not ready yet");
      return;
    }

    const features = strikes.map((s) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [s.lon, s.lat],
      },
      properties: {
        time: s.time,
      },
    }));

    source.setData({
      type: "FeatureCollection",
      features: features as any,
    });
  }

  public showUserLocation() {
    if (!navigator.geolocation) {
      console.error("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;

        if (this.userLocationMarker) {
          this.userLocationMarker.remove();
        }

        const el = document.createElement("div");
        el.className = "user-location-marker";
        el.style.width = "20px";
        el.style.height = "20px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#4285F4";
        el.style.border = "3px solid white";
        el.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";

        this.userLocationMarker = new maplibregl.Marker({ element: el })
          .setLngLat([longitude, latitude])
          .addTo(this.map);

        this.map.flyTo({
          center: [longitude, latitude],
          zoom: 8,
          duration: 1500,
        });
      },
      (error) => {
        console.error("Error getting location:", error.message);
      }
    );
  }

  public removeUserLocation() {
    if (this.userLocationMarker) {
      this.userLocationMarker.remove();
      this.userLocationMarker = undefined;
    }
  }

  private latestRadarTimestamp: number = 0;

  public setLatestRadarTimestamp(timestamp: number) {
    this.latestRadarTimestamp = timestamp;
  }

  public addRainViewerLayer(timestamp: number) {
    if (this.map.getSource("rainviewer")) return;

    this.map.addSource("rainviewer", {
      type: "raster",
      tiles: [
        RainViewerService.getTileUrl(timestamp, 256)
      ],
      tileSize: 256,
      maxzoom: 7
    });

    const beforeLayer = this.map.getLayer("malaysia-outline")
      ? "malaysia-outline"
      : undefined;

    this.map.addLayer(
      {
        id: "rainviewer-radar",
        type: "raster",
        source: "rainviewer",
        paint: {
          "raster-opacity": 0.8,
          "raster-fade-duration": 0,
        },
        layout: {
          visibility: "visible",
        },
      },
      beforeLayer
    );
  }

  public toggleRainViewerLayer(visible: boolean) {
    if (!this.map.getLayer("rainviewer-radar")) return;
    this.map.setLayoutProperty(
      "rainviewer-radar",
      "visibility",
      visible ? "visible" : "none"
    );
    // Lightning also toggles with rain layout per previous request
    if (this.map.getLayer("lightning-layer")) {
        this.map.setLayoutProperty(
            "lightning-layer",
            "visibility",
            visible ? "visible" : "none"
        );
    }
  }

  private updateRainViewerLayer(timestamp: number) {
    const layerId = "rainviewer-radar";
    const sourceId = "rainviewer";
    
    let wasVisible = true;

    if (this.map.getSource(sourceId)) {
       if (this.map.getLayer(layerId)) {
         // Check if it was visible
         const visibility = this.map.getLayoutProperty(layerId, "visibility");
         wasVisible = visibility !== "none";
         this.map.removeLayer(layerId);
       }
       this.map.removeSource(sourceId);
    }

    // "if playback is time is faster then now then show the last one own data"
    // Use the latest known past timestamp if we are in the future
    const safeTimestamp = (this.latestRadarTimestamp && timestamp > this.latestRadarTimestamp) 
        ? this.latestRadarTimestamp 
        : timestamp;

    this.currentRadarTimestamp = safeTimestamp;
    this.addRainViewerLayer(safeTimestamp);
    
    // Restore visibility
    if (!wasVisible) {
        this.map.setLayoutProperty(layerId, "visibility", "none");
    }
  }

  public setRainViewerColorScheme(schemeId: number) {
      RainViewerService.colorScheme = schemeId;
      // Refresh with current display time (or latest radar time used for display)
      // We can basically re-trigger updateRainViewerLayer with the current meaningful timestamp.
      // But updateRainViewerLayer takes a timestamp.
      // We need to know what the *current* timestamp showing is.
      // We can use this.currentDisplayTime / 1000 (convert back to seconds).
      
      this.updateRainViewerLayer(this.currentDisplayTime / 1000);
  }

  public toggleMapStyle(style: string) {
    const isDarkVector = style === 'dark';
    const isEsriDark = style === 'esri_dark';
    
    // Singular raster layers (one source = one layer)
    const rasterLayers: Record<string, string> = {
        'satellite': 'satellite-layer'
    };

    // Toggle singular raster layers
    Object.keys(rasterLayers).forEach(key => {
        const layerId = rasterLayers[key];
        if (this.map.getLayer(layerId)) {
            this.map.setLayoutProperty(layerId, 'visibility', style === key ? 'visible' : 'none');
        }
    });
    
    // Toggle Esri Dark composite layers
    if (this.map.getLayer('esri-dark-base')) {
        this.map.setLayoutProperty('esri-dark-base', 'visibility', isEsriDark ? 'visible' : 'none');
    }

    // Fill/background layers: only show on the dark vector map
    const fillLayers = ['world-fill', 'malaysia-fill'];
    fillLayers.forEach(layerId => {
        if (this.map.getLayer(layerId)) {
            this.map.setLayoutProperty(layerId, 'visibility', isDarkVector ? 'visible' : 'none');
        }
    });

    // Malaysia border + label overlays: ALWAYS show on every map style
    // (they sit on top of any raster base map)
    const overlayLayers = ['malaysia-outline', 'malaysia-outline-detailed', 'malaysia-labels-detailed'];
    overlayLayers.forEach(layerId => {
        if (this.map.getLayer(layerId)) {
            this.map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
    });
  }

  public toggleWindLayer(visible: boolean) {
    localStorage.setItem('weather_wind_visible', String(visible));

    if (this.map.getLayer("wind-canvas-layer")) {
        this.map.setLayoutProperty("wind-canvas-layer", "visibility", visible ? "visible" : "none");
    }

    if (visible) {
        this.startWindAnimation();
    } else {
        if (this.windAnimFrame) {
            cancelAnimationFrame(this.windAnimFrame);
            this.windAnimFrame = null;
        }
        // Clear canvas BEFORE nulling ctx, while refs are still valid
        if (this.windCtx && this.windCanvas) {
            this.windCtx.clearRect(0, 0, this.windCanvas.width, this.windCanvas.height);
        }
    }
}




  private currentDisplayTime: number = Date.now();

  public setDisplayTime(timestamp: number) {
    // For warnings, if time is future, just show current (cap at Date.now())
    this.currentDisplayTime = Math.min(timestamp * 1000, Date.now());
    
    // For radar, allow future timestamps (Nowcast)
    this.updateRainViewerLayer(timestamp);
    this.renderWarnings();
  }

  public setFilter(filter: FilterState) {
    this.currentFilter = filter;
    this.renderWarnings();
  }

  public toggleWarnings(visible: boolean) {
      if (visible) {
          this.map.setLayoutProperty("warnings-fill", "visibility", "visible");
          this.map.setLayoutProperty("warnings-line", "visibility", "visible");
      } else {
          this.map.setLayoutProperty("warnings-fill", "visibility", "none");
          this.map.setLayoutProperty("warnings-line", "visibility", "none");
      }
  }


  public setLanguage(lang: Language) {
      if (this.currentLanguage === lang) return;
      this.currentLanguage = lang;
      this.renderWarnings();
  }

  public highlightWarningAreas(warnings: DecodedWarning[]) {
    this.allWarnings = warnings;
    this.renderWarnings();
  }

  private formatTimeAgo(dateStr: string): string {
    const now = this.currentDisplayTime;
    const target = new Date(dateStr).getTime();
    const diffMs = Math.abs(now - target);
    const isFuture = target > now;
    
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return isFuture ? "in a moment" : "just now";
    
    if (minutes < 60) return isFuture 
        ? `in ${minutes} minute${minutes > 1 ? "s" : ""}` 
        : `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    if (hours < 24) return isFuture 
        ? `in ${hours} hour${hours > 1 ? "s" : ""}` 
        : `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return isFuture 
        ? `in ${days} day${days > 1 ? "s" : ""}` 
        : `${days} day${days > 1 ? "s" : ""} ago`;
}


  private renderWarnings() {
    const source = this.map.getSource("warnings-source") as GeoJSONSource;
    if (!source) return;

    if (!source) return;

    const now = new Date(this.currentDisplayTime);
    const categoryColors: Record<string, string> = {
      first: "#FFEB3B",
      second: "#FF9800",
      third: "#F44336",
      alert: "#9C27B0",
      thunderstorm_warning: "#2196F3",
      thunderstorm_watch: "#2196F3", // Same color as warning
      continuous_rain: "#4CAF50",
      sea_level: "#00BCD4",
      tropical_cyclone: "#9C27B0",
    };

    const categoryStrokeWeights: Record<string, number> = {
      first: 1,
      second: 2,
      third: 4,
      alert: 1,
      thunderstorm_warning: 2,
      thunderstorm_watch: 2,
      continuous_rain: 1,
      tropical_cyclone: 4,
    };

    const filteredWarnings = this.allWarnings.filter((warning) => {
      const warningIdentifier = warning.category || warning.warningType;
      if (
        !warningIdentifier ||
        !this.currentFilter.categories.has(warningIdentifier)
      ) {
        return false;
      }

      let isActive = true;
      if (warning.valid_to) {
        const validTo = new Date(warning.valid_to);
        isActive = validTo > now;
      }

      const statusStr = isActive ? "active" : "expired";
      return this.currentFilter.status.has(statusStr);
    });

    const featuresToRender: any[] = [];

    filteredWarnings.forEach((warning) => {
      if (!warning.locations?.length) return;

      const expandedLocations = warning.locations.flatMap((loc: [string, boolean]) => {
        if (!loc[1]) {
          return [loc[0]];
        }
        return MapComponent.REGION_MAPPING[loc[0]] || [loc[0]];
      });

      const color =
        categoryColors[warning.category || warning.warningType || "first"] ||
        "#FFEB3B";
      const strokeWeight =
        categoryStrokeWeights[
          warning.category || warning.warningType || "first"
        ] || 1;
      const validFrom = warning.valid_from || "N/A";
      const validTo = warning.valid_to || "Until further notice";

      expandedLocations.forEach((location: string) => {

        const cleanLocationName = location.split('(')[0].trim().toLowerCase().replace(/\s+/g, "-");

        const matchedFeatures = this.geojsonFeatures.filter((feature) => {
          const featureId = feature.id?.toLowerCase().replace(/\s+/g, "-");
          
          // Helper to clean feature names too
          const rawName = feature.properties?.name || "";
          const featureName = rawName.toLowerCase().replace(/\s+/g, "-");

          return (
            featureId === cleanLocationName ||
            featureName === cleanLocationName
          );
        });

        matchedFeatures.forEach((feature) => {
          featuresToRender.push({
            type: "Feature",
            geometry: feature.geometry,
            properties: {
              ...feature.properties,
              color,
              strokeWeight,
              issue: warning.warning_issue.issued,
              heading_en: warning.heading_en,
              heading_bm: warning.heading_bm,
              valid_from: validFrom,
              valid_to: validTo,
              text_en: warning.text_en,
              text_bm: warning.text_bm,
              instruction_en: warning.instruction_en || "",
              instruction_bm: warning.instruction_bm || "",
            },
          });
        });
      });
    });

    source.setData({
      type: "FeatureCollection",
      features: featuresToRender,
    });
  }

  // --- Forecast Logic ---

  public renderForecast(forecasts: any[]) { // Using any[] to avoid circular dependency if I don't import ForecastData type yet
    let source = this.map.getSource("forecast-source") as GeoJSONSource;
    
    // Initialize if not exists
    if (!source && this.map) {
       this.map.addSource("forecast-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      const beforeLayerId = this.map.getLayer("rainviewer-radar") ? "rainviewer-radar" : "malaysia-outline";

      this.map.addLayer(
        {
          id: "forecast-fill",
          type: "fill",
          source: "forecast-source",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.6,
          },
        },
        beforeLayerId
      );

      // Add click handler for details
      this.map.on("click", "forecast-fill", (e) => {
         if (!e.features || !e.features.length) return;
         const props = e.features[0].properties;
         if (!props) return;
         
         const t = (key: string) => LanguageService.getInstance().translate(key.toLowerCase());
         
         const popupContent = `
            <div class="glass-panel p-2" style="color: #d0d0d0 !important;">
                <h4 style="margin: 0 0 5px 0;">${props.location_name}</h4>
                <div style="font-size: 14px; margin-bottom: 5px;">
                    <span style="font-weight: bold; color: ${props.color}">${t(props.summary_forecast)}</span>
                </div>
                <div style="font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                    <div>${t('morning')}: <br> ${t(props.morning)}</div>
                    <div>${t('afternoon')}: <br> ${t(props.afternoon)}</div>
                    <div>${t('night')}: <br> ${t(props.night)}</div>
                    <div>${t('temp')}: <br> ${props.min_temp}°C - ${props.max_temp}°C</div>
                </div>
            </div>
         `;

         
         new maplibregl.Popup({ closeButton: true, className: "forecast-popup" })
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(this.map);
      });
      
      source = this.map.getSource("forecast-source") as GeoJSONSource;
    }

    const colorMap: Record<string, string> = {
        "tiada hujan": "#8BC34A", // Green (Good/Fair)
        "mendung": "#9E9E9E", // Gray
        "hujan": "#4CAF50", // Green
        "hujan di beberapa tempat": "#66BB6A", 
        "hujan di kebanyakan tempat": "#2E7D32", // Darker Green
        "hujan menyeluruh": "#1B5E20", // Very Dark Green
        "ribut petir": "#FFC107", // Amber
        "ribut petir di beberapa tempat": "#FF9800", // Orange
        "ribut petir di kebanyakan tempat": "#F44336", // Red
        "ribut petir menyeluruh": "#B71C1C" // Dark Red
    };
    
    // Helper to find color based on fuzzy match
    const getColor = (summary: string) => {
        const lower = summary.toLowerCase();
        if (lower.includes("ribut petir")) {
            if (lower.includes("kebanyakan")) return colorMap["ribut petir di kebanyakan tempat"];
            return colorMap["ribut petir di beberapa tempat"];
        }
        if (lower.includes("hujan")) {
             if (lower.includes("kebanyakan")) return colorMap["hujan di kebanyakan tempat"];
             if (lower.includes("menyeluruh")) return colorMap["hujan menyeluruh"];
             return colorMap["hujan di beberapa tempat"];
        }
        if (lower.includes("mendung")) return colorMap["mendung"];
        return colorMap["tiada hujan"];
    };

    const featuresToRender: any[] = [];
    
    forecasts.forEach(forecast => {
        const cleanName = forecast.location.location_name.toLowerCase().replace(/\s+/g, "-");
        
        // Check for mapping
        const mappedLocations = MapComponent.REGION_MAPPING[cleanName] || [cleanName];

        // Find matching features in geojsonFeatures
        // This relies on map.on('load') having populated geojsonFeatures
        const matchedFeatures = this.geojsonFeatures.filter((feature) => {
           const featureName = (feature.properties?.name || "").toLowerCase().replace(/\s+/g, "-");
           const featureId = (feature.id || "").toLowerCase().replace(/\s+/g, "-");
           
           // Check if this feature matches ANY of the mapped locations
           return mappedLocations.some(loc => {
               const cleanLoc = loc.toLowerCase().replace(/\s+/g, "-");
               return featureName === cleanLoc || featureId === cleanLoc;
           });
        });
        
        const color = getColor(forecast.summary_forecast);
        
        matchedFeatures.forEach(feature => {
            featuresToRender.push({
                type: "Feature",
                geometry: feature.geometry,
                properties: {
                    ...feature.properties,
                    location_name: forecast.location.location_name,
                    summary_forecast: forecast.summary_forecast,
                    morning: forecast.morning_forecast,
                    afternoon: forecast.afternoon_forecast,
                    night: forecast.night_forecast,
                    min_temp: forecast.min_temp,
                    max_temp: forecast.max_temp,
                    color: color
                }
            });
        });
    });

    if (source) {
        source.setData({
            type: "FeatureCollection",
            features: featuresToRender
        });
    }
  }

  // --- Probe / Tooltip Logic ---
  
  private isProbeMode = false;
  private probeTooltip: HTMLElement | null = null;
  private probeCache: { x: number, y: number, z: number, url: string, img: HTMLImageElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D } | null = null;
  private currentRadarTimestamp: number = 0; // Store the exact timestamp used for the layer

  public toggleProbeMode(enabled: boolean) {
      if (this.isProbeMode === enabled) return;
      this.isProbeMode = enabled;
      
      // Update cursor
      this.map.getCanvas().style.cursor = enabled ? 'crosshair' : ''; // 'help' is often a question mark or pointer, efficient differentiation
      
      // If enabling probe, create tooltip if needed
      if (enabled) {
          if (!this.probeTooltip) {
              this.probeTooltip = document.createElement('div');
              this.probeTooltip.className = 'glass-panel';
              this.probeTooltip.style.position = 'absolute';
              this.probeTooltip.style.padding = '4px 8px';
              this.probeTooltip.style.pointerEvents = 'none'; // Don't block mouse
              this.probeTooltip.style.zIndex = '2000';
              this.probeTooltip.style.display = 'none';
              this.probeTooltip.style.fontSize = '12px';
              this.probeTooltip.style.color = '#fff';
              this.probeTooltip.style.whiteSpace = 'nowrap';
              document.body.appendChild(this.probeTooltip);
          }
          this.probeTooltip.style.display = 'block';

      } else {
          if (this.probeTooltip) {
              this.probeTooltip.style.display = 'none';
          }
      }
  }

  // --- Drawing Logic ---

  public toggleDrawingMode(enabled: boolean) {
      this.isDrawingMode = enabled;
      this.map.getCanvas().style.cursor = enabled ? 'crosshair' : '';
      
      if (enabled) {
          // If drawing is enabled, disable probe
          if (this.isProbeMode) this.toggleProbeMode(false);
          this.map.dragPan.disable();
      } else {
          this.map.dragPan.enable();
          this.isDrawing = false;
          this.currentDrawingFeature = null;
      }
  }

  private onMouseDown(e: any) {
      if (!this.isDrawingMode) return;

      this.isDrawing = true;
      this.currentDrawingFeature = {
          type: "Feature",
          geometry: {
              type: "LineString",
              coordinates: [[e.lngLat.lng, e.lngLat.lat]]
          },
          properties: {}
      };
      
      this.drawnFeatures.push(this.currentDrawingFeature);
      this.updateDrawnSource();
  }

  private onMouseMove(e: any) {
      // Handle Drawing first
      if (this.isDrawingMode && this.isDrawing && this.currentDrawingFeature) {
          this.currentDrawingFeature.geometry.coordinates.push([e.lngLat.lng, e.lngLat.lat]);
          this.updateDrawnSource();
          return;
      }

      // Handle Probe
      if (this.isProbeMode && this.probeTooltip) {
          this.updateProbe(e);
      }
  }

  private async updateProbe(e: any) {
      if (!this.probeTooltip) return;

      // Move tooltip to mouse position
      this.probeTooltip.style.left = `${e.originalEvent.pageX + 15}px`;
      this.probeTooltip.style.top = `${e.originalEvent.pageY + 15}px`;

      let windHTML = '';
      if (this.windField && this.windField.length > 0) {
          let closest = this.windField[0];
          let minDist = Infinity;
          for (const w of this.windField) {
              const dist = Math.pow(w.latitude - e.lngLat.lat, 2) + Math.pow(w.longitude - e.lngLat.lng, 2);
              if (dist < minDist) {
                  minDist = dist;
                  closest = w;
              }
          }
          if (minDist < 2) {
              const rot = Math.round(closest.windDirection);
              windHTML = `<div style="font-size: 11px; color: #ddd; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                  <span>Wind: ${Math.round(closest.windSpeed)} km/h</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${rot}deg);">
                      <line x1="12" y1="4" x2="12" y2="20"></line>
                      <polyline points="18 14 12 20 6 14"></polyline>
                  </svg>
              </div>`;
          }
      }

      // Get color
      const color = await this.getRadarValueAt(e.lngLat.lng, e.lngLat.lat);
      if (color || windHTML) {
          this.probeTooltip.innerHTML = `${color ? `<strong>${color}</strong>` : '<strong>No Rain</strong>'}${windHTML}`;
          this.probeTooltip.style.display = 'block';
      } else {
          this.probeTooltip.innerText = "No Rain";
          this.probeTooltip.style.display = 'none';
      }
  }

  // Helper function to project lat/lon to tile coords
  private getTileCoords(lat: number, lon: number, zoom: number) {
        const xPercent = (lon + 180) / 360;
        const latRad = lat * Math.PI / 180;
        const mercN = Math.log(Math.tan(latRad) + (1 / Math.cos(latRad)));
        const yPercent = (1 - (mercN / Math.PI)) / 2;
        
        const numTiles = 1 << zoom;
        const x = Math.floor(xPercent * numTiles);
        const y = Math.floor(yPercent * numTiles);

        // Pixel within title
        const pixelX = Math.floor((xPercent * numTiles - x) * 256);
        const pixelY = Math.floor((yPercent * numTiles - y) * 256);

        return { x, y, pixelX, pixelY };
  }

  private async getRadarValueAt(lon: number, lat: number): Promise<string | null> {
      // Use Zoom Level 6 for sampling (good balance of detail and cache hit rate)
      // We could use current map zoom, but that makes cache thrashing likely. 
      // Z=6 covers a large area.
      const SAMPLE_ZOOM = 6;
      
      const { x, y, pixelX, pixelY } = this.getTileCoords(lat, lon, SAMPLE_ZOOM);
      
      const timestamp = this.currentRadarTimestamp;
      if (!timestamp) return null;

      const templateUrl = RainViewerService.getTileUrl(timestamp, 256);
      const url = templateUrl
          .replace('{z}', SAMPLE_ZOOM.toString())
          .replace('{x}', x.toString())
          .replace('{y}', y.toString());

      // Check Cache
      let ctx = this.probeCache?.ctx;
      
      if (!this.probeCache || this.probeCache.url !== url) {
          // Verify we have a timestamp
          if (!timestamp) return null;
          
          try {
              const img = new Image();
              img.crossOrigin = "Anonymous";
              img.src = url;
              
              await new Promise((resolve, reject) => {
                  img.onload = resolve;
                  img.onerror = reject;
              });

              const canvas = document.createElement('canvas');
              canvas.width = 256;
              canvas.height = 256;
              ctx = canvas.getContext('2d', { willReadFrequently: true })!;
              ctx.drawImage(img, 0, 0);

              this.probeCache = { x, y, z: SAMPLE_ZOOM, url, img, canvas, ctx };
          } catch (e) {
              console.warn("Failed to load probe tile", e);
              return null;
          }
      }

      if (!ctx) return null;

      // Read pixel
      const p = ctx.getImageData(pixelX, pixelY, 1, 1).data;
      // p is [r, g, b, a]
      
      if (p[3] === 0) return null; // Transparent

      return RainViewerService.getDbz(p[0], p[1], p[2]);
  }

  private onMouseUp() {
      if (!this.isDrawingMode) return;
      this.isDrawing = false;
      this.currentDrawingFeature = null;
  }

  public clearDrawings() {
      this.drawnFeatures = [];
      this.updateDrawnSource();
  }

  private updateDrawnSource() {
      const source = this.map.getSource("drawn-source") as GeoJSONSource;
      if (source) {
          source.setData({
              type: "FeatureCollection",
              features: this.drawnFeatures
          });
      }
  }
}

