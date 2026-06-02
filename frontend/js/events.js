import {
    closeCarModal,
    closeDecommissionModal,
    closeDetailsModal,
    confirmDecommissionCar,
    filterCarsTable,
    loadCarsData,
    openCarDetailsModal,
    openCarModal,
    openDecommissionModal,
    populateCarsTable,
    setCarsFilter,
    setCarsTypeFilter,
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
    closeDriverRegModal,
    closeFireModal,
    confirmFireDriver,
    filterDriversTable,
    handleTerminationReasonChange,
    loadDriversData,
    openDriverRegModal,
    openFireModal,
    populateDriversTable,
    printTerminationLetter,
    setDriversFilter,
    submitDriverRegistration,
    toggleDriversFilter,
} from './drivers.js';
import { filterDashboardByCar, loadDashboardData } from './dashboard.js';
import { loadCars, loadDrivers } from './dropdowns.js';
import { closeMobileSidebar, closeOverflowMenus, toggleOverflowMenu } from './navigation.js';
import { handleWeeklyLogSubmit } from './weekly-log.js';
import { pagination, state } from './state.js';

const tableRetries = {
    loadCarsData,
    loadDriversData,
    loadDashboardData,
};

let appEventsBound = false;

export function setupAppEvents() {
    if (appEventsBound) return;
    appEventsBound = true;

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('input', handleDocumentInput);
    document.addEventListener('change', handleDocumentChange);

    document.getElementById('fleetForm')?.addEventListener('submit', handleWeeklyLogSubmit);
    document.getElementById('carRegForm')?.addEventListener('submit', event => {
        event.preventDefault();
        submitCarRegistration();
    });
    document.getElementById('driverRegForm')?.addEventListener('submit', event => {
        event.preventDefault();
        submitDriverRegistration();
    });
}

function handleDocumentClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    if (action === 'dismiss-toast') {
        target.closest('.toast')?.remove();
        return;
    }

    if (action === 'toggle-overflow-menu') {
        toggleOverflowMenu(target);
        return;
    }

    if (action === 'open-fire-modal') {
        closeOverflowMenus();
        openFireModal(target.dataset.driverName, Number(target.dataset.score), Number(target.dataset.shortages));
        return;
    }

    if (action === 'paginate') {
        const table = target.dataset.table;
        const page = Number(target.dataset.page);
        pagination[table].page = page;
        if (table === 'cars') populateCarsTable(state.allCars);
        if (table === 'drivers') populateDriversTable(state.allDrivers);
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
        'toggle-cars-filter': () => toggleCarsFilter(event),
        'filter-cars-status': () => setCarsFilter(target.dataset.status, target),
        'filter-cars-type': () => setCarsTypeFilter(target.dataset.type, target),
        'open-car-modal': openCarModal,
        'close-car-modal': closeCarModal,
        'open-car-details': () => openCarDetailsModal(target.dataset.plate),
        'close-car-details': closeDetailsModal,
        'open-decommission-modal': () => openDecommissionModal(state.currentViewCar),
        'close-decommission-modal': closeDecommissionModal,
        'confirm-decommission-car': confirmDecommissionCar,
        'toggle-drivers-filter': () => toggleDriversFilter(event),
        'filter-drivers-status': () => setDriversFilter(target.dataset.status, target),
        'open-driver-modal': openDriverRegModal,
        'close-driver-modal': closeDriverRegModal,
        'close-fire-modal': closeFireModal,
        'print-termination-letter': printTerminationLetter,
        'confirm-fire-driver': confirmFireDriver,
        'dismiss-notification': () => dismissNotif(Number(target.dataset.id)),
    };

    actions[action]?.();
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
    if (event.target.id === 'terminationReason') {
        handleTerminationReasonChange();
    }
}
