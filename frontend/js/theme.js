const THEME_KEY = 'gdTheme';
const THEME_DEFAULT_KEY = 'gdThemeDefaultVersion';
const DEFAULT_THEME = 'system';

function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(themeName) {
    return themeName === 'system' ? getSystemTheme() : themeName;
}

function updateThemeButtons(themePreference) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        const active = btn.dataset.theme === themePreference;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function applyTheme(themePreference) {
    const resolvedTheme = resolveTheme(themePreference);
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;
    updateThemeButtons(themePreference);
}

function bindSystemThemeListener() {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
        if (localStorage.getItem(THEME_KEY) === 'system') {
            applyTheme('system');
        }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleChange);
    } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleChange);
    }
}

export function initTheme() {
    let theme = localStorage.getItem(THEME_KEY);
    if (!['light', 'dark', 'system'].includes(theme)) {
        theme = DEFAULT_THEME;
    }

    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(THEME_DEFAULT_KEY, DEFAULT_THEME);
    applyTheme(theme);
    bindSystemThemeListener();
}

export function setTheme(name) {
    const theme = ['light', 'dark', 'system'].includes(name) ? name : DEFAULT_THEME;
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
}

export function setupThemePicker() {
    const themePreference = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
    updateThemeButtons(themePreference);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => setTheme(btn.dataset.theme));
    });
}
