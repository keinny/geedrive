import './state.js';

document.getElementById('carPlateReg')?.addEventListener('input', function(e) {
    const val = e.target.value.trim().toUpperCase();
    const msg = document.getElementById('plateValidationMessage');
    if (!val) {
        msg.className = 'validation-message';
        return;
    }
    if (val.length > 7) {
        msg.className = 'validation-message error';
        msg.textContent = 'Plate cannot exceed 7 characters';
        return;
    }
    const isDuplicate = allCars.some(car => car.plate === val);
    if (isDuplicate) {
        msg.className = 'validation-message error';
        msg.textContent = 'This plate number is already registered';
    } else {
        msg.className = 'validation-message success';
        msg.textContent = 'Plate available';
    }
});


export function loadCarsData() {
    const tbody = document.querySelector('#carsTable tbody');
    if (!_cache.isStale('cars')) {
        _pagination.cars.page = 1;
        populateCarsTable(_cache.cars);
        return;
    }

    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">Loading vehicles...</td></tr>';

    FleetAPI.getEnrichedCars()
        .then(data => {
            if (data.status === 'success') {
                allCars = data.cars;
                _cache.set('cars', data.cars);
                _pagination.cars.page = 1;
                populateCarsTable(allCars);
            } else {
                showTableError('#carsTable tbody', 9,
                    'Could not load vehicles',
                    'The server returned an unexpected response. Check the API is running correctly.',
                    'loadCarsData'
                );
            }
        })
        .catch(error => {
            showTableError('#carsTable tbody', 9,
                'Could not load vehicles',
                friendlyError(error.message),
                'loadCarsData'
            );
            notifyIfSystemError(error.message, 'Could not load vehicles');
        });
}

export function renderHealthPill(score) {
    score = score || 0;
    var label = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';
    var color = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
    var bg    = score >= 70 ? 'rgba(16,185,129,0.1)' : score >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
    var bdr   = score >= 70 ? 'rgba(16,185,129,0.2)' : score >= 50 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)';
    return '<div class="health-pill" style="background:' + bg + '; border:1px solid ' + bdr + '; color:' + color + ';">'
         + '<span class="health-pill-score">' + Math.round(score) + '%</span>'
         + '<span class="health-pill-label">' + label + '</span>'
         + '</div>';
}

        export function populateCarsTable(cars) {
    const tbody = document.querySelector('#carsTable tbody');
    tbody.innerHTML = '';

    if (cars.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No vehicles found.</td></tr>';
        renderPagination('cars', 0, 1, _pagination.cars.pageSize, null);
        return;
    }

    // CHANGE 8: slice to current page
    const state = _pagination.cars;
    state.total = cars.length;
    const start = (state.page - 1) * state.pageSize;
    const pageData = cars.slice(start, start + state.pageSize);

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
                <div class="action-buttons">
                    <button class="btn-small btn-view" onclick="openCarDetailsModal('${car.plate}')">View</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    // Update live count badge and mini metrics
    const active = cars.filter(c => c.status === 'Active').length;
    const serviceDue = cars.filter(c => c.needsService).length;
    const avgHealth = cars.length
        ? Math.round(cars.reduce((s, c) => s + (c.healthScore || 0), 0) / cars.length)
        : 0;
    const healthEl = document.getElementById('metricAvgHealth');
    if (healthEl) {
        healthEl.textContent = avgHealth + '%';
        healthEl.className = 'mini-metric-value ' + (avgHealth >= 70 ? 'success' : avgHealth >= 50 ? 'warning' : 'danger');
    }
    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('metricTotalCars', cars.length);
    el('metricActiveCars', active);
    el('metricServiceDue', serviceDue);
    el('carsLiveCount', cars.length + ' Vehicle' + (cars.length !== 1 ? 's' : ''));
    updateCarsCount();
    filterCarsTable();
    // CHANGE 8: render pagination controls
    renderPagination('cars', _pagination.cars.total, _pagination.cars.page, _pagination.cars.pageSize, null);
}

export function openCarModal() {
    document.getElementById('carRegistrationModal').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    lucide.createIcons();
}

export function closeCarModal() {
    document.getElementById('carRegistrationModal').classList.remove('show');
    document.getElementById('carRegForm').reset();
    document.getElementById('carModalMessage').className = 'status-message';
    document.getElementById('carModalMessage').textContent = '';
}

