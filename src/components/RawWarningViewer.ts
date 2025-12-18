import type { DecodedWarning } from '../services/WeatherWarning';
import { LanguageService } from '../services/LanguageService';

export class RawWarningViewer {
    private container: HTMLElement;
    private content: HTMLElement;

    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'raw-warning-overlay';
        this.container.style.display = 'none';

        this.content = document.createElement('div');
        this.content.className = 'raw-warning-content glass-panel';
        
        this.container.appendChild(this.content);
        document.body.appendChild(this.container);

        // Close on click outside
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.hide();
            }
        });

        // Re-render on language change if visible
        LanguageService.getInstance().subscribe(() => {
             if (this.container.style.display !== 'none') {
                 // We don't have the warnings data here easily unless we store it.
                 // For now, next time it opens it will be correct. 
                 // Or we could store the last warnings.
                 // Let's store last warnings.
             }
        });
    }



    public show(warnings: DecodedWarning[]) {

        this.render(warnings);
        this.container.style.display = 'flex';
    }

    public hide() {
        this.container.classList.add('closing');

        this.container.addEventListener('animationend', () => {
            this.container.style.display = 'none';
            this.container.classList.remove('closing');
        }, { once: true });
    }

    private render(warnings: DecodedWarning[]) {
        const t = (key: string) => LanguageService.getInstance().translate(key);
        const lang = LanguageService.getInstance().getLanguage();
        const isBm = lang === 'bm';

        if (!warnings || warnings.length === 0) {
            this.content.innerHTML = `<div class="no-warnings">${t('no_warnings_data')}</div>`;
            return;
        }

        const itemsHtml = warnings.map(warning => `
            <div class="warning-item">
                <div class="warning-header" style="border-left: 4px solid ${this.getCategoryColor(warning.category)}">
                    <h4>${isBm ? warning.heading_bm : warning.heading_en}</h4>
                    <span class="warning-time">
                        ${this.formatTimeRange(warning.valid_from, warning.valid_to)}
                    </span>
                </div>
                <div class="warning-body">
                    <p>${isBm ? warning.text_bm : warning.text_en}</p>
                    ${
                        (isBm ? warning.instruction_bm : warning.instruction_en) 
                        ? `<p class="instruction"><em>${isBm ? warning.instruction_bm : warning.instruction_en}</em></p>` 
                        : ''
                    }
                    <div class="warning-meta">
                        <span class="badge category">${warning.category || 'N/A'}</span>
                        <span class="badge type">${warning.warningType || 'N/A'}</span>
                        <span class="locations">
                            ${t('locations')}: ${warning.locations.map(([loc]) => loc).join(', ')}
                        </span>
                    </div>
                </div>
            </div>
        `).join('');

        this.content.innerHTML = `
            <div class="raw-warning-header">
                <h2>${t('raw_data_header')} (${warnings.length})</h2>
                <button class="close-btn" id="close-raw-view"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="raw-warning-list">
                ${itemsHtml}
            </div>  
        `;

        this.content.querySelector('#close-raw-view')?.addEventListener('click', () => this.hide());
    }

    private getCategoryColor(category?: string): string {
        const categoryColors: Record<string, string> = {
            'first': '#FFEB3B',
            'second': '#FF9800',
            'third': '#F44336',
            'alert': '#9C27B0',
            'thunderstorm_warning': '#2196F3',
            'thunderstorm_watch': '#2196F3',
            'continuous_rain': '#4CAF50',
            'sea_level': '#00BCD4',
            'tropical_cyclone': '#9C27B0'
        };
        return categoryColors[category || 'first'] || '#666';
    }

    private formatTimeRange(from?: string, to?: string): string {
        const t = (key: string) => LanguageService.getInstance().translate(key);
        if (!from && !to) return '';
        
        const fromStr = from ? new Date(from).toLocaleString() : '';
        const toStr = to ? new Date(to).toLocaleString() : '';

        if (from && to) return `${fromStr} - ${toStr}`;
        if (from) return `${t('from')} ${fromStr}`;
        if (to) return `${t('until')} ${toStr}`;
        return '';
    }
}
