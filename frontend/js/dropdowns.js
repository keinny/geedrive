import './state.js';

// ── loadDriversData_Init ─────────────────────────────────────────────
export function loadDriversData_Init() {
    setDropdownLoading('driverName', 'driverDropdownStatus', 'retryDriverBtn');
    console.log('📥 Loading drivers...');
    return FleetAPI.getDrivers()
        .then(data => {
            if (data.status === 'success' && Array.isArray(data.drivers)) {
                allDrivers = data.drivers;
                _cache.set('drivers', data.drivers);
                populateDriverDropdown();
                setDropdownSuccess('driverName', 'driverDropdownStatus', 'retryDriverBtn', allDrivers.filter(d => d.status === 'Active').length, 'active drivers');
                console.log('Driver dropdown populated:', allDrivers.length);
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
    return FleetAPI.getCars()
        .then(data => {
            if (data.status === 'success' && Array.isArray(data.cars)) {
                allCars = data.cars;
                _cache.set('cars', data.cars);
                populateCarDropdown();
                populateDashboardCarFilter();
                setDropdownSuccess('carPlate', 'carDropdownStatus', 'retryCarBtn', allCars.filter(c => c.status !== 'Decommissioned').length, 'vehicles');
                console.log('Car dropdown populated:', allCars.length);
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
                allCars = data.cars;
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
    console.log('📋 Populating car dropdown with', allCars.length, 'cars');
    
    allCars.forEach(car => {
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

// Add event listener ONCE, not inside population function
document.getElementById('carPlate')?.addEventListener('change', function() {
    const plate = this.value;
    console.log('🚗 Car selected:', plate);
    if (plate) {
        loadLastMileage(plate);
    }
});

export function populateDashboardCarFilter() {
    const select = document.getElementById('dashboardCarFilter');
    select.innerHTML = '<option value="">-- All Vehicles --</option>';
    allCars.forEach(car => {
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
                calculateMileageDifference();
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
                allDrivers = data.drivers;
                populateDriverDropdown();
            }
        })
        .catch(error => console.error('Error refreshing drivers:', error));
}

export function populateDriverDropdown() {
    const select = document.getElementById('driverName');
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Select Driver --</option>';
    
    allDrivers.forEach(driver => {
        if (driver.status === 'Active') {
            const option = document.createElement('option');
            option.value = driver.name;
            option.textContent = driver.name;
            select.appendChild(option);
        }
    });
    if (currentValue) select.value = currentValue;
}



