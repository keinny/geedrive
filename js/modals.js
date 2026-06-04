import { closeCarModal, closeDecommissionModal, closeDetailsModal } from './cars.js';
import { closeDriverRegModal, closeFireModal } from './drivers.js';
import { closeWeeklyLogModal } from './weekly-log.js';

let modalEventsBound = false;

export function setupModals() {
    if (modalEventsBound) return;
    modalEventsBound = true;

    window.addEventListener('click', function(event) {
        const carModal = document.getElementById('carRegistrationModal');
        const driverModal = document.getElementById('driverRegistrationModal');
        const fireModal = document.getElementById('fireDriverModal');
        const detailsModal = document.getElementById('carDetailsModal');
        const decommissionModal = document.getElementById('decommissionModal');
        const weeklyLogModal = document.getElementById('weeklyLogModal');
        
        if (event.target === carModal) closeCarModal();
        if (event.target === driverModal) closeDriverRegModal();
        if (event.target === fireModal) closeFireModal();
        if (event.target === detailsModal) closeDetailsModal();
        if (event.target === decommissionModal) closeDecommissionModal();
        if (event.target === weeklyLogModal) closeWeeklyLogModal();
    });

    window.addEventListener('keydown', function(event) {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('.modal.show').forEach(modal => {
            if (modal.id === 'weeklyLogModal') closeWeeklyLogModal();
            if (modal.id === 'carRegistrationModal') closeCarModal();
            if (modal.id === 'driverRegistrationModal') closeDriverRegModal();
            if (modal.id === 'fireDriverModal') closeFireModal();
            if (modal.id === 'carDetailsModal') closeDetailsModal();
            if (modal.id === 'decommissionModal') closeDecommissionModal();
        });
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('#carsFilterBtn') && !e.target.closest('#carsFilterDropdown')) {
            document.getElementById('carsFilterDropdown')?.classList.remove('open');
        }
        if (!e.target.closest('#driversFilterBtn') && !e.target.closest('#driversFilterDropdown')) {
            document.getElementById('driversFilterDropdown')?.classList.remove('open');
        }
    });
}
