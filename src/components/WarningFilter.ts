import { LanguageService } from '../services/LanguageService';
import { NotificationService } from '../services/NotificationService';

export type WarningCategory = 'first' | 'second' | 'third' | 'alert' | 'thunderstorm_warning' | 'thunderstorm_watch' | 'sea_level' | 'no_advisory' | 'continuous_rain' | 'tropical_cyclone';

export interface FilterState {
    categories: Set<string>;
    status: Set<'active' | 'expired'>;
}

export class WarningFilter {
    private container: HTMLElement;
    private state: FilterState;
    private activeTab: 'filter' | 'settings' = 'filter';
    private languageService: LanguageService;

    private onChange: (state: FilterState) => void;
    private onToggleRawView?: () => void;

    // Ordered categories for display
    private static CATEGORIES: { 
        id?: string; 
        label: string;
        subItems?: { id: string; label: string }[] 
    }[] = [
        { id: 'first', label: 'First Category (Strong Wind/Rough Sea)' },
        { id: 'second', label: 'Second Category (Strong Wind/Rough Sea)' },
        { id: 'third', label: 'Third Category (Strong Wind/Rough Sea)' },
        { 
            label: 'Thunderstorm',
            subItems: [
                { id: 'thunderstorm_warning', label: 'Warning' },
                { id: 'thunderstorm_watch', label: 'Watch' }
            ]
        },
        { id: 'continuous_rain', label: 'Continuous Rain' },
        { id: 'sea_level', label: 'Sea Level Rise' },
        { id: 'tropical_cyclone', label: 'Tropical Cyclone' },
        { id: 'alert', label: 'Alert' },
    ];

    private static STATES = [
        "Perlis", "Kedah", "Pulau Pinang", "Perak", "Selangor", 
        "Kuala Lumpur", "Putrajaya", "Negeri Sembilan", "Melaka", 
        "Johor", "Pahang", "Terengganu", "Kelantan", "Sabah", 
        "Sarawak", "Labuan"
    ];

    private regionMapping: Record<string, string[]> = {};

    constructor(
        onChange: (state: FilterState) => void, 
        onToggleRawView?: () => void,
        defaultActiveCategories?: string[]
    ) {
        this.onChange = onChange;
        this.onToggleRawView = onToggleRawView;
        this.languageService = LanguageService.getInstance();
        
        // Initialize with provided defaults or all IDs
        const allIds = WarningFilter.CATEGORIES.flatMap(c => {
            if (c.subItems) return c.subItems.map(s => s.id);
            return [c.id!];
        });

        // Load from local storage
        const savedFilter = localStorage.getItem('weather_warning_filter');
        let initialCategories = defaultActiveCategories ?? allIds;

        if (savedFilter) {
            try {
                const parsed = JSON.parse(savedFilter);
                if (Array.isArray(parsed)) {
                    initialCategories = parsed;
                }
            } catch (e) {
                console.error("Failed to parse saved filter", e);
            }
        }
        
        this.state = {
            categories: new Set(initialCategories),
            status: new Set(['active']) // Default to active only
        };

        this.container = document.createElement('div');
        this.container.className = 'warning-filter glass-panel collapsed';
        this.render();
        
        document.body.appendChild(this.container);
        
        // Apply saved playback setting on init
        this.applyPlaybackSetting();

        // Subscribe to language changes
        this.languageService.subscribe(() => {
            this.render();
        });
        
        // Initial trigger
        this.onChange(this.state);

        // Fetch region mapping
        fetch('/region_mapping.json')
            .then(res => res.json())
            .then(data => {
                this.regionMapping = data;
                // If the panel is open and on settings, calling render might be nice, 
                // but usually user isn't there yet.
            })
            .catch(err => console.error("Failed to load region mapping", err));
    }

    private applyPlaybackSetting() {
        // Default to true if not set
        const saved = localStorage.getItem('playback_ui_enabled');
        const isEnabled = saved !== 'false'; // "true" or null -> true
        
        const playbackControl = document.querySelector('.playback-control') as HTMLElement;
        if (playbackControl) {
            playbackControl.style.display = isEnabled ? 'flex' : 'none';
        }
    }

