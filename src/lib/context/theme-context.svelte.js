class ThemeContext {
    /** @type {'system' | 'light' | 'dark'} */
    theme = $state('system');

    init() {
        if (typeof localStorage === 'undefined') return;
        const saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
            this.theme = saved;
        }
        this.#apply();
    }

    /** @param {'system' | 'light' | 'dark'} t */
    set(t) {
        this.theme = t;
        localStorage.setItem('theme', t);
        this.#apply();
    }

    #apply() {
        const html = document.documentElement;
        html.classList.remove('theme-light', 'theme-dark');
        if (this.theme === 'dark') html.classList.add('theme-dark');
        if (this.theme === 'light') html.classList.add('theme-light');
    }
}

export const themeContext = new ThemeContext();
