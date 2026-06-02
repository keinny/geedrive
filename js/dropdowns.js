import { state, setAllCars, setAllDrivers } from './state.js';
import { _cache } from './cache.js';
import { FleetAPI } from './api.js';
import {
    setDropdownError,
    setDropdownLoading,
    setDropdownSuccess,
} from './utils.js';

let dropdownEventsBound = false;

export function setupDropdowns() {
    if (dropdownEventsBound) return;
    dropdownEventsBound = true;

    document.getElementById('carPlate')?.addEventListener('change', function() {
        const plate = this.value;
        console.log('🚗 Car selected:', plate);
        if (plate) {
            loadLastMileage(plate);
        }
    });
}

// ── loadDriversData_Init ─────────────────────────────────────────────
export function loadDriversData_Init() {
    setDropdownLoading('driverName', 'driverDropdownStatus', 'retryDriverBtn');
    console.log('📥 Loading drivers...');
    const dataPromise = !_cache.isStale('driversList') && _cache.driversList
        ? Promise.resolve({ status: 'success', drivers: _cache.driversList })
        : FleetAPI.getDrivers();
    return dataPromise
        .then(data => {
            if (data.status === 'success' && Array.isArray(data.drivers)) {
                setAllDrivers(data.drivers);
                _cache.set('driversList', data.drivers);
                _cache.set('drivers', data.drivers);
                populateDriverDropdown();
                setDropdownSuccess('driverName', 'driverDropdownStatus', 'retryDriverBtn', state.allDrivers.filter(d => d.status === 'Active').length, 'active drivers');
                console.log('Driver dropdown populated:', state.allDrivers.length);
            } else {
                throw new Error('Unexpected response shape');
            }
        })
        .catch(error => {
            setDropdownError('driverName', 'driverDropdownStatus', 'retryDriverBtn', error.message);
            console.error('Drivers load failed:', error);
            throw error;
        });
}

// ── loadCarsData_Init ───────────────────────────────────────────────
export function loadCarsData_Init() {
    setDropdownLoading('carPlate', 'carDropdownStatus', 'retryCarBtn');
    console.log('📥 Loading vehicles...');
    const dataPromise = !_cache.isStale('carsList') && _cache.carsList
        ? Promise.resolve({ status: 'success', cars: _cache.carsList })
        : FleetAPI.getCars();
    return dataPromise
        .then(data => {
            if (data.status === 'success' && Array.isArray(data.cars)) {
                setAllCars(data.cars);
                _cache.set('carsList', data.cars);
                populateCarDropdown();
                populateDashboardCarFilter();
                setDropdownSuccess('carPlate', 'carDropdownStatus', 'retryCarBtn', state.allCars.filter(c => c.status !== 'Decommissioned').length, 'vehicles');
                console.log('Car dropdown populated:', state.allCars.length);
            } else {
                throw new Error('Unexpected response shape');
            }
        })
        .catch(error => {
            setDropdownError('carPlate', 'carDropdownStatus', 'retryCarBtn', error.message);
            console.error('Cars load failed:', error);
            throw error;
        });
}

// ============================================================================
// LOADING STATE MANAGEMENT
// ============================================================================

export function loadCars(isRetry = false) {
    if (isRetry) {
        // Retry from Weekly Log tab — use full init path so status UI updates
        loadCarsData_Init().catch(() => {});
        return;
    }
    // Called from Car Management tab after register/decommission — silent refresh
    FleetAPI.getCars()
        .then(data => {
            if (data.status === 'success' && Array.isArray(data.cars)) {
                setAllCars(data.cars);
                _cache.set('carsList', data.cars);
                populateCarDropdown();
                populateDashboardCarFilter();
            }
        })
        .catch(error => console.error('Error refreshing cars:', error));
}

export function populateCarDropdown() {
    const select = document.getElementById('carPlate');
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Select Car --</option>';
    console.log('📋 Populating car dropdown with', state.allCars.length, 'cars');
    
    state.allCars.forEach(car => {
        if (car.status !== 'Decommissioned') {
            const option = document.createElement('option');
            option.value = car.plate;
            option.textContent = `${car.plate} - ${car.model}`;
            select.appendChild(option);
        }
    });
    if (currentValue) select.value = currentValue;
    console.log('Car dropdown populated');
}

export function populateDashboardCarFilter() {
    const select = document.getElementById('dashboardCarFilter');
    select.innerHTML = '<option value="">-- All Vehicles --</option>';
    state.allCars.forEach(car => {
        if (car.status !== 'Decommissioned') {
            const option = document.createElement('option');
            option.value = car.plate;
            option.textContent = car.plate;
            select.appendChild(option);
        }
    });
}

export function loadLastMileage(carPlate) {
    FleetAPI.getLastMileage(carPlate)
        .then(data => {
            if (data.status === 'success' && data.lastMileage) {
                document.getElementById('startMileage').value = data.lastMileage;
                document.getElementById('startMileage')?.dispatchEvent(new Event('input', { bubbles: true }));
            }
        })
        .catch(error => console.error('Error loading last odometer mileage:', error));
}


export function loadDrivers(isRetry = false) {
    if (isRetry) {
        loadDriversData_Init().catch(() => {});
        return;
    }
    FleetAPI.getDrivers()
        .then(data => {
            if (data.status === 'success' && Array.isArray(data.drivers)) {
                setAllDrivers(data.drivers);
                _cache.set('driversList', data.drivers);
                _cache.set('drivers', data.drivers);
                populateDriverDropdown();
            }
        })
        .catch(error => console.error('Error refreshing drivers:', error));
}

export function populateDriverDropdown() {
    const select = document.getElementById('driverName');
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Select Driver --</option>';
    
    state.allDrivers.forEach(driver => {
        if (driver.status === 'Active') {
            const option = document.createElement('option');
            option.value = driver.name;
            option.textContent = driver.name;
            select.appendChild(option);
        }
    });
    if (currentValue) select.value = currentValue;
}
