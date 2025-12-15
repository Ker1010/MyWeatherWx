export type WarningCategory = 'first' | 'second' | 'third' | 'alert' | 'thunderstorm_warning' | 'thunderstorm_watch' | 'sea_level' | 'no_advisory' | 'continuous_rain' | 'tropical_cyclone';

export interface FilterState {
    categories: Set<string>;
    status: Set<'active' | 'expired'>;
}

export class WarningFilter {
    private container: HTMLElement;
    private state: FilterState;

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

    constructor(onChange: (state: FilterState) => void, onToggleRawView?: () => void) {
        this.onChange = onChange;
        this.onToggleRawView = onToggleRawView;
        
        // Initialize with all IDs (including sub-items)
        const allIds = WarningFilter.CATEGORIES.flatMap(c => {
            if (c.subItems) return c.subItems.map(s => s.id);
            return [c.id!];
        });
        
        this.state = {
            categories: new Set(allIds),
            status: new Set(['active']) // Default to active only
        };

        this.container = document.createElement('div');
        this.container.className = 'warning-filter glass-panel';
        this.render();
        
        document.body.appendChild(this.container);

        // Auto-collapse on mobile
        if (window.innerWidth <= 768) {
            this.container.classList.add('collapsed');
        }
        
        // Initial trigger
        this.onChange(this.state);
    }

    private render() {
        this.container.innerHTML = `
            <div class="filter-header">
                <h3>Warning Filters</h3>
                <button id="toggle-filter" class="icon-btn"><i class="bi bi-gear-fill"></i></button>
            </div>
            <div class="filter-content">
                <div class="filter-section">
                    <h4>Actions</h4>
                    <button id="view-raw-btn" class="action-btn btn btn-primary">
                        <i class="bi bi-list"></i> View Raw Data
                    </button>
                </div>
                <div class="filter-section">
                    <h4>Categories</h4>
                    ${this.renderCategories()}
                </div>
            </div>
        `;

        // Attach event listeners
        this.container.querySelectorAll('input[type="checkbox"]').forEach(el => {
            el.addEventListener('change', (e) => this.handleCheckboxChange(e));
        });

        const toggleBtn = this.container.querySelector('#toggle-filter');
        toggleBtn?.addEventListener('click', () => {
            this.container.classList.toggle('collapsed');
        });

        const rawBtn = this.container.querySelector('#view-raw-btn');
        rawBtn?.addEventListener('click', () => {
            if (this.onToggleRawView) this.onToggleRawView();
        });

        const eyeBtn = this.container.querySelector('#toggle-warning'); 
        if (eyeBtn) {
             eyeBtn.addEventListener('click', () => {
                if (this.onToggleRawView) this.onToggleRawView();
            });
        }
    }

    private renderCategories(): string {
        return WarningFilter.CATEGORIES.map(cat => {
            if (cat.subItems) {
                // Render Group
                const subItemsHtml = cat.subItems.map(sub => `
                    <label class="checkbox-container sub-item">
                        <input type="checkbox" value="${sub.id}" ${this.state.categories.has(sub.id) ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        ${sub.label}
                    </label>
                `).join('');

                return `
                    <div class="category-group">
                        <span class="group-label">${cat.label}</span>
                        ${subItemsHtml}
                    </div>
                `;
            } else {
                // Render Single Item
                return `
                    <label class="checkbox-container">
                        <input type="checkbox" value="${cat.id}" ${this.state.categories.has(cat.id!) ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        ${cat.label}
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

        this.onChange(this.state);
    }
}
