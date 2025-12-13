import maplibregl, { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DecodedWarning } from "../services/WeatherWarning";
import type { FilterState } from "./WarningFilter";

export class MapComponent {
  private userLocationMarker?: maplibregl.Marker;
  private map: MapLibreMap;
  private containerId: string;
  private geojsonFeatures: any[] = [];
  private allWarnings: DecodedWarning[] = [];
  private currentFilter: FilterState = {
    categories: new Set([
      "first",
      "second",
      "third",
      "thunderstorm",
      "continuous_rain",
      "sea_level",
      "tropical_cyclone",
      "alert",
    ]),
    status: new Set(["active"]),
  };

  private static REGION_MAPPING: Record<string, string[]> = {
    "east-johor": ["kota-tinggi", "mersing", "segamat", "kluang"],
    pahang: [
      "kuantan",
      "pekan",
      "rompin",
      "bentong",
      "raub",
      "lipis",
      "jerantut",
      "temerloh",
      "maran",
      "bera",
      "cameron-highlands",
    ],
    terengganu: [
      "besut",
      "setiu",
      "kuala-terengganu",
      "kuala-nerus",
      "marang",
      "hulu-terengganu",
      "dungun",
      "kemaman",
    ],
    kelantan: [
      "tumpat",
      "pasir-mas",
      "kota-bharu",
      "bachok",
      "pasir-puteh",
      "tanah-merah",
      "machang",
      "kuala-krai",
      "mukim-chiku",
      "jeli",
      "gua-musang",
    ],
  };

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
    ],
  };

  constructor(containerId: string) {
    this.containerId = containerId;
    this.map = new maplibregl.Map({
      container: this.containerId,
      style: MapComponent.BASE_MAP_STYLE,
      center: [109.45, 4.11],
      zoom: 5.5,
      maxZoom: 8,
      attributionControl: false,
    });
  }

  public onLoad(callback: () => void) {
    this.map.on("load", async () => {
      try {
        const res = await fetch("/malaysia_detail.geojson");
        if (res.ok) {
          const data = await res.json();
          this.geojsonFeatures = data.features || [];
          console.log(
            `Loaded ${this.geojsonFeatures.length} features for lookup.`
          );
        }
      } catch (e) {
        console.error("Failed to load malaysia_detail.geojson for lookups", e);
      }

      // Initialize the shared source and layers for warnings
      this.initializeWarningLayers();

      callback();
    });
  }

  private initializeWarningLayers() {
    if (this.map.getSource("warnings-source")) return;

    this.map.addSource("warnings-source", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    // Fill layer
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
    ); // Place below malaysia-outline

    // Line layer
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

    // Interaction
    this.map.on("click", "warnings-fill", (e) => {
      if (!e.features || !e.features.length) return;

      const feature = e.features[0];
      const props = feature.properties;
      if (!props) return;

      const color = props.color;

      const popupContent = `
                <div style="color: #333; font-family: sans-serif;>
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

  public showUserLocation() {
    if (!navigator.geolocation) {
      console.error("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;

        // Remove existing marker if any
        if (this.userLocationMarker) {
          this.userLocationMarker.remove();
        }

        // Create marker element
        const el = document.createElement("div");
        el.style.width = "20px";
        el.style.height = "20px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#4285F4";
        el.style.border = "3px solid white";
        el.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";

        // Add marker to map
        this.userLocationMarker = new maplibregl.Marker({ element: el })
          .setLngLat([longitude, latitude])
          .addTo(this.map);

        // Optional: fly to user location
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
      },
      beforeLayer
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
      thunderstorm: "#2196F3",
      continuous_rain: "#4CAF50",
      sea_level: "#00BCD4",
      tropical_cyclone: "#9C27B0",
    };

    const categoryStrokeWeights: Record<string, number> = {
      first: 1,
      second: 2,
      third: 4,
      alert: 1,
      thunderstorm: 2,
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
        const matchedFeatures = this.geojsonFeatures.filter((feature) => {
          const featureId = feature.id?.toLowerCase().replace(/\s+/g, "-");
          const featureName = feature.properties?.name
            ?.toLowerCase()
            .replace(/\s+/g, "-");
          const featureState = feature.properties?.state?.toLowerCase();

          return (
            featureId === location ||
            featureName === location ||
            featureState === location ||
            featureId?.includes(location) ||
            featureName?.includes(location)
          );
        });

        matchedFeatures.forEach((feature) => {
          featuresToRender.push({
            type: "Feature",
            geometry: feature.geometry,
            properties: {
              ...feature.properties, // Keep original properties
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
