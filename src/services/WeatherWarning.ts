export interface DecodedWarning extends WeatherWarningDataList {
  locations: Array<[string, boolean]>;
  category?:
    | "first"
    | "second"
    | "third"
    | "alert"
    | "thunderstorm_warning"
    | "thunderstorm_watch"
    | "sea_level"
    | "no_advisory";
  warningType:
    | "wind_sea"
    | "continuous_rain"
    | "thunderstorm"
    | "sea_level"
    | "tropical_cyclone"
    | "sea_level"
    | "tropical_cyclone"
    | "no_advisory";
  formattedTitle: string;
}

export type WeatherWarningData = WeatherWarningDataList[];

export interface WeatherWarningDataList {
  warning_issue: WarningIssue;
  valid_from?: string;
  valid_to?: string;
  heading_en: string;
  text_en: string;
  instruction_en: any;
  heading_bm: string;
  text_bm: string;
  instruction_bm: any;
}

export interface WarningIssue {
  issued: string;
  title_bm: string;
  title_en: string;
}

export class WeatherWarningService {
  //Todo: Custom server, Don't directly access data.gov.my avoid rate limiting
  private static API_URL = "https://api.data.gov.my/weather/warning";

  static async fetchData(): Promise<WeatherWarningData | null> {
    try {
      const response = await fetch(this.API_URL);
      if (!response.ok) {
        throw new Error(`WeatherWarning API error: ${response.status}`);
      }
      const data = await response.json();
      console.log("Raw API Response:", data);
      return data;
    } catch (error) {
      console.error("Failed to fetch WeatherWarning data:", error);
      return null;
    }
  }
}

export class WeatherWarningDecoder {
  static decode(data: WeatherWarningData): DecodedWarning[] {
    console.log("\n=== Decoding Weather Warnings ===");
    console.log(`Total warnings to decode: ${data.length}`);

    const decoded = data.map((warning, index) => {
      console.log(`\n--- Warning ${index + 1} ---`);
      console.log("Heading:", warning.heading_en);
      console.log("Text snippet:", warning.text_en.substring(0, 100) + "...");

      const locations = this.formatlocations(
        this.extractLocations(warning.text_en)
      );
      const category = this.extractCategory(warning.heading_en);
      const warningType = this.extractWarningType(warning.heading_en);
      const formattedTitle = this.formatTitle(warning.heading_en);

      console.log("Extracted locations:", locations);
      console.log("Category:", category);
      console.log("Warning type:", warningType);
      console.log("Formatted Title:", formattedTitle);

      return {
        ...warning,
        locations: locations,
        category,
        warningType,
        formattedTitle,
      };
    });

    console.log("\n=== Decoding Complete ===\n");
    return decoded;
  }

  private static formatlocations(locations: { location: string; isDetail: boolean }[]): Array<[string, boolean]> {
    return locations.map((location) =>
      [location.location.trim().toLowerCase().replace(/\s+/g, "-"), location.isDetail]
    );
  }

