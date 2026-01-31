import { LanguageService } from '../services/LanguageService';
import { RainViewerService } from '../services/RainViewerService';

export type WarningCategory = 'first' | 'second' | 'third' | 'alert' | 'thunderstorm_warning' | 'thunderstorm_watch' | 'sea_level' | 'no_advisory' | 'continuous_rain' | 'tropical_cyclone';

export interface FilterState {
    categories: Set<string>;
    status: Set<'active' | 'expired'>;
}

export class WarningFilter {
    private container: HTMLElement;
    private state: FilterState;
    private activeTab: 'filter' | 'settings' | 'forecast' = 'filter';
    private activeForecastDay: number | null = null;

    private languageService: LanguageService;

    private onChange: (state: FilterState) => void;
    private onToggleRawView?: () => void;
    private onForecastSelect?: (dayIndex: number | null) => void;
    private onColorSchemeChange?: (id: number) => void;


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

    constructor(
        onChange: (state: FilterState) => void, 
        onToggleRawView?: () => void,
        onForecastSelect?: (dayIndex: number | null) => void,
        defaultActiveCategories?: string[],
        onColorSchemeChange?: (id: number) => void
    ) {
        this.onChange = onChange;
        this.onToggleRawView = onToggleRawView;
        this.onForecastSelect = onForecastSelect;
        this.onColorSchemeChange = onColorSchemeChange;
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
        // Save scroll position of active tab before re-render
        let previousScrollTop = 0;
        const activeContent = this.container.querySelector(`.tab-content[data-tab="${this.activeTab}"]`);
        if (activeContent) {
            previousScrollTop = activeContent.scrollTop;
        }

        const t = (key: string) => this.languageService.translate(key);
        
        this.container.innerHTML = `
            <div class="filter-header">
                <h3>${t('control_panel')}</h3>
                <button id="toggle-filter" class="icon-btn" aria-label="Toggle Panel"><i class="bi bi-gear-fill"></i></button>
            </div>
            
            <div class="filter-tabs">
                <button class="tab-btn ${this.activeTab === 'filter' ? 'active' : ''}" data-tab="filter">${t('filter')}</button>
                <button class="tab-btn ${this.activeTab === 'forecast' ? 'active' : ''}" data-tab="forecast">${t('forecast')}</button>
                <button class="tab-btn ${this.activeTab === 'settings' ? 'active' : ''}" data-tab="settings">${t('settings')}</button>
            </div>


            <div class="filter-content tab-content" data-tab="filter" style="${this.activeTab === 'filter' ? '' : 'display: none;'}">
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

            <div class="filter-content tab-content" data-tab="forecast" style="${this.activeTab === 'forecast' ? '' : 'display: none;'}">
                 <div class="filter-section">
                    <h5>${t('seven_days_forecast')}</h5>
                    <div class="forecast-days-list" style="display: flex; flex-direction: column; gap: 8px;">
                        ${this.renderForecastDays()}
                    </div>
                </div>
            </div>



            <div class="filter-content tab-content" data-tab="settings" style="${this.activeTab === 'settings' ? '' : 'display: none;'}">

                <div class="filter-section">
                    <h5>${t('language')}</h5>
                    <div class="language-toggle">
                         <button class="lang-btn btn btn-outline-light btn-sm ${this.languageService.getLanguage() === 'en' ? 'active' : ''}" data-lang="en">English</button>
                         <button class="lang-btn btn btn-outline-light btn-sm ${this.languageService.getLanguage() === 'bm' ? 'active' : ''}" data-lang="bm">Bahasa</button>
                         <button class="lang-btn btn btn-outline-light btn-sm ${this.languageService.getLanguage() === 'cn' ? 'active' : ''}" data-lang="cn">中文</button>
                    </div>
                </div>

                <div class="filter-section">
                    <h5>${t('radar_color')}</h5>
                    <select id="radar-color-select" class="form-select" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.1); color: #e0e0e0; border: 1px solid rgba(255,255,255,0.2);">
                        ${RainViewerService.COLOR_SCHEMES.map(s => `<option value="${s.id}" ${RainViewerService.colorScheme === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                </div>

                <div class="filter-section">
                    <h5>${t('ui_settings')}</h5>
                    <label class="checkbox-container">
                        <input type="checkbox" id="playback-ui-toggle" ${this.getPlaybackSetting() ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        ${t('show_playback_controls')}
                    </label>
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

        // Restore scroll position
        const newActiveContent = this.container.querySelector(`.tab-content[data-tab="${this.activeTab}"]`);
        if (newActiveContent) {
            newActiveContent.scrollTop = previousScrollTop;
        }
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
                const tab = target.dataset.tab as 'filter' | 'settings' | 'forecast';
                this.activeTab = tab;
                
                // Trigger forecast clear if leaving forecast tab?
                // Or trigger warning show if entering filter tab?
                // Logic:
                // If switching TO forecast: We likely want to show the last selected day or default to Day 1? 
                //    But user has to click a day to select. 
                // If switching TO filter: We want to show warnings.
                
                if (tab === 'filter') {
                     // Mode A: Warnings
                     if (this.onForecastSelect) this.onForecastSelect(null);
                     this.activeForecastDay = null; // Reset selection visualization
                } 
                // If switching TO forecast, wait for user to select day? 
                // Or auto select day 0? 
                // Let's force user to select for now, or just show list. 
                
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

        // Forecast Day Buttons
        this.container.querySelectorAll('.forecast-day-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement; // Use currentTarget because button has children
                const index = parseInt(target.dataset.index || '0');
                this.activeForecastDay = index;
                if (this.onForecastSelect) this.onForecastSelect(index);
                this.render();
            });
        });
        // Radar Color Select
        const radarColorSelect = this.container.querySelector('#radar-color-select');
        radarColorSelect?.addEventListener('change', (e) => {
            const val = parseInt((e.target as HTMLSelectElement).value);
            if (this.onColorSchemeChange) this.onColorSchemeChange(val);
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
    
    private renderForecastDays(): string {
        let html = '';
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            const dateStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
            const isSelected = this.activeForecastDay === i;
            
            html += `
                <button class="forecast-day-btn btn ${isSelected ? 'btn-primary' : 'btn-ghost'}" data-index="${i}" style="text-align: left; padding: 10px; justify-content: flex-start;">
                    <div style="font-weight: bold;">${dayName} - Day ${i + 1}</div>
                    <div style="font-size: 0.8em; opacity: 0.8;">${dateStr}</div>
                </button>
            `;
        }
        return html;
    }
}

