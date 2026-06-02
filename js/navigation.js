import { loadCarsData } from './cars.js';
import { loadDashboardData } from './dashboard.js';
import { loadDriversData } from './drivers.js';
import { loadCarsData_Init, loadDriversData_Init } from './dropdowns.js';
import { resetCarsFilters, resetDriversFilters } from './state.js';

export function switchTab(tabName, tabLabel) {
    document.querySelectorAll('.nav-item-btn').forEach(btn => btn.classList.remove('active'));
    const clickedBtn = document.querySelector(`.nav-item-btn[data-tab="${tabName}"]`);
    if (clickedBtn) clickedBtn.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const panel = document.getElementById(tabName);
    if (panel) panel.classList.add('active');

    const breadcrumbLabel = document.getElementById('breadcrumbActiveLabel');
    if (breadcrumbLabel) breadcrumbLabel.textContent = tabLabel || tabName;

    if (tabName === 'weekly-log') {
        const carsEmpty = document.getElementById('carPlate').options.length <= 1;
        const driversEmpty = document.getElementById('driverName').options.length <= 1;
        if (carsEmpty) loadCarsData_Init().catch(() => {});
        if (driversEmpty) loadDriversData_Init().catch(() => {});
    } else if (tabName === 'driver-management') {
        loadDriversData();
        const dsi = document.getElementById('driversSearchInput');
        if (dsi) dsi.value = '';
        resetDriversFilters();
        const dfb = document.getElementById('driversFilterBadge');
        if (dfb) dfb.style.display = 'none';
        document.querySelectorAll('#driversFilterDropdown .filter-dropdown-item')
            .forEach((item, i) => item.classList.toggle('active-filter', i === 0));
    } else if (tabName === 'car-management') {
        loadCarsData();
        const csi = document.getElementById('carsSearchInput');
        if (csi) csi.value = '';
        resetCarsFilters();
        const cfb = document.getElementById('carsFilterBadge');
        if (cfb) cfb.style.display = 'none';
        document.querySelectorAll('#carsFilterDropdown .filter-dropdown-item')
            .forEach((item, i) => item.classList.toggle('active-filter', i === 0));
    } else if (tabName === 'dashboard') {
        loadDashboardData();
    }

    lucide.createIcons();
}


export function openMobileSidebar() {
    document.getElementById('sidebarNode')?.classList.add('mobile-open');
    document.getElementById('sidebarOverlay')?.classList.add('visible');
}

export function closeMobileSidebar() {
    document.getElementById('sidebarNode')?.classList.remove('mobile-open');
    document.getElementById('sidebarOverlay')?.classList.remove('visible');
}


// ── OVERFLOW MENU TOGGLE ─────────────────────────────────────────
export function toggleOverflowMenu(triggerBtn) {
    const menu = triggerBtn.nextElementSibling;
    const isOpen = menu.classList.contains('open');
    closeOverflowMenus();
    if (!isOpen) menu.classList.add('open');
}

export function closeOverflowMenus() {
    document.querySelectorAll('.overflow-menu.open').forEach(m => m.classList.remove('open'));
}



export function setupNavigation() {
    const toggleBtn = document.getElementById('sidebarToggleAction');
    const sidebar   = document.getElementById('sidebarNode');

    // Toggle button: mobile = slide in/out, desktop = collapse/expand
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            if (window.innerWidth <= 640) {
                const isOpen = sidebar?.classList.contains('mobile-open');
                isOpen ? closeMobileSidebar() : openMobileSidebar();
            } else {
                sidebar?.classList.toggle('collapsed');
                lucide.createIcons();
            }
        });
    }

    // Nav item buttons → switchTab
    document.querySelectorAll('.nav-item-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const tabName  = this.getAttribute('data-tab');
            const tabLabel = this.getAttribute('data-label');
            if (window.innerWidth <= 640) closeMobileSidebar();
            switchTab(tabName, tabLabel);
        });
    });
}


