import translationsData from '../i18n/translations.json';

export type Language = 'en' | 'bm' | 'cn';

export class LanguageService {
    private static instance: LanguageService;
    private currentLang: Language = 'en';
    private listeners: ((lang: Language) => void)[] = [];

    private constructor() {
        // Load saved language
        const saved = localStorage.getItem('app_language');
        if (saved === 'en' || saved === 'bm' || saved === 'cn') {
            this.currentLang = saved;
        }
    }

    public static getInstance(): LanguageService {
        if (!LanguageService.instance) {
            LanguageService.instance = new LanguageService();
        }
        return LanguageService.instance;
    }

    public getLanguage(): Language {
        return this.currentLang;
    }

    public setLanguage(lang: Language) {
        if (this.currentLang === lang) return;
        
        this.currentLang = lang;
        localStorage.setItem('app_language', lang);
        this.notifyListeners();
    }

    public translate(key: string): string {
        const item = (translationsData as any)[key];
        if (!item) return key; // Fallback to key if not found
        return item[this.currentLang] || item['en'] || key;
    }

    public subscribe(listener: (lang: Language) => void) {
        this.listeners.push(listener);
        // Immediate callback
        listener(this.currentLang); 
    }

    public unsubscribe(listener: (lang: Language) => void) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.currentLang));
    }
}