export function submitCarRegistration() {
    const carMake = document.getElementById('carMake').value.trim();
    const carModel = document.getElementById('carModel').value.trim();
    const vehicleType = document.getElementById('vehicleType').value;
    const carPlate = document.getElementById('carPlateReg').value.trim().toUpperCase();
    const carCapacity = document.getElementById('carCapacity').value;
    const lastServiced = document.getElementById('lastServiced').value;
    const initialMileage = document.getElementById('initialMileage').value;

    if (!carMake || !carModel || !vehicleType || !carPlate || !carCapacity || !lastServiced || !initialMileage) {
        showCarModalMessage('Please fill in all required fields', 'error');
        return;
    }

    if (carPlate.length > 7) {
        showCarModalMessage('Plate number cannot exceed 7 characters', 'error');
        return;
    }

    const isDuplicate = allCars.some(car => car.plate === carPlate);
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
            if (result.status === 'success') {
                _cache.invalidate('cars');
                closeCarModal();
                loadCarsData_Init().catch(() => {});
                loadCarsData();
                showToast('Vehicle registered', 'New vehicle added to the fleet.', 'success');
            } else {
                showCarModalMessage('Registration failed: ' + (result.message || 'Please try again.'), 'error');
            }
        })
        .catch(error => {
            showCarModalMessage(friendlyError(error.message), 'error');
        })
        .finally(() => {
            setSubmitLoading('carSubmitBtn', false);
        });
}

export function showCarModalMessage(text, type) {
    const msg = document.getElementById('carModalMessage');
    msg.className = `status-message ${type}`;
    msg.textContent = text;
}

