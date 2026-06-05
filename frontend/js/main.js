import { setupCars } from './cars.js';
import { setupDrivers } from './drivers.js';
import { setupDropdowns } from './dropdowns.js';
import { setupAppEvents } from './events.js';
import { setupModals } from './modals.js';
import * as navigation from './navigation.js';
import { initializeForm, setupWeeklyLog } from './weekly-log.js';
import { initTheme, setupThemePicker } from './theme.js';

initTheme();

// ── Single init entry point ───────────────────────────────────────
export function bootApp() {
    setupCars();
    setupDrivers();
    setupDropdowns();
    setupWeeklyLog();
    initializeForm();   // loads dropdowns, sets up mileage listeners, etc.
    navigation.switchTab('dashboard', 'System Dashboard');
    navigation.setupNavigation();  // wires sidebar toggle + nav clicks
    setupModals();
    setupAppEvents();
    setupThemePicker();
    lucide.createIcons(); // renders all <i data-lucide="..."> icons
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApp);
} else {
    bootApp();
}