    private render() {
        const isFilterActive = this.activeTab === 'filter';
        const t = (key: string) => this.languageService.translate(key);
        
        this.container.innerHTML = `
            <div class="filter-header">
                <h3>${t('control_panel')}</h3>
                <button id="toggle-filter" class="icon-btn" aria-label="Toggle Panel"><i class="bi bi-gear-fill"></i></button>
            </div>
            
            <div class="filter-tabs">
                <button class="tab-btn ${isFilterActive ? 'active' : ''}" data-tab="filter">${t('filter')}</button>
                <button class="tab-btn ${!isFilterActive ? 'active' : ''}" data-tab="settings">${t('settings')}</button>
            </div>

            <div class="filter-content tab-content" data-tab="filter" style="${isFilterActive ? '' : 'display: none;'}">
                <div class="filter-section">
                    <h5>${t('actions')}</h5>
                    <button id="view-raw-btn" class="action-btn btn btn-primary w-100">
                        <i class="bi bi-list"></i> ${t('view_raw_data')}
                    </button>
                </div>
                <div class="filter-section">
                    <h5>${t('categories')}</h5>
                    ${this.renderCategories()}
                </div>
            </div>

            <div class="filter-content tab-content" data-tab="settings" style="${!isFilterActive ? '' : 'display: none;'}">
                <div class="filter-section">
                    <h5>${t('language')}</h5>
                    <div class="language-toggle">
                         <button class="lang-btn btn btn-outline-light btn-sm ${this.languageService.getLanguage() === 'en' ? 'active' : ''}" data-lang="en">English</button>
                         <button class="lang-btn btn btn-outline-light btn-sm ${this.languageService.getLanguage() === 'bm' ? 'active' : ''}" data-lang="bm">Bahasa</button>
                    </div>
                </div>

                <div class="filter-section">
                    <h5>${t('ui_settings')}</h5>
                    <label class="checkbox-container">
                        <input type="checkbox" id="playback-ui-toggle" ${this.getPlaybackSetting() ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        ${t('show_playback_controls')}
                    </label>
                </div>
                
                
                <div class="filter-section" style="display: block !important;">
                    <h5>${t('notifications')}</h5>
                    <label class="checkbox-container">
                        <input type="checkbox" id="notification-toggle" ${NotificationService.getSettings().enabled ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        ${t('enable_notifications')}
                    </label>
                    <div id="state-selector-container" style="margin-top: 10px; display: ${NotificationService.getSettings().enabled ? 'block' : 'none'};">
                        <label for="state-select" style="font-size: 0.9em; margin-bottom: 5px; display: block; color: var(--text-secondary);">${t('select_state')}</label>
                        <select id="state-select" class="form-select" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.2);">
                            <option value="">-- ${t('select_state')} --</option>
                            ${WarningFilter.STATES.map(s => `<option value="${s}" ${NotificationService.getSettings().state === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                        
                        <div id="district-selector-container" style="margin-top: 10px; display: ${NotificationService.getSettings().state ? 'block' : 'none'};">
                            <label for="district-select" style="font-size: 0.9em; margin-bottom: 5px; display: block; color: var(--text-secondary);">${t('select_district')}</label>
                            <select id="district-select" class="form-select" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.2);">
                                ${this.renderDistrictOptions(NotificationService.getSettings().state, NotificationService.getSettings().district, t)}
                            </select>
                        </div>
                    </div>
                </div>

                <div class="filter-section">
                    <h5>${t('storage')}</h5>
                    <button id="clear-data-btn" class="action-btn btn btn-danger w-100" style="background: rgba(255, 87, 87, 0.15); color: #ff8a8a; border: 1px solid rgba(255, 87, 87, 0.3);">
                        <i class="bi bi-trash"></i> ${t('clear_data')}
                    </button>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    private getPlaybackSetting(): boolean {
        const saved = localStorage.getItem('playback_ui_enabled');
        return saved !== 'false';
    }

    private attachEventListeners() {
        // Tab Switching
        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const tab = target.dataset.tab as 'filter' | 'settings';
                this.activeTab = tab;
                this.render(); // Re-render to update UI state
            });
        });

        // Language Switching
        this.container.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const lang = target.dataset.lang as 'en' | 'bm';
                this.languageService.setLanguage(lang);
            });
        });

        // Filter Checkboxes
        this.container.querySelectorAll('input[type="checkbox"]:not(#playback-ui-toggle)').forEach(el => {
            el.addEventListener('change', (e) => this.handleCheckboxChange(e));
        });

        // Settings Toggles
        const playbackToggle = this.container.querySelector('#playback-ui-toggle');
        playbackToggle?.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            localStorage.setItem('playback_ui_enabled', checked.toString());
            this.applyPlaybackSetting();
            this.applyPlaybackSetting();
        });

        // Notification Toggles
        const notifToggle = this.container.querySelector('#notification-toggle');
        const stateSelect = this.container.querySelector('#state-select');
        const stateContainer = this.container.querySelector('#state-selector-container') as HTMLElement;

        notifToggle?.addEventListener('change', async (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            if (checked) {
                const granted = await NotificationService.enableNotifications();
                if (!granted) {
                    (e.target as HTMLInputElement).checked = false;
                    alert(this.languageService.translate('notification_permission_denied'));
                    return;
                }
                if (stateContainer) stateContainer.style.display = 'block';
            } else {
                NotificationService.disableNotifications();
                if (stateContainer) stateContainer.style.display = 'none';
            }
        });

        stateSelect?.addEventListener('change', (e) => {
            const val = (e.target as HTMLSelectElement).value;
            NotificationService.setState(val);
            this.render(); // Re-render to update district list
        });
        
        const districtSelect = this.container.querySelector('#district-select');
        districtSelect?.addEventListener('change', (e) => {
            const val = (e.target as HTMLSelectElement).value;
            NotificationService.setDistrict(val);
        });

        // Clear Data
        const clearBtn = this.container.querySelector('#clear-data-btn');
        clearBtn?.addEventListener('click', () => {
            this.showConfirmModal(
                this.languageService.translate('confirm_clear_data'),
                () => {
                    localStorage.clear();
                    location.reload();
                }
            );
        });

        // Panel Toggle
        const toggleBtn = this.container.querySelector('#toggle-filter');
        toggleBtn?.addEventListener('click', () => {
            this.container.classList.toggle('collapsed');
        });

        // Raw View Button
        const rawBtn = this.container.querySelector('#view-raw-btn');
        rawBtn?.addEventListener('click', () => {
             if (this.onToggleRawView) this.onToggleRawView();
        });
    }

    private showConfirmModal(message: string, onConfirm: () => void) {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        const proceedBtn = document.getElementById('confirm-proceed-btn');
        const closeBtns = document.querySelectorAll('.close-confirm');

        if (!modal || !msgEl || !proceedBtn) return;

        msgEl.innerText = message;
        modal.classList.remove('hidden');

        // Clean up previous listeners to prevent duplicates if any
        const newProceedBtn = proceedBtn.cloneNode(true);
        proceedBtn.parentNode?.replaceChild(newProceedBtn, proceedBtn);
        
        newProceedBtn.addEventListener('click', () => {
            onConfirm();
            modal.classList.add('hidden');
        });

        const closeModal = () => {
            modal.classList.add('hidden');
        };

        closeBtns.forEach(btn => {
            // Clone to remove listeners not strictly necessary if we just add one, 
            // but cleaner to ensure no stacking. Simple add is fine for close.
            btn.addEventListener('click', closeModal, { once: true }); 
        });
        
        // Close on background click
        const handleOutsideClick = (e: MouseEvent) => {
             if (e.target === modal) {
                 closeModal();
                 modal.removeEventListener('click', handleOutsideClick);
             }
        };
        modal.addEventListener('click', handleOutsideClick);
    }

    private renderCategories(): string {
        const t = (key: string) => this.languageService.translate(key);
        
        // Define localized labels based on IDs
        const getLabel = (id: string, def: string) => {
            if (id === 'first') return t('first_category');
            if (id === 'second') return t('second_category');
            if (id === 'third') return t('third_category');
            if (id === 'thunderstorm_warning') return t('thunderstorm_warning');
            if (id === 'thunderstorm_watch') return t('thunderstorm_watch');
            if (id === 'continuous_rain') return t('continuous_rain');
            if (id === 'sea_level') return t('sea_level_rise');
            if (id === 'tropical_cyclone') return t('tropical_cyclone');
            if (id === 'alert') return t('alert');
            return def; 
        };

        return WarningFilter.CATEGORIES.map(cat => {
            if (cat.subItems) {
                // Render Group
                const groupLabel = cat.label === 'Thunderstorm' ? t('thunderstorm') : cat.label;

                const subItemsHtml = cat.subItems.map(sub => `
                    <label class="checkbox-container sub-item">
                        <input type="checkbox" value="${sub.id}" ${this.state.categories.has(sub.id) ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        ${getLabel(sub.id, sub.label)}
                    </label>
                `).join('');

                return `
                    <div class="category-group">
                        <span class="group-label">${groupLabel}</span>
                        ${subItemsHtml}
                    </div>
                `;
            } else {
                // Render Single Item
                return `
                    <label class="checkbox-container">
                        <input type="checkbox" value="${cat.id}" ${this.state.categories.has(cat.id!) ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        ${getLabel(cat.id!, cat.label)}
                    </label>
                `;
            }
        }).join('');
    }

    private handleCheckboxChange(e: Event) {
        const target = e.target as HTMLInputElement;
        const val = target.value;
        const checked = target.checked;

        if (val === 'active' || val === 'expired') {
             // Retired
        } else {
            if (checked) this.state.categories.add(val);
            else this.state.categories.delete(val);
        }

        // Save to localStorage
        localStorage.setItem('weather_warning_filter', JSON.stringify(Array.from(this.state.categories)));

        this.onChange(this.state);
    }
    private renderDistrictOptions(state: string, currentDistrict: string, t: (key: string) => string): string {
        if (!state) return `<option value="">-- ${t('select_district')} --</option>`;

        const normalizedState = state.toLowerCase().replace(/\s+/g, '-');
        // Region mapping keys are typically strict "johor", "kedah". The states list has "Johor".
        // Need to be careful. region_mapping from public folder keys: "johor", "kedah", "hulu-perak" not quite matching state list perfectly?
        // Let's check region_mapping structure previously read.
        // It has "johor", "pahang", "terengganu", etc. Lowercase, dashed.
        
        // Handle Federal Territories special cases if any
        // Kuala Lumpur -> ft-kuala-lumpur? in mapping: "ft-kuala-lumpur" is inside "selangor"? Wait, KL is usually separate.
        // Let's check the partial read. "selangor" has "ft-kuala-lumpur".
        // If user selects "Kuala Lumpur", regionMapping["kuala-lumpur"] might not exist?
        // Actually, for Malaysia warnings, KL is often its own entity. 
        // If mapping doesn't have it as a key, return empty.
        
        let targetKey = normalizedState;
        if (state === "Kuala Lumpur") targetKey = "ft-kuala-lumpur";
        if (state === "Putrajaya") targetKey = "ft-putrajaya";
        if (state === "Labuan") targetKey = "wp-labuan";

        const districts = this.regionMapping[targetKey] || [];
        
        // Sort districts A-Z
        districts.sort();

        // Title Case Helper
        const toTitleCase = (str: string) => str.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        const allOption = `<option value="">${t('all_state')} ${state}</option>`;
        const opts = districts.map(d => `<option value="${d}" ${currentDistrict === d ? 'selected' : ''}>${toTitleCase(d)}</option>`).join('');
        
        return allOption + opts;
    }
}
