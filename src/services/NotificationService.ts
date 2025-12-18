import type { DecodedWarning } from './WeatherWarning';

export class NotificationService {
    private static STORAGE_KEY_ENABLED = 'notification_enabled';
    private static STORAGE_KEY_STATE = 'notification_state';
    private static STORAGE_KEY_SEEN = 'notification_seen_warnings';

    static isSupported(): boolean {
        return 'Notification' in window;
    }

    private static STORAGE_KEY_DISTRICT = 'notification_district';

    static getSettings() {
        return {
            enabled: localStorage.getItem(this.STORAGE_KEY_ENABLED) === 'true',
            state: localStorage.getItem(this.STORAGE_KEY_STATE) || '',
            district: localStorage.getItem(this.STORAGE_KEY_DISTRICT) || ''
        };
    }

    static async enableNotifications(): Promise<boolean> {
        if (!this.isSupported()) return false;
        
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            localStorage.setItem(this.STORAGE_KEY_ENABLED, 'true');
            return true;
        } else {
            localStorage.setItem(this.STORAGE_KEY_ENABLED, 'false');
            return false;
        }
    }

    static disableNotifications() {
        localStorage.setItem(this.STORAGE_KEY_ENABLED, 'false');
    }

    static setState(state: string) {
        localStorage.setItem(this.STORAGE_KEY_STATE, state);
        // Reset district when state changes
        localStorage.setItem(this.STORAGE_KEY_DISTRICT, ''); 
    }

    static setDistrict(district: string) {
        localStorage.setItem(this.STORAGE_KEY_DISTRICT, district);
    }

    private static regionMappingCache: Record<string, string[]> | null = null;

    static async checkAndNotify(warnings: DecodedWarning[]) {
        const { enabled, state, district } = this.getSettings();
        if (!enabled || !state || state === '') return;
        if (Notification.permission !== 'granted') return;

        // Fetch region mapping for intelligent matching (Cached)
        if (!this.regionMappingCache) {
            try {
                const res = await fetch('/region_mapping.json');
                if (res.ok) this.regionMappingCache = await res.json();
            } catch (e) {
                console.error('Failed to load region mapping for notifications', e);
            }
        }
        const regionMapping = this.regionMappingCache || {};

        const seenWarnings = this.getSeenWarnings();
        const newSeen = new Set(seenWarnings);
        let hasNew = false;

        const normalizedUserState = state.toLowerCase().replace(/\s+/g, '-');
        const normalizedUserDistrict = district ? district.toLowerCase().replace(/\s+/g, '-') : '';
        
        // Get all districts for the selected state to verify "State-wide" warnings
        // The mapping keys might differ slightly from the display state name, need to be careful.
        // Assuming region_mapping keys match normalized state names logic or are handled.
        // Actually region keys are like "johor", "kedah".
        // State selector values are Title Case. "Johor". -> "johor".
        const stateDistricts = regionMapping[normalizedUserState] || [];

        warnings.forEach(warning => {
            // 1. Check if it's a thunderstorm warning
            const isThunderstorm = 
                warning.warningType === 'thunderstorm' || 
                warning.category === 'thunderstorm_warning' || 
                warning.category === 'thunderstorm_watch';

            if (!isThunderstorm) return;

            // 2. Check location
            let matchesLocation = false;

            // Normalize warning locations
            const warningLocs = warning.locations.map(([loc]) => loc.toLowerCase().replace(/\s+/g, '-'));

            if (!normalizedUserDistrict || normalizedUserDistrict === 'all') {
                // Scenario A: User wants ALL warnings for the State.
                // Match if:
                // 1. Warning contains the State name strictly (e.g. "johor")
                // 2. Warning contains ANY district that belongs to this state.
                
                if (warningLocs.includes(normalizedUserState)) {
                    matchesLocation = true;
                } else {
                    // Check if any warning location is a district of this state
                    if (stateDistricts.length > 0) {
                        matchesLocation = warningLocs.some(loc => stateDistricts.includes(loc));
                    } else {
                        // Fallback if mapping missing: contains state string? unlikely with this data structure but safe
                        // warningLocs are usually specific.
                    }
                }

            } else {
                // Scenario B: User selected a SPECIFIC District.
                // Match if:
                // 1. Warning contains the exact District.
                // 2. Warning contains the State name (Broad warning covers all districts).
                
                if (warningLocs.includes(normalizedUserDistrict)) {
                    matchesLocation = true;
                } else if (warningLocs.includes(normalizedUserState)) {
                    matchesLocation = true; // State-wide warning includes the district
                }
            }

            if (!matchesLocation) return;

            // 3. Check if new
            // Using issued time + heading + valid_from as a signature
            const signature = `${warning.warning_issue.issued}_${warning.heading_en}`;
            
            if (!seenWarnings.has(signature)) {
                // IT'S A MATCH!
                this.sendNotification(warning);
                newSeen.add(signature);
                hasNew = true;
            }
        });

        if (hasNew) {
            this.saveSeenWarnings(newSeen);
        }
    }

    private static sendNotification(warning: DecodedWarning) {
        const title = `Thunderstorm Warning: ${warning.warning_issue.title_en}`;
        // Extract a clean body - maybe just the valid time or a snippet
        const body = warning.text_en; 

        new Notification(title, {
            body: body,
            icon: '/pwa-192x192.png', // Assuming pwa icon exists, or use default
            tag: 'weather-warning' // tagging can prevent stacking if desired, but we probably want distinct
        });
    }

    private static getSeenWarnings(): Set<string> {
        const raw = localStorage.getItem(this.STORAGE_KEY_SEEN);
        if (!raw) return new Set();
        try {
            return new Set(JSON.parse(raw));
        } catch {
            return new Set();
        }
    }

    private static saveSeenWarnings(seen: Set<string>) {
        // Limit set size to prevent infinite growth
        const arr = Array.from(seen);
        if (arr.length > 50) {
            // Keep last 50
            const trimmed = arr.slice(arr.length - 50);
            localStorage.setItem(this.STORAGE_KEY_SEEN, JSON.stringify(trimmed));
        } else {
            localStorage.setItem(this.STORAGE_KEY_SEEN, JSON.stringify(arr));
        }
    }
}
