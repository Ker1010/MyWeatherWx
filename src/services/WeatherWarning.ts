export interface DecodedWarning extends WeatherWarningDataList {
  locations: string[];
  category?: 'first' | 'second' | 'third' | 'alert' | 'thunderstorm' | 'sea_level' | 'no_advisory';
  warningType: 'wind_sea' | 'continuous_rain' | 'thunderstorm' | 'sea_level' | 'tropical_cyclone' | 'no_advisory';
}

export type WeatherWarningData = WeatherWarningDataList[]

export interface WeatherWarningDataList {
  warning_issue: WarningIssue
  valid_from?: string
  valid_to?: string
  heading_en: string
  text_en: string
  instruction_en: any
  heading_bm: string
  text_bm: string
  instruction_bm: any
}

export interface WarningIssue {
  issued: string
  title_bm: string
  title_en: string
}

export class WeatherWarningService {
    private static API_URL = 'https://api.data.gov.my/weather/warning';
    
    static async fetchData(): Promise<WeatherWarningData | null> {
        try {
            const response = await fetch(this.API_URL);
            if (!response.ok) {
                throw new Error(`WeatherWarning API error: ${response.status}`);
            }
            const data = await response.json();
            console.log('Raw API Response:', data);
            return data;
        } catch (error) {
            console.error("Failed to fetch WeatherWarning data:", error);
            return null;
        }
    }
}

export class WeatherWarningDecoder {
  static decode(data: WeatherWarningData): DecodedWarning[] {
    console.log('\n=== Decoding Weather Warnings ===');
    console.log(`Total warnings to decode: ${data.length}`);
    
    const decoded = data.map((warning, index) => {
      console.log(`\n--- Warning ${index + 1} ---`);
      console.log('Heading:', warning.heading_en);
      console.log('Text snippet:', warning.text_en.substring(0, 100) + '...');
      
      const locations = this.formatlocations(this.extractLocations(warning.text_en));
      const category = this.extractCategory(warning.heading_en);
      const warningType = this.extractWarningType(warning.heading_en);
      console.log('Extracted locations:', locations);
      console.log('Category:', category);
      console.log('Warning type:', warningType);
      
      return {
        ...warning,
        locations: locations,
        category,
        warningType
      };
    });
    
    console.log('\n=== Decoding Complete ===\n');
    return decoded;
  }

  private static formatlocations(locations: string[]): string[] {
    return locations.map(location => location.trim().toLowerCase().replace(/\s+/g, "-"));
  }

  private static extractLocations(text: string): string[] {
    // 1. Capture the segment
    const match = text.match(/over the (?:waters|states) of\s+(.+)/i);
    if (!match) return [];

    let locationRaw = match[1];

    // 2. STOP Condition: Clean trailing time/validity phrases
    const timeStopWords = ["until", "within", "valid", "starting"];
    const lowerRaw = locationRaw.toLowerCase();
    
    for (const word of timeStopWords) {
        // Look for " word " or start of string
        const index = lowerRaw.indexOf(` ${word} `); 
        if (index !== -1) {
            locationRaw = locationRaw.substring(0, index);
        }
    }

    // 3. Pre-normalization: Handle "and", "&" and trailing dots
    // We do NOT replace ; or : yet.
    locationRaw = locationRaw
        .replace(/\s+and\s+/gi, ",") 
        .replace(/\s*&\s*/g, ",")
        .replace(/\.$/, ""); 

    // 4. Two-Pass Extraction
    const finalLocations: string[] = [];

    // Pass A: Split by Semicolons (Distinct Regions)
    // Example: "Kelantan (Tumpat); Terengganu" -> ["Kelantan (Tumpat)", "Terengganu"]
    const regions = locationRaw.split(';');

    for (const region of regions) {
        let cleanRegion = region.trim();
        if (!cleanRegion) continue;

        // Pass B: Check for Specificity (Parentheses or Colons)
        if (cleanRegion.includes('(')) {
            // Case: "Kelantan (Tumpat, Kota Bharu)"
            // Logic: Extract only what is INSIDE parens
            const insideParens = cleanRegion.match(/\((.*?)\)/);
            if (insideParens && insideParens[1]) {
                finalLocations.push(...insideParens[1].split(','));
            }
        } 
        else if (cleanRegion.includes(':')) {
            // Case: "Sarawak: Kuching, Serian"
            // Logic: Extract only what is AFTER the colon
            const afterColon = cleanRegion.split(':')[1];
            if (afterColon) {
                finalLocations.push(...afterColon.split(','));
            }
        } 
        else {
            // Case: "Terengganu" or "Tioman"
            // Logic: Take the whole string
            finalLocations.push(...cleanRegion.split(',')); // Split by comma just in case mixed
        }
    }

    // 5. Final Cleanup (Trim, lowercase, slugify, dedupe)
    return [...new Set( // Remove duplicates
        finalLocations
            .map(loc => loc.trim().toLowerCase().replace(/\s+/g, "-"))
            .filter(loc => loc.length > 0 && loc !== 'n' && loc !== 'ft') // Filter artifacts
    )];
  }

  private static extractCategory(heading: string): DecodedWarning['category'] {
    if (heading.includes('Third Category')) return 'third';
    if (heading.includes('Second Category')) return 'second';
    if (heading.includes('First Category')) return 'first';
    if (heading.includes('Alert')) return 'alert';
    if (heading.includes('Thunderstorm')) return 'thunderstorm';
    if (heading.includes('Sea Level')) return 'sea_level';
    if (heading.includes('No Advisory')) return 'no_advisory';
    return undefined;
  }

  private static extractWarningType(heading: string): DecodedWarning['warningType'] {
    if (heading.includes('Strong Wind') || heading.includes('Rough Seas')) return 'wind_sea';
    if (heading.includes('Continuous Rain')) return 'continuous_rain';
    if (heading.includes('Thunderstorm')) return 'thunderstorm';
    if (heading.includes('Sea Level')) return 'sea_level';
    if (heading.includes('No Advisory')) return 'no_advisory';
    return 'tropical_cyclone';
  }
}