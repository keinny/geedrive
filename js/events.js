import {
    closeCarModal,
    closeCarEditModal,
    closeDecommissionModal,
    closeDetailsModal,
    confirmDecommissionCar,
    filterCarsTable,
    loadCarsData,
    openCarDetailsModal,
    openCarEditModal,
    openCarModal,
    openDecommissionModal,
    populateCarsTable,
    exportCars,
    setCarsFilter,
    setCarsTypeFilter,
    submitCarEdit,
    submitCarRegistration,
    toggleCarsFilter,
} from './cars.js';
import {
    clearAllNotifs,
    closeNotifTray,
    dismissNotif,
    toggleNotifTray,
} from './notifications.js';
import {
    closeDriverEditModal,
    closeDriverRegModal,
    closeFireModal,
    confirmFireDriver,
    filterDriversTable,
    handleTerminationReasonChange,
    loadDriversData,
    openDriverDocument,
    openDriverEditModal,
    openDriverRegModal,
    openFireModal,
    populateDriversTable,
    printTerminationLetter,
    exportDrivers,
    setDriversFilter,
    submitDriverEdit,
    submitDriverRegistration,
    toggleDriversFilter,
} from './drivers.js';
import { filterDashboardByCar, loadDashboardData } from './dashboard.js';
import { loadCars, loadDrivers } from './dropdowns.js';
import { closeMobileSidebar } from './navigation.js';
import { positionContextMenu } from './utils.js';
import {
    closeLogDetailModal,
    closeWeeklyLogModal,
    exportLogs,
    handleWeeklyLogSubmit,
    loadWeeklyLogs,
    openLogDetailModal,
    openWeeklyLogModal,
    populateLogsTable,
} from './weekly-log.js';
import { pagination, state } from './state.js';

const tableRetries = {
    loadCarsData,
    loadDriversData,
    loadDashboardData,
    loadWeeklyLogs,
};

let appEventsBound = false;

export function setupAppEvents() {
    if (appEventsBound) return;
    appEventsBound = true;

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('input', handleDocumentInput);
    document.addEventListener('change', handleDocumentChange);
    document.getElementById('ctxBackdrop')?.addEventListener('click', closeAllContextMenus);

    document.getElementById('fleetForm')?.addEventListener('submit', handleWeeklyLogSubmit);
    document.getElementById('carRegForm')?.addEventListener('submit', event => {
        event.preventDefault();
        submitCarRegistration();
    });
    document.getElementById('carEditForm')?.addEventListener('submit', event => {
        event.preventDefault();
        submitCarEdit();
    });
    document.getElementById('driverRegForm')?.addEventListener('submit', event => {
        event.preventDefault();
        submitDriverRegistration();
    });
    document.getElementById('driverEditForm')?.addEventListener('submit', event => {
        event.preventDefault();
        submitDriverEdit();
    });
}

function handleDocumentClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) {
        if (!event.target.closest('.ctx-menu')) closeAllContextMenus();
        return;
    }

    const action = target.dataset.action;

    if (action === 'dismiss-toast') {
        target.closest('.toast')?.remove();
        return;
    }

    if (action === 'toggle-context-menu') {
        toggleContextMenu(target);
        return;
    }

    if (action === 'open-fire-modal') {
        closeAllContextMenus();
        openFireModal(target.dataset.driverName, Number(target.dataset.score), Number(target.dataset.shortages));
        return;
    }

    if (action === 'paginate') {
        const table = target.dataset.table;
        const page = Number(target.dataset.page);
        pagination[table].page = page;
        if (table === 'cars') populateCarsTable(state.allCars);
        if (table === 'drivers') populateDriversTable(state.allDrivers);
        if (table === 'logs') populateLogsTable(state.allLogs);
        return;
    }

    if (action === 'retry-table-load') {
        tableRetries[target.dataset.retry]?.();
        return;
    }

    const actions = {
        'close-mobile-sidebar': closeMobileSidebar,
        'toggle-notifications': toggleNotifTray,
        'clear-notifications': clearAllNotifs,
        'close-notifications': closeNotifTray,
        'retry-cars-dropdown': () => loadCars(true),
        'retry-drivers-dropdown': () => loadDrivers(true),
        'open-weekly-log-modal': openWeeklyLogModal,
        'close-weekly-log-modal': closeWeeklyLogModal,
        'view-log-entry': () => openLogDetailModal(target.dataset.logId),
        'close-log-detail-modal': closeLogDetailModal,
        'export-logs': exportLogs,
        'toggle-cars-filter': () => toggleCarsFilter(event),
        'filter-cars-status': () => setCarsFilter(target.dataset.status, target),
        'filter-cars-type': () => setCarsTypeFilter(target.dataset.type, target),
        'open-car-modal': openCarModal,
        'close-car-modal': closeCarModal,
        'open-car-edit-modal': () => openCarEditModal(target.dataset.carId),
        'close-car-edit-modal': closeCarEditModal,
        'open-car-details': () => openCarDetailsModal(target.dataset.plate),
        'close-car-details': closeDetailsModal,
        'open-decommission-modal': () => openDecommissionModal(target.dataset.carId || state.currentViewCar),
        'close-decommission-modal': closeDecommissionModal,
        'confirm-decommission-car': confirmDecommissionCar,
        'export-cars': exportCars,
        'toggle-drivers-filter': () => toggleDriversFilter(event),
        'filter-drivers-status': () => setDriversFilter(target.dataset.status, target),
        'open-driver-modal': openDriverRegModal,
        'close-driver-modal': closeDriverRegModal,
        'open-driver-edit-modal': () => openDriverEditModal(target.dataset.driverId),
        'close-driver-edit-modal': closeDriverEditModal,
        'open-driver-document': () => openDriverDocument(target.dataset.driverId, target.dataset.docType),
        'close-fire-modal': closeFireModal,
        'print-termination-letter': printTerminationLetter,
        'confirm-fire-driver': confirmFireDriver,
        'export-drivers': exportDrivers,
        'close-context-menus': closeAllContextMenus,
        'dismiss-notification': () => dismissNotif(Number(target.dataset.id)),
    };

    if (actions[action]) {
        if (!['toggle-context-menu', 'close-context-menus'].includes(action)) closeAllContextMenus();
        actions[action]();
    }
}