export function populateCarDetailsModal(d) {
    // Normalises both the allCars shape (totalRevenue, tripCount, healthScore)
    // and the API response shape (revenue, trips) to the same display fields.
    const fmt = (n) => 'K' + (n || 0).toLocaleString(undefined, {minimumFractionDigits: 2});

    // Identity
    document.getElementById('detailsModelName').textContent = d.model || '—';

    // Financial & operational stats — handle both shapes
    const revenue     = d.totalRevenue  !== undefined ? d.totalRevenue  : d.revenue;
    const expenses    = d.totalExpenses !== undefined ? d.totalExpenses : d.expenses;
    const trips       = d.tripCount     !== undefined ? d.tripCount     : d.trips;
    const weeklyMiles = d.weeklyMileage !== undefined ? d.weeklyMileage : (d.odometer || 0);
    const score       = d.healthScore   !== undefined ? d.healthScore   : (d.health_score || 0);
    const needsSvc    = d.needsService  !== undefined ? d.needsService  : (d.needs_service || false);

    document.getElementById('detailsRevenue').textContent  = fmt(revenue);
    document.getElementById('detailsExpenses').textContent = fmt(expenses);
    document.getElementById('detailsTrips').textContent    = trips || 0;

    // Health score
    const healthColor = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
    document.getElementById('detailsHealthScore').textContent = Math.round(score) + '%';
    document.getElementById('detailsHealthScore').style.color = healthColor;
    const bar = document.getElementById('detailsHealthBar');
    if (bar) {
        bar.style.width = Math.min(score, 100) + '%';
        bar.style.background = healthColor;
    }
    document.getElementById('detailsHealthText').textContent =
        'Current weekly mileage: ' + Math.round(weeklyMiles) + ' km';

    // Maintenance status
    const needsService = needsSvc || weeklyMiles >= 450;
    const iconWrap  = document.getElementById('maintIconWrap');
    const statusTxt = document.getElementById('maintStatusText');
    const subTxt    = document.getElementById('maintSubText');
    const badge     = document.getElementById('maintBadge');

    if (needsService) {
        if (iconWrap) { iconWrap.className = 'vpi-maint-icon-wrap warning'; iconWrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'; }
        if (statusTxt) { statusTxt.textContent = 'Service Required'; statusTxt.className = 'vpi-maint-status warning'; }
        if (subTxt)    subTxt.textContent = 'This vehicle has exceeded the 450 km weekly threshold.';
        if (badge)     { badge.textContent = 'Due Now'; badge.className = 'vpi-maint-badge warning'; }
    } else {
        const kmLeft = Math.round(450 - weeklyMiles);
        if (iconWrap) { iconWrap.className = 'vpi-maint-icon-wrap'; iconWrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'; }
        if (statusTxt) { statusTxt.textContent = 'Service OK'; statusTxt.className = 'vpi-maint-status'; }
        if (subTxt)    subTxt.textContent = kmLeft + ' km until service';
        if (badge)     { badge.textContent = kmLeft + ' km'; badge.className = 'vpi-maint-badge'; }
    }
}

export function openCarDetailsModal(carPlate) {
    currentViewCar = carPlate;

    // Clear stale data immediately
    ['detailsPlateNumber','detailsModelName','detailsRevenue','detailsExpenses',
     'detailsTrips','detailsHealthScore','detailsHealthText','maintStatusText',
     'maintSubText','maintBadge'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = id === 'detailsPlateNumber' ? carPlate : '—';
    });

    document.getElementById('carDetailsModal').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // ── CHANGE 1: Look up from allCars cache first — no API call needed ──
    const cached = allCars.find(c => c.plate_number === carPlate || c.plate === carPlate);
    if (cached) {
        populateCarDetailsModal(cached);
        return;
    }

    // Fallback: fetch only if not in cache (e.g. direct link or stale load)
    FleetAPI.getCarDetails(carPlate)
        .then(data => {
            if (data.status === 'success') populateCarDetailsModal(data.details);
        })
        .catch(error => {
            console.error('Error loading car details:', error);
            document.getElementById('maintStatusText').textContent = friendlyError(error.message);
        });
}

export function closeDetailsModal() {
    document.getElementById('carDetailsModal').classList.remove('show');
    currentViewCar = null;
}

// ============================================================================
// DECOMMISSION CAR
// ============================================================================
export function openDecommissionModal(carPlate) {
    document.getElementById('decommissionModal').classList.add('show');
    document.getElementById('decommissionCarPlate').textContent = carPlate;
    document.getElementById('decommissionReason').value = '';
}

export function closeDecommissionModal() {
    document.getElementById('decommissionModal').classList.remove('show');
}

export function confirmDecommissionCar() {
    const reason = document.getElementById('decommissionReason').value || 'No reason provided';
    const decommissionData = {
        action: 'decommissionCar',
        carPlate: currentViewCar,
        reason: reason,
        decommissionDate: new Date().toISOString()
    };

    // Lookup car UUID from local cache
    const carRecord = allCars.find(c => c.plate_number === currentViewCar || c.plate === currentViewCar);
    if (!carRecord) {
        alert('Car record not found in local cache. Please refresh the page.');
        return;
    }

    setSubmitLoading('decommissionConfirmBtn', true);

    FleetAPI.decommissionCar(carRecord.id, reason)
    .then(result => {
        if (result.status === 'success') {
            _cache.invalidate('cars');
            closeDecommissionModal();
            closeDetailsModal();
            loadCarsData();
            loadCarsData_Init().catch(() => {});
            showToast('Vehicle decommissioned', 'The vehicle has been marked as decommissioned.', 'warning');
        }
    })
    .catch(error => {
        showToast('Action failed', friendlyError(error.message), 'error');
        console.error('Error decommissioning car:', error);
    })
    .finally(() => {
        setSubmitLoading('decommissionConfirmBtn', false);
    });
}


export function filterCarsTable() {
    const query = (document.getElementById('carsSearchInput')?.value || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#carsTable tbody tr');
    let visible = 0;
    rows.forEach(row => {
        if (row.querySelector('.empty-state')) { row.style.display = ''; return; }
        const text = row.innerText.toLowerCase();
        const statusCell = row.cells[6];
        const typeCell   = row.cells[2];
        const statusText = statusCell ? statusCell.innerText.trim() : '';
        const typeText   = typeCell   ? typeCell.innerText.trim()   : '';
        const matchesSearch = !query || text.includes(query);
        const matchesStatus = _carsFilterStatus === 'all' || statusText.includes(_carsFilterStatus);
        const matchesType   = _carsFilterType   === 'all' || typeText === _carsFilterType;
        const show = matchesSearch && matchesStatus && matchesType;
        row.style.display = show ? '' : 'none';
        if (show) visible++;
    });
    const badge = document.getElementById('carsCountBadge');
    if (badge) badge.textContent = visible + ' record' + (visible !== 1 ? 's' : '');
}

export function setCarsFilter(status, el) {
    _carsFilterStatus = status;
    _carsFilterType   = 'all';
    _pagination.cars.page = 1;
    document.querySelectorAll('#carsFilterDropdown .filter-dropdown-item').forEach(i => i.classList.remove('active-filter'));
    if (el) el.classList.add('active-filter');
    const badge = document.getElementById('carsFilterBadge');
    if (badge) badge.style.display = status !== 'all' ? 'inline-flex' : 'none';
    document.getElementById('carsFilterDropdown')?.classList.remove('open');
    filterCarsTable();
}

export function setCarsTypeFilter(type, el) {
    _carsFilterType   = type === _carsFilterType ? 'all' : type;
    _carsFilterStatus = 'all';
    _pagination.cars.page = 1;
    document.querySelectorAll('#carsFilterDropdown .filter-dropdown-item').forEach(i => i.classList.remove('active-filter'));
    if (_carsFilterType !== 'all' && el) el.classList.add('active-filter');
    const badge = document.getElementById('carsFilterBadge');
    if (badge) badge.style.display = _carsFilterType !== 'all' ? 'inline-flex' : 'none';
    document.getElementById('carsFilterDropdown')?.classList.remove('open');
    filterCarsTable();
}

export function toggleCarsFilter(e) {
    e.stopPropagation();
    const dd = document.getElementById('carsFilterDropdown');
    document.getElementById('driversFilterDropdown')?.classList.remove('open');
    if (dd) dd.classList.toggle('open');
}


export function updateCarsCount() {
    const dataRows = Array.from(document.querySelectorAll('#carsTable tbody tr'))
        .filter(r => !r.querySelector('.empty-state') && r.style.display !== 'none');
    const badge = document.getElementById('carsCountBadge');
    if (badge) badge.textContent = dataRows.length + ' record' + (dataRows.length !== 1 ? 's' : '');
}



