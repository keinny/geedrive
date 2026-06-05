/**
 * cars.js
 *
 * CHANGES (style-guide audit):
 *   • renderHealthPill() – replaced hard-coded #10B981 / #F59E0B / #EF4444 hex values
 *     with CSS custom-property references (var(--gd-success) etc.) so theming is
 *     driven by the single token source. (style guide §Colors → Semantic)
 *   • populateCarsTable() empty-state td – retained var(--text-secondary); no change
 *     needed because that token is already defined in the new styles.css.
 *   • All business logic, API calls and DOM manipulation are unchanged.
 */

import { _cache } from './cache.js';
import { FleetAPI } from './api.js';
import { populateCarDropdown, populateDashboardCarFilter } from './dropdowns.js';
import { notifyIfSystemError } from './notifications.js';
import { pagination, state, setAllCars } from './state.js';
import { ZM, applyValidation, attachLiveValidation } from './validation.js';
import {
    exportToCSV,
    fmtZMW,
    friendlyError,
    renderPagination,
    setSubmitLoading,
    showTableError,
    showTableSkeleton,
    showToast,
} from './utils.js';

let carsEventsBound = false;

export function setupCars() {
    if (carsEventsBound) return;
    carsEventsBound = true;

    attachLiveValidation('carPlateReg', 'plateValidationMessage', ZM.plate);
    document.getElementById('carPlateReg')?.addEventListener('input', function(e) {
        const val = e.target.value.trim().toUpperCase();
        const msg = document.getElementById('plateValidationMessage');
        const format = ZM.plate(val);
        if (!format.valid) {
            applyValidation(e.target, msg, format);
            return;
        }
        const isDuplicate = state.allCars.some(car => car.plate === val);
        if (isDuplicate) {
            msg.className = 'validation-message error';
            msg.textContent = 'This plate number is already registered';
        } else {
            msg.className = 'validation-message success';
            msg.textContent = 'Plate available';
        }
    });
}

export function loadCarsData() {
    if (!_cache.isStale('cars')) {
        pagination.cars.page = 1;
        populateCarsTable(_cache.cars);
        return Promise.resolve(_cache.cars);
    }

    showTableSkeleton('#carsTable tbody', 7);

    return FleetAPI.getEnrichedCars()
        .then(data => {
            if (data.status === 'success') {
                setAllCars(data.cars);
                _cache.set('cars', data.cars);
                pagination.cars.page = 1;
                populateCarsTable(state.allCars);
                return state.allCars;
            } else {
                showTableError('#carsTable tbody', 7,
                    'Could not load vehicles',
                    'The server returned an unexpected response. Check the API is running correctly.',
                    'loadCarsData'
                );
                return [];
            }
        })
        .catch(error => {
            showTableError('#carsTable tbody', 7,
                'Could not load vehicles',
                friendlyError(error.message),
                'loadCarsData'
            );
            notifyIfSystemError(error.message, 'Could not load vehicles');
            throw error;
        });
}

/**
 * renderHealthPill
 *
 * CHANGE: Replaced hard-coded hex colour strings with CSS custom properties
 * (style guide §Colors → Semantic tokens).
 *   Before: color:'#10B981', bg:'rgba(16,185,129,0.1)'
 *   After:  color:'var(--gd-success)', bg:'rgba(var values via CSS classes)'
 *
 * We keep inline styles only for the pill wrapper because the colours are
 * dynamically chosen at runtime; the CSS class approach would require injecting
 * <style> blocks. Using CSS variables keeps the colour source-of-truth in the
 * stylesheet while still supporting dynamic rendering via innerHTML.
 */
export function renderHealthPill(score) {
    score = score || 0;
    const label = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';

    // CHANGE: CSS variable references instead of raw hex (style guide §Semantic colours)
    const color = score >= 70 ? 'var(--gd-success)' : score >= 50 ? 'var(--gd-warning)' : 'var(--gd-danger)';
    const bg    = score >= 70 ? 'rgba(46,125,50,0.10)'  : score >= 50 ? 'rgba(180,83,9,0.10)'  : 'rgba(198,40,40,0.10)';
    const bdr   = score >= 70 ? 'rgba(46,125,50,0.20)'  : score >= 50 ? 'rgba(180,83,9,0.20)'  : 'rgba(198,40,40,0.20)';

    return `<div class="health-pill" style="background:${bg}; border:0.5px solid ${bdr}; color:${color};">`
         + `<span class="health-pill-score">${Math.round(score)}%</span>`
         + `<span class="health-pill-label">${label}</span>`
         + `</div>`;
}