function handleDocumentInput(event) {
    if (event.target.id === 'carsSearchInput') {
        pagination.cars.page = 1;
        filterCarsTable();
    }
    if (event.target.id === 'driversSearchInput') {
        pagination.drivers.page = 1;
        filterDriversTable();
    }
}

function handleDocumentChange(event) {
    if (event.target.id === 'dashboardCarFilter') {
        filterDashboardByCar();
    }
    if (event.target.id === 'carsTypeSelect') {
        state.carsFilterType = event.target.value;
        pagination.cars.page = 1;
        const badge = document.getElementById('carsFilterBadge');
        if (badge) badge.style.display = (state.carsFilterStatus !== 'all' || state.carsFilterType !== 'all') ? 'inline-flex' : 'none';
        filterCarsTable();
    }
    if (event.target.id === 'logsSortSelect') {
        state.logsSortMode = event.target.value;
        pagination.logs.page = 1;
        populateLogsTable(state.allLogs);
    }
    if (event.target.id === 'terminationReason') {
        handleTerminationReasonChange();
    }
}

export function closeAllContextMenus() {
    document.querySelectorAll('.ctx-menu.open').forEach(menu => {
        menu.classList.remove('open');

        // If this menu was portaled out to <body> to escape an
        // overflow-scrolling container (iOS fixed-position trap),
        // move it back to its original wrapper now that it's closed.
        const homeWrapperId = menu.dataset.homeWrapperId;
        if (homeWrapperId) {
            const homeWrapper = document.getElementById(homeWrapperId);
            if (homeWrapper) homeWrapper.appendChild(menu);
            delete menu.dataset.homeWrapperId;
        }

        // Clear inline positioning applied while portaled
        menu.style.top = '';
        menu.style.left = '';
        menu.style.right = '';
        menu.style.bottom = '';

        const trigger = menu.parentElement?.querySelector('.ctx-menu-btn')
            ?? document.querySelector(`[aria-controls="${menu.id}"]`);
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
    document.getElementById('ctxBackdrop')?.classList.remove('active');
}

let ctxWrapperCounter = 0;

function toggleContextMenu(trigger) {
    const wrapper = trigger.parentElement;
    const menu = wrapper?.querySelector('.ctx-menu');
    if (!menu || !wrapper) return;
    const isOpen = menu.classList.contains('open');
    closeAllContextMenus();
    if (!isOpen) {
        // Give the wrapper a stable id so the menu can find its way
        // back home when closed.
        if (!wrapper.id) wrapper.id = `ctxWrapper-${++ctxWrapperCounter}`;
        menu.dataset.homeWrapperId = wrapper.id;

        // Move the menu to <body>. This is required on mobile/iOS:
        // .ctx-menu uses position:fixed, but if it stays inside
        // .table-scroll-body (which has -webkit-overflow-scrolling:
        // touch), iOS traps fixed-position descendants inside that
        // scroller's own compositing layer. The full-screen
        // .ctx-backdrop (backdrop-filter: blur) then blurs that whole
        // layer, including the trapped menu. Moving the menu to <body>
        // makes it a true sibling of .ctx-backdrop, outside the blurred
        // layer, so only the page behind it gets blurred.
        document.body.appendChild(menu);

        menu.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        document.getElementById('ctxBackdrop')?.classList.add('active');
        positionContextMenu(trigger, menu);
    }
}