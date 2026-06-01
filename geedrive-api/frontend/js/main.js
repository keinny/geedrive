import './state.js';
import './config.js';
import './api.js';
import './cache.js';

import * as utils from './utils.js';
import * as notifications from './notifications.js';
import * as dropdowns from './dropdowns.js';
import * as cars from './cars.js';
import * as drivers from './drivers.js';
import * as dashboard from './dashboard.js';
import * as weeklyLog from './weekly-log.js';
import * as navigation from './navigation.js';
import './modals.js';

Object.assign(window, {
    ...utils,
    ...notifications,
    ...dropdowns,
    ...cars,
    ...drivers,
    ...dashboard,
    ...weeklyLog,
    ...navigation,
});

// ── Single init entry point ───────────────────────────────────────
export function bootApp() {
    initializeForm();   // loads dropdowns, sets up mileage listeners, etc.
    setupNavigation();  // wires sidebar toggle + nav clicks
    lucide.createIcons(); // renders all <i data-lucide="..."> icons
}

window.bootApp = bootApp;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApp);
} else {
    bootApp();
}