  private static extractLocations(
    text: string
  ): Array<{ location: string; isDetail: boolean }> {
    const match = text.match(/over the (?:waters|states) of\s+(.+)/i);
    if (!match) return [];

    let locationRaw = match[1];
    const timeStopWords = ["until", "within", "valid", "starting"];
    const lowerRaw = locationRaw.toLowerCase();

    for (const word of timeStopWords) {
      const index = lowerRaw.indexOf(` ${word} `);
      if (index !== -1) {
        locationRaw = locationRaw.substring(0, index);
      }
    }

    locationRaw = locationRaw
      .replace(/\s+and\s+/gi, ",")
      .replace(/\s*&\s*/g, ",")
      .replace(/\.$/, "");

    const finalLocations: Array<{ location: string; isDetail: boolean }> = [];
    const regions = locationRaw.split(";");

    for (const region of regions) {
      let cleanRegion = region.trim();
      if (!cleanRegion) continue;

      if (cleanRegion.includes(":")) {
        const afterColon = cleanRegion.split(":").slice(1).join(":").trim();
        if (afterColon) cleanRegion = afterColon;
      }

      const parts = cleanRegion.match(/(?:[^,(]|\([^)]*\))+/g) || [cleanRegion];

      for (const part of parts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;

        if (trimmedPart.includes("(")) {
          // Extract prefix
          const prefix = trimmedPart
            .substring(0, trimmedPart.indexOf("("))
            .trim();
          const normalizedPrefix = prefix.toLowerCase().replace(/\s+/g, "-");

          // Extract details inside parentheses
          const parensMatches = trimmedPart.matchAll(/\(([^)]+)\)/g);
          for (const match of parensMatches) {
            const locations = match[1].split(",");
            for (const loc of locations) {
              const normalized = loc.trim().toLowerCase().replace(/\s+/g, "-");

              // If location inside () matches the prefix, mark as false (use prefix instead)
              // Otherwise mark as true (use the detail)
              if (normalized === normalizedPrefix) {
                finalLocations.push({ location: prefix, isDetail: false });
              } else {
                finalLocations.push({ location: loc.trim(), isDetail: true });
              }
            }
          }
        } else {
          // No parentheses - whole area
          finalLocations.push({ location: trimmedPart, isDetail: true });
        }
      }
    }

    // Remove duplicates based on normalized location
    const seen = new Set<string>();
    const unique = finalLocations.filter((item) => {
      const normalized = item.location.toLowerCase().replace(/\s+/g, "-");
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return normalized.length > 0 && normalized !== "n" && normalized !== "ft";
    });

    return unique;
  }

  private static extractCategory(heading: string): DecodedWarning["category"] {
    if (heading.includes("Third Category")) return "third";
    if (heading.includes("Second Category")) return "second";
    if (heading.includes("First Category")) return "first";
    if (heading.includes("Alert")) return "alert";

    // Split Thunderstorm Logic
    const lower = heading.toLowerCase();
    if (lower.includes("warning on thunderstorms")) return "thunderstorm_watch";
    if (lower.includes("thunderstorms warning")) return "thunderstorm_warning";
    if (heading.includes("Thunderstorm")) return "thunderstorm_warning"; // Fallback

    if (heading.includes("Sea Level")) return "sea_level";
    if (heading.includes("No Advisory")) return "no_advisory";
    return undefined;
  }

  private static extractWarningType(
    heading: string
  ): DecodedWarning["warningType"] {
    if (heading.includes("Strong Wind") || heading.includes("Rough Seas"))
      return "wind_sea";
    if (heading.includes("Continuous Rain")) return "continuous_rain";
    if (heading.includes("Thunderstorm")) return "thunderstorm";
    if (heading.includes("Sea Level")) return "sea_level";
    if (heading.includes("No Advisory")) return "no_advisory";
    return "tropical_cyclone";
  }

  private static formatTitle(heading: string): string {
    const title = heading.trim();
    const lowerTitle = title.toLowerCase();

    // ONLY process Thunderstorm warnings
    if (lowerTitle.includes("thunderstorm")) {
      // Logic: "Thunderstorms Warning" (Land/Short-term) -> "Thunderstorm Warning" (or Severe)
      //        "Warning on Thunderstorms" (Marine/Longer-term) -> "Thunderstorm Watch"

      if (lowerTitle === "thunderstorms warning") {
        return "Thunderstorm Warning";
      }

      if (lowerTitle === "warning on thunderstorms") {
        // Mapping "Warning on..." to "Watch" based on the user's request for "Warning or Watch" distinction
        return "Thunderstorm Watch";
      }

      // Fallback cleanup for other potential thunderstorm strings
      return title.replace(/Thunderstorms/i, "Thunderstorm");
    }

    // For everything else, return original heading
    return title;
  }
}
