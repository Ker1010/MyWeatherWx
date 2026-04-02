import { LanguageService } from '../services/LanguageService';

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
    private onMapStyleChange?: (style: string) => void;
    private onWindToggle?: (visible: boolean) => void;

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
        onMapStyleChange?: (style: string) => void,
        onWindToggle?: (visible: boolean) => void
    ) {
        this.onChange = onChange;
        this.onToggleRawView = onToggleRawView;
        this.onForecastSelect = onForecastSelect;
        this.onMapStyleChange = onMapStyleChange;
        this.onWindToggle = onWindToggle;
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
        
        // Apply saved settings on init
        this.applyPlaybackSetting();
        
        setTimeout(() => {
            if (this.onMapStyleChange) {
                this.onMapStyleChange(this.getMapStyleSetting());
            }
            if (this.onWindToggle) {
                this.onWindToggle(this.getWindSetting());
            }
        }, 100);

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


            <div class="filter-content tab-content ${this.activeTab === 'filter' ? 'active' : ''}" data-tab="filter">
                <div class="filter-section">
                    <h5>${t('actions')}</h5>
                    <button id="view-raw-btn" class="action-btn btn btn-primary w-100">
                        <i class="bi bi-list"></i> ${t('view_raw_data')}
                    </button>
                </div>
                <div class="filter-section">
                    <div class="d-flex align-items-center gap-1">
                        <h5>${t('categories')}</h5>
                        <button id="category-info-btn" class="category-heading-info-btn" aria-label="Category information">!</button>
                    </div>
                    ${this.renderCategories()}
                </div>
                <hr>
                <div class="filter-section">
                    <label class="checkbox-container">
                        <input type="checkbox" id="wind-direction-toggle" ${this.getWindSetting() ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        ${t('show_wind_arrows')}
                    </label>
                </div>
            </div>

            <div class="filter-content tab-content ${this.activeTab === 'forecast' ? 'active' : ''}" data-tab="forecast">
                 <div class="filter-section">
                    <h5>${t('seven_days_forecast')}</h5>
                    <div class="forecast-days-list" style="display: flex; flex-direction: column; gap: 8px;">
                        ${this.renderForecastDays()}
                    </div>
                </div>
            </div>



            <div class="filter-content tab-content ${this.activeTab === 'settings' ? 'active' : ''}" data-tab="settings">
                <div class="filter-section">
                    <h5>${t('map_style')}</h5>
                    <div class="d-flex gap-1">
                        <div class="map-style-card ${this.getMapStyleSetting() === 'dark' ? 'active' : ''}" data-style="dark">
                            <div class="map-preview-img" style="background-image: url('/assets/map-preview-dark.png');"></div>
                            <div class="map-style-title">${t('vector_dark')}</div>
                        </div>
                        <div class="map-style-card ${this.getMapStyleSetting() === 'esri_dark' ? 'active' : ''}" data-style="esri_dark">
                            <div class="map-preview-img" style="background-image: url('/assets/map-preview-esri.png');"></div>
                            <div class="map-style-title">${t('simple_dark')}</div>
                        </div>
                        <div class="map-style-card ${this.getMapStyleSetting() === 'satellite' ? 'active' : ''}" data-style="satellite">
                            <div class="map-preview-img" style="background-image: url('/assets/map-preview-satellite.png');"></div>
                            <div class="map-style-title">${t('satellite')}</div>
                        </div>
                    </div>
                </div>
                <div class="filter-section">
                    <h5>${t('language')}</h5>
                    <div class="language-toggle">
                         <button class="lang-btn btn btn-outline-light btn-sm ${this.languageService.getLanguage() === 'en' ? 'active' : ''}" data-lang="en">English</button>
                         <button class="lang-btn btn btn-outline-light btn-sm ${this.languageService.getLanguage() === 'bm' ? 'active' : ''}" data-lang="bm">Bahasa</button>
                         <button class="lang-btn btn btn-outline-light btn-sm ${this.languageService.getLanguage() === 'cn' ? 'active' : ''}" data-lang="cn">中文</button>
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

    private getMapStyleSetting(): string {
        return localStorage.getItem('map_style') || 'dark';
    }

    private getWindSetting(): boolean {
        const saved = localStorage.getItem('show_wind_arrows');
        return saved === 'true';
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
        const playbackToggle = this.container.querySelector('#playback-ui-toggle') as HTMLInputElement;
        playbackToggle?.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            localStorage.setItem('playback_ui_enabled', checked.toString());
            this.applyPlaybackSetting();
        });

        const windToggle = this.container.querySelector('#wind-direction-toggle') as HTMLInputElement;
        windToggle?.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            localStorage.setItem('show_wind_arrows', checked.toString());
            if (this.onWindToggle) {
                this.onWindToggle(checked);
            }
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

        // Map Style Card Selection
        this.container.querySelectorAll('.map-style-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const style = target.dataset.style || 'dark';
                
                // Update local storage
                localStorage.setItem('map_style', style);
                
                // Update map
                if (this.onMapStyleChange) this.onMapStyleChange(style);
                
                // Update UI state
                this.render();
            });
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

        // Category Info Button (heading)
        const catInfoBtn = this.container.querySelector('#category-info-btn');
        catInfoBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showCategoryInfoModal();
        });
    }


    private showCategoryInfoModal() {
        // Remove existing
        document.querySelectorAll('.category-info-modal-overlay').forEach(el => el.remove());

        const t = (key: string) => this.languageService.translate(key);

        const items: { color: string; icon: string; labelKey: string; descKey: string }[] = [
            { color: '#FFEB3B', icon: 'bi-wind', labelKey: 'first_category',        descKey: 'desc_first' },
            { color: '#FF9800', icon: 'bi-water', labelKey: 'second_category',       descKey: 'desc_second' },
            { color: '#F44336', icon: 'bi-tsunami', labelKey: 'third_category',        descKey: 'desc_third' },
            { color: '#2196F3', icon: 'bi-cloud-lightning-rain-fill', labelKey: 'thunderstorm_warning',  descKey: 'desc_thunderstorm_warning' },
            { color: '#2196F3', icon: 'bi-cloud-lightning-fill', labelKey: 'thunderstorm_watch',    descKey: 'desc_thunderstorm_watch' },
            { color: '#4CAF50', icon: 'bi-cloud-rain-heavy-fill', labelKey: 'continuous_rain',       descKey: 'desc_continuous_rain' },
            { color: '#00BCD4', icon: 'bi-water', labelKey: 'sea_level_rise',        descKey: 'desc_sea_level' },
            { color: '#9C27B0', icon: 'bi-hurricane', labelKey: 'tropical_cyclone',      descKey: 'desc_tropical_cyclone' },
            { color: '#9C27B0', icon: 'bi-bell-fill', labelKey: 'alert',                 descKey: 'desc_alert' },
        ];

        const itemsHtml = items.map(item => `
            <div class="info-card" style="--card-color: ${item.color};">
                <div class="info-card-icon">
                    <i class="bi ${item.icon}"></i>
                </div>
                <div class="info-card-content">
                    <h4>${t(item.labelKey)}</h4>
                    <p>${t(item.descKey)}</p>
                </div>
            </div>
        `).join('');

        const overlay = document.createElement('div');
        overlay.className = 'category-info-modal-overlay';
        overlay.innerHTML = `
            <div class="category-info-modal distinct-modal">
                <div class="cat-modal-header">
                    <h3><i class="bi bi-info-square-fill" style="color: #2196f3; margin-right: 10px; font-size: 18px;"></i>${t('category_info_title')}</h3>
                    <button class="close-btn cat-modal-close" aria-label="Close"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="cat-modal-grid">
                    ${itemsHtml}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(() => overlay.classList.add('visible'));

        const close = () => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
        };

        overlay.querySelector('.cat-modal-close')?.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
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
                    <div style="font-weight: bold;">${dayName} - Day ${i}</div>
                    <div style="font-size: 0.8em; opacity: 0.8;">${dateStr}</div>
                </button>
            `;
        }
        return html;
    }
}