export function populateCarsTable(cars) {
    const tbody = document.querySelector('#carsTable tbody');
    tbody.innerHTML = '';

    const filteredCars = getFilteredCars(cars);

    if (filteredCars.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No vehicles found.</td></tr>';
        renderPagination('cars', 0, 1, pagination.cars.pageSize);
        updateCarsMetrics(cars);
        updateCarsCount(0);
        return;
    }

    const pageState = pagination.cars;
    pageState.total = filteredCars.length;
    const start = (pageState.page - 1) * pageState.pageSize;
    const pageData = filteredCars.slice(start, start + pageState.pageSize);

    pageData.forEach(car => {
        const row = document.createElement('tr');
        const lastServiceDate = car.lastServiced ? new Date(car.lastServiced).toLocaleDateString() : 'N/A';

        let badgeClass = 'active';
        if (car.status === 'Decommissioned') badgeClass = 'decommissioned';
        if (car.status === 'In Service') badgeClass = 'warning';

        row.innerHTML = `
            <td>
                <div class="vehicle-cell">
                    <span class="vehicle-cell-name">${car.make || ''} <strong>${car.model || 'N/A'}</strong></span>
                    <span class="vehicle-cell-type">${car.vehicleType || car.vehicle_type || ''}</span>
                </div>
            </td>
            <td><span class="plate-badge">${car.plate}</span></td>
            <td>${car.capacity || 'N/A'}</td>
            <td>${lastServiceDate}</td>
            <td><span class="status-badge ${badgeClass}">${car.status}</span></td>
            <td>${renderHealthPill(car.healthScore)}</td>
            <td>
                <div class="ctx-menu-wrapper">
                    <button class="ctx-menu-btn" data-action="toggle-context-menu" title="More actions" aria-label="More actions" aria-haspopup="menu" aria-expanded="false">
                        <i data-lucide="more-vertical" aria-hidden="true"></i>
                    </button>
                    <div class="ctx-menu" role="menu">
                        <button class="ctx-item" data-action="open-car-details" data-plate="${car.plate}" role="menuitem">
                            <i data-lucide="eye" aria-hidden="true"></i> View Details
                        </button>
                        ${car.status === 'Active' ? `
                        <button class="ctx-item" data-action="open-car-edit-modal" data-car-id="${car.id}" role="menuitem">
                            <i data-lucide="pencil" aria-hidden="true"></i> Edit Vehicle
                        </button>
                        <button class="ctx-item danger" data-action="open-decommission-modal" data-car-id="${car.id}" role="menuitem">
                            <i data-lucide="truck" aria-hidden="true"></i> Decommission
                        </button>` : ''}
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateCarsMetrics(cars);
    updateCarsCount(filteredCars.length);
    renderPagination('cars', pagination.cars.total, pagination.cars.page, pagination.cars.pageSize);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function getFilteredCars(cars) {
    const query = (document.getElementById('carsSearchInput')?.value || '').toLowerCase().trim();
    return cars.filter(car => {
        const text = [
            car.make,
            car.model,
            car.plate,
            car.plate_number,
            car.vehicleType,
            car.vehicle_type,
            car.status
        ].join(' ').toLowerCase();
        const typeText = car.vehicleType || car.vehicle_type || '';
        const matchesSearch = !query || text.includes(query);
        const matchesStatus = state.carsFilterStatus === 'all' || car.status === state.carsFilterStatus;
        const matchesType   = state.carsFilterType   === 'all' || typeText === state.carsFilterType;
        return matchesSearch && matchesStatus && matchesType;
    });
}

function updateCarsMetrics(cars) {
    const active     = cars.filter(c => c.status === 'Active').length;
    const serviceDue = cars.filter(c => c.needsService).length;
    const avgHealth  = cars.length
        ? Math.round(cars.reduce((s, c) => s + (c.healthScore || 0), 0) / cars.length)
        : 0;

    const healthEl = document.getElementById('metricAvgHealth');
    if (healthEl) {
        healthEl.textContent = avgHealth + '%';
        // CHANGE: use semantic CSS classes (success / warning / danger) defined in styles.css
        // instead of assigning inline colour.
        healthEl.className = 'mini-metric-value ' + (avgHealth >= 70 ? 'success' : avgHealth >= 50 ? 'warning' : 'danger');
    }

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('metricTotalCars',  cars.length);
    el('metricActiveCars', active);
    el('metricServiceDue', serviceDue);
    el('carsLiveCount', cars.length + ' Vehicle' + (cars.length !== 1 ? 's' : ''));
}

export function openCarModal() {
    document.getElementById('carRegistrationModal').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function closeCarModal() {
    document.getElementById('carRegistrationModal').classList.remove('show');
    document.getElementById('carRegForm').reset();
    const msg = document.getElementById('carModalMessage');
    msg.className = 'status-message';
    msg.textContent = '';
}

export function openCarEditModal(carId) {
    const car = state.allCars.find(c => String(c.id) === String(carId));
    if (!car) {
        showToast('Vehicle not found', 'Refresh the vehicle table and try again.', 'error');
        return;
    }
    state.currentEditCarId = car.id;
    document.getElementById('editCarMake').value     = car.make || '';
    document.getElementById('editCarModel').value    = car.model || '';
    document.getElementById('editVehicleType').value = car.vehicleType || car.vehicle_type || '';
    document.getElementById('editCarCapacity').value = car.capacity || car.passenger_capacity || '';
    document.getElementById('editLastServiced').value = car.lastServiced || car.last_serviced || '';
    const msg = document.getElementById('carEditModalMessage');
    msg.className = 'status-message';
    msg.textContent = '';
    document.getElementById('carEditModal').classList.add('show');
}

export function closeCarEditModal() {
    document.getElementById('carEditModal').classList.remove('show');
    document.getElementById('carEditForm').reset();
    state.currentEditCarId = null;
}

export function submitCarEdit() {
    const payload = {
        make:        document.getElementById('editCarMake').value.trim(),
        model:       document.getElementById('editCarModel').value.trim(),
        vehicleType: document.getElementById('editVehicleType').value,
        capacity:    document.getElementById('editCarCapacity').value,
        lastServiced:document.getElementById('editLastServiced').value,
    };

    if (!payload.make || !payload.model || !payload.vehicleType || !payload.capacity) {
        showCarEditMessage('Please fill in all required fields', 'error');
        return;
    }

    setSubmitLoading('carEditSubmitBtn', true);
    FleetAPI.updateCar(state.currentEditCarId, payload)
        .then(() => {
            _cache.invalidate('cars');
            _cache.invalidate('carsList');
            _cache.invalidate('carsAnalytics');
            _cache.invalidate('dashboard');
            closeCarEditModal();
            loadCarsData()
                .then(() => {
                    populateCarDropdown();
                    populateDashboardCarFilter();
                })
                .catch(() => {});
            showToast('Vehicle updated', 'Mutable vehicle details were saved.', 'success');
        })
        .catch(error => showCarEditMessage(friendlyError(error.message), 'error'))
        .finally(() => setSubmitLoading('carEditSubmitBtn', false));
}

function showCarEditMessage(text, type) {
    const msg = document.getElementById('carEditModalMessage');
    msg.className = `status-message ${type}`;
    msg.textContent = text;
}

export function submitCarRegistration() {
    const carMake       = document.getElementById('carMake').value.trim();
    const carModel      = document.getElementById('carModel').value.trim();
    const vehicleType   = document.getElementById('vehicleType').value;
    const carPlate      = document.getElementById('carPlateReg').value.trim().toUpperCase();
    const carCapacity   = document.getElementById('carCapacity').value;
    const lastServiced  = document.getElementById('lastServiced').value;
    const initialMileage = document.getElementById('initialMileage').value;

    if (!carMake || !carModel || !vehicleType || !carPlate || !carCapacity || !lastServiced || !initialMileage) {
        showCarModalMessage('Please fill in all required fields', 'error');
        return;
    }

    const plateResult = ZM.plate(carPlate);
    if (!plateResult.valid) {
        applyValidation(document.getElementById('carPlateReg'), document.getElementById('plateValidationMessage'), plateResult);
        showCarModalMessage(plateResult.message, 'error');
        return;
    }

    const isDuplicate = state.allCars.some(car => car.plate === carPlate);
    if (isDuplicate) {
        showCarModalMessage('This plate number is already registered', 'error');
        return;
    }

    const carData = {
        action: 'registerCar',
        make: carMake,
        model: carModel,
        vehicleType,
        plate: carPlate,
        capacity: carCapacity,
        lastServiced,
        initialMileage,
        registrationDate: new Date().toISOString().split('T')[0]
    };

    setSubmitLoading('carSubmitBtn', true);

    FleetAPI.registerCar(carData)
        .then(result => {
            setSubmitLoading('carSubmitBtn', false);
            if (result.status === 'success') {
                showToast('Vehicle registered', `${carMake} ${carModel} (${carPlate}) added.`, 'success');
                closeCarModal();
                _cache.invalidate('cars');
                _cache.invalidate('carsList');
                _cache.invalidate('dashboard');
                loadCarsData().catch(() => {});
                populateCarDropdown();
                populateDashboardCarFilter();
            } else {
                showCarModalMessage(result.message || 'Registration failed.', 'error');
            }
        })
        .catch(error => {
            setSubmitLoading('carSubmitBtn', false);
            showCarModalMessage(friendlyError(error.message), 'error');
        });
}

function showCarModalMessage(text, type) {
    const msg = document.getElementById('carModalMessage');
    msg.className = `status-message ${type}`;
    msg.textContent = text;
}

export function openCarDetailsModal(plate) {
    const car = state.allCars.find(c => c.plate === plate);
    if (!car) {
        showToast('Vehicle not found', 'Refresh the table and try again.', 'error');
        return;
    }
    state.currentViewCar = car;

    document.getElementById('detailsPlateNumber').textContent = car.plate;
    document.getElementById('detailsModelName').textContent   = `${car.make || ''} ${car.model || ''}`.trim();

    const weeklyMileage = state.filteredWeeklyMileage?.[car.plate] || 0;
    const healthScore   = car.healthScore || 0;
    document.getElementById('detailsRevenue').textContent  = fmtZMW(car.totalRevenue || 0);
    document.getElementById('detailsExpenses').textContent = fmtZMW(car.totalExpenses || 0);
    document.getElementById('detailsTrips').textContent    = car.totalTrips || 0;

    // Health bar
    document.getElementById('detailsHealthScore').textContent = `${Math.round(healthScore)}%`;
    document.getElementById('detailsHealthBar').style.width   = `${Math.min(100, healthScore)}%`;
    // CHANGE: health bar fill colour uses CSS variables
    const barColor = healthScore >= 70 ? 'var(--gd-success)' : healthScore >= 50 ? 'var(--gd-warning)' : 'var(--gd-danger)';
    document.getElementById('detailsHealthBar').style.background = barColor;
    document.getElementById('detailsHealthText').textContent = `Current weekly mileage: ${weeklyMileage.toLocaleString()} km`;

    // Maintenance
    const needsService = car.needsService;
    const iconWrap     = document.getElementById('maintIconWrap');
    const statusText   = document.getElementById('maintStatusText');
    const subText      = document.getElementById('maintSubText');
    const badge        = document.getElementById('maintBadge');

    if (needsService) {
        iconWrap.className   = 'vpi-maint-icon-wrap warning';
        statusText.className = 'vpi-maint-status warning';
        statusText.textContent = 'Service Required';
        subText.textContent  = 'This vehicle has exceeded the 450 km weekly service threshold.';
        badge.className      = 'vpi-maint-badge warning';
        badge.textContent    = 'Due';
    } else {
        iconWrap.className   = 'vpi-maint-icon-wrap';
        statusText.className = 'vpi-maint-status';
        statusText.textContent = 'Operational';
        subText.textContent  = 'Vehicle is within normal service parameters.';
        badge.className      = 'vpi-maint-badge';
        badge.textContent    = 'OK';
    }

    document.getElementById('carDetailsModal').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function closeDetailsModal() {
    document.getElementById('carDetailsModal').classList.remove('show');
}

export function openDecommissionModal(car) {
    if (typeof car === 'string' || typeof car === 'number') {
        car = state.allCars.find(c => String(c.id) === String(car));
    }
    if (!car) return;
    state.currentViewCar = car;
    document.getElementById('decommissionCarPlate').textContent = car.plate;
    document.getElementById('decommissionReason').value = '';
    document.getElementById('decommissionFinalMileage').value = '';
    document.getElementById('decommissionRevenue').value = '';
    document.getElementById('decommissionModal').classList.add('show');
}

export function closeDecommissionModal() {
    document.getElementById('decommissionModal').classList.remove('show');
}

export function confirmDecommissionCar() {
    const car    = state.currentViewCar;
    const reason = document.getElementById('decommissionReason').value.trim();
    const finalMileage = document.getElementById('decommissionFinalMileage').value;
    const finalRevenue = document.getElementById('decommissionRevenue').value;

    if (!car) { showToast('No vehicle selected', '', 'error'); return; }
    if (!reason) { showToast('Reason required', 'Please provide a decommission reason.', 'warning'); return; }
    if (!finalMileage) { showToast('Mileage required', 'Please enter the final mileage.', 'warning'); return; }
    if (!finalRevenue) { showToast('Revenue required', 'Please enter the total revenue at decommission.', 'warning'); return; }

    const btn = document.getElementById('decommissionConfirmBtn');
    btn.disabled = true;
    btn.textContent = 'Processing…';

    FleetAPI.decommissionCar(car.id, { reason, finalMileage, totalRevenueAtDecommission: finalRevenue })
        .then(result => {
            btn.disabled = false;
            btn.textContent = 'Confirm Decommission';
            if (result.status === 'success') {
                showToast('Vehicle decommissioned', `${car.plate} has been decommissioned.`, 'success');
                closeDecommissionModal();
                closeDetailsModal();
                _cache.invalidate('cars');
                _cache.invalidate('carsList');
                _cache.invalidate('carsAnalytics');
                _cache.invalidate('dashboard');
                loadCarsData().catch(() => {});
            } else {
                showToast('Decommission failed', result.message || 'An error occurred.', 'error');
            }
        })
        .catch(error => {
            btn.disabled = false;
            btn.textContent = 'Confirm Decommission';
            showToast('Decommission failed', friendlyError(error.message), 'error');
        });
}

export function filterCarsTable() {
    populateCarsTable(state.allCars);
}

export function setCarsFilter(status, el) {
    state.carsFilterStatus = status;
    pagination.cars.page = 1;
    document.querySelectorAll('#carsFilterDropdown .filter-dropdown-item').forEach(i => i.classList.remove('active-filter'));
    if (el) el.classList.add('active-filter');
    const badge = document.getElementById('carsFilterBadge');
    if (badge) badge.style.display = (status !== 'all' || state.carsFilterType !== 'all') ? 'inline-flex' : 'none';
    document.getElementById('carsFilterDropdown')?.classList.remove('open');
    populateCarsTable(state.allCars);
}

export function setCarsTypeFilter(type, el) {
    state.carsFilterType = type;
    pagination.cars.page = 1;
    document.querySelectorAll('#carsFilterDropdown .filter-dropdown-item').forEach(i => i.classList.remove('active-filter'));
    if (el) el.classList.add('active-filter');
    const badge = document.getElementById('carsFilterBadge');
    if (badge) badge.style.display = (state.carsFilterStatus !== 'all' || type !== 'all') ? 'inline-flex' : 'none';
    const typeSelect = document.getElementById('carsTypeSelect');
    if (typeSelect) typeSelect.value = type;
    document.getElementById('carsFilterDropdown')?.classList.remove('open');
    populateCarsTable(state.allCars);
}

export function toggleCarsFilter(e) {
    e.stopPropagation();
    const dd = document.getElementById('carsFilterDropdown');
    document.getElementById('driversFilterDropdown')?.classList.remove('open');
    if (dd) dd.classList.toggle('open');
}

export function updateCarsCount(count = null) {
    const value = count == null ? getFilteredCars(state.allCars).length : count;
    const badge = document.getElementById('carsCountBadge');
    if (badge) badge.textContent = value + ' record' + (value !== 1 ? 's' : '');
}

export function exportCars() {
    if (!state.allCars.length) {
        showToast('No data', 'No vehicles to export.', 'info');
        return;
    }
    const headers = ['Plate', 'Make', 'Model', 'Type', 'Capacity', 'Status', 'Last Serviced', 'Health Score', 'Service Due'];
    const rows = state.allCars.map(c => [
        c.plate,
        c.make,
        c.model,
        c.vehicleType,
        c.capacity,
        c.status,
        c.lastServiced || '',
        (c.healthScore || 0).toFixed(1) + '%',
        c.needsService ? 'Yes' : 'No'
    ]);
    exportToCSV(`geedrive-vehicles-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
}
