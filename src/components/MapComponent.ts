import maplibregl, { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DecodedWarning } from "../services/WeatherWarning";
import type { FilterState } from "./WarningFilter";
import type { LightningStrike } from "../services/LightningService";
import { LightningService } from "../services/LightningService";

export class MapComponent {
  private userLocationMarker?: maplibregl.Marker;
  private map: MapLibreMap;
  private animationInterval: any;
  private containerId: string;
  private geojsonFeatures: any[] = [];
  private allWarnings: DecodedWarning[] = [];
  private lightningService: LightningService;
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
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#1f2025" },
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
    this.map = new maplibregl.Map({
      container: this.containerId,
      style: MapComponent.BASE_MAP_STYLE,
      center: [109.45, 4.11],
      maxZoom: 8,
      zoom: isMobile ? 3.5 : 5.5,
      attributionControl: false,
    });
    this.lightningService = new LightningService();
    this.lightningService.connect();
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

    // Interaction for warnings
    this.map.on("click", "warnings-fill", (e) => {
      if (!e.features || !e.features.length) return;

      const feature = e.features[0];
      const props = feature.properties;
      if (!props) return;

      const color = props.color;

      const popupContent = `
                <div style="color: #333; font-family: sans-serif;">
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; border-bottom: 2px solid ${color}; padding-bottom: 4px;">${
        props.heading_en
      }</h3>
                    <p style="margin: 4px 0; font-size: 12px; color: #666;"><strong>Valid:</strong> ${
                      props.valid_from
                    }</p>
                    <p style="margin: 4px 0; font-size: 12px; color: #666;"><strong>Until:</strong> ${
                      props.valid_to
                    }</p>
                    <hr>
                    <p style="margin: 8px 0; font-size: 13px;">${
                      props.text_en
                    }</p>
                    ${
                      props.instruction_en
                        ? `<p style="margin: 8px 0; font-style: italic; font-size: 12px; color: #555;">${props.instruction_en}</p>`
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
    });

    this.map.on("mouseenter", "warnings-fill", () => {
      this.map.getCanvas().style.cursor = "pointer";
    });
    this.map.on("mouseleave", "warnings-fill", () => {
      this.map.getCanvas().style.cursor = "";
    });
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

  public addRainViewerLayer(timestamp: number) {
    if (this.map.getSource("rainviewer")) return;

    this.map.addSource("rainviewer", {
      type: "raster",
      tiles: [
        `https://tilecache.rainviewer.com/v2/radar/${timestamp}/256/{z}/{x}/{y}/2/1_1.png`,
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.rainviewer.com/api.html" target="_blank">RainViewer</a>',
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
    this.map.setLayoutProperty(
      "lightning-layer",
      "visibility",
      visible ? "visible" : "none"
    );
  }

  public setFilter(filter: FilterState) {
    this.currentFilter = filter;
    this.renderWarnings();
  }

  public highlightWarningAreas(warnings: DecodedWarning[]) {
    this.allWarnings = warnings;
    this.renderWarnings();
  }

  private renderWarnings() {
    const source = this.map.getSource("warnings-source") as GeoJSONSource;
    if (!source) return;

    const now = new Date();
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

      const expandedLocations = warning.locations.flatMap((loc: string) => {
        return MapComponent.REGION_MAPPING[loc] || [loc];
      });

      const color =
        categoryColors[warning.category || warning.warningType || "first"] ||
        "#FFEB3B";
      const strokeWeight =
        categoryStrokeWeights[
          warning.category || warning.warningType || "first"
        ] || 1;
      const validFrom = warning.valid_from
        ? new Date(warning.valid_from).toLocaleString()
        : "N/A";
      const validTo = warning.valid_to
        ? new Date(warning.valid_to).toLocaleString()
        : "Until further notice";

      expandedLocations.forEach((location: string) => {
        if (location.includes("(") || location.includes(")")) return;

        const matchedFeatures = this.geojsonFeatures.filter((feature) => {
          const featureId = feature.id?.toLowerCase().replace(/\s+/g, "-");
          const featureName = feature.properties?.name
            ?.toLowerCase()
            .replace(/\s+/g, "-");
          const featureState = feature.properties?.state?.toLowerCase();

          const normalizedLocation = location
            .toLowerCase()
            .replace(/\s+/g, "-");

          return (
            featureId === normalizedLocation ||
            featureName === normalizedLocation ||
            featureState === normalizedLocation
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
              heading_en: warning.heading_en,
              valid_from: validFrom,
              valid_to: validTo,
              text_en: warning.text_en,
              instruction_en: warning.instruction_en || "",
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
}
