export type WarningCategory = 'first' | 'second' | 'third' | 'alert' | 'thunderstorm' | 'sea_level' | 'no_advisory' | 'continuous_rain' | 'tropical_cyclone';

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
    private static CATEGORIES: { id: string; label: string }[] = [
        { id: 'first', label: 'First Category (Strong Wind/Rough Sea)' },
        { id: 'second', label: 'Second Category (Strong Wind/Rough Sea)' },
        { id: 'third', label: 'Third Category (Strong Wind/Rough Sea)' },
        { id: 'thunderstorm', label: 'Thunderstorm' },
        { id: 'continuous_rain', label: 'Continuous Rain' },
        { id: 'sea_level', label: 'Sea Level Rise' },
        { id: 'tropical_cyclone', label: 'Tropical Cyclone' },
        { id: 'alert', label: 'Alert' },
    ];

    constructor(onChange: (state: FilterState) => void, onToggleRawView?: () => void) {
        this.onChange = onChange;
        this.onToggleRawView = onToggleRawView;
        this.state = {
            categories: new Set(WarningFilter.CATEGORIES.map(c => c.id)),
            status: new Set(['active']) // Default to active only
        };

        this.container = document.createElement('div');
        this.container.className = 'warning-filter glass-panel';
        this.render();
        
        document.body.appendChild(this.container);
        
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
                    ${WarningFilter.CATEGORIES.map(cat => `
                        <label class="checkbox-container">
                            <input type="checkbox" value="${cat.id}" checked>
                            <span class="checkmark"></span>
                            ${cat.label}
                        </label>
                    `).join('')}
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
