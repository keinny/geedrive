import './state.js';

export function initializeForm() {
    // Setup protocol warnings
    if (window.location.protocol === 'file:') {
        document.getElementById('fileProtocolWarning').style.display = 'block';
    }

    // Standardize today's date context injection default limits
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    document.getElementById('year').value = new Date().getFullYear();

    // Set up active tracking event validation updates
    document.getElementById('startMileage').addEventListener('input', calculateMileageDifference);
    document.getElementById('closingMileage').addEventListener('input', calculateMileageDifference);

    // Execute asynchronous fetches for drop options initial loads
    loadDriversData_Init().catch(err => console.error('Initial drivers load failed:', err));
    loadCarsData_Init().catch(err => console.error('Initial vehicles load failed:', err));
}

export function calculateMileageDifference() {
    const start = parseFloat(document.getElementById('startMileage').value) || 0;
    const end = parseFloat(document.getElementById('closingMileage').value) || 0;
    const display = document.getElementById('totalMileageDisplay');
    const status = document.getElementById('mileageStatus');
    const statContainer = document.getElementById('mileageStatContainer');

    if (end < start && end > 0) {
        display.textContent = "Error";
        status.textContent = "Closing mileage cannot be smaller than starting mileage";
        statContainer.className = "mileage-stat review";
        return false;
    }

    const diff = end - start;
    display.textContent = diff >= 0 ? `${diff} km` : '0 km';

    if (diff > 450) {
        status.textContent = "Flagged: Over weekly service threshold (>450km)";
        statContainer.className = "mileage-stat review";
    } else if (diff > 0) {
        status.textContent = "Excellent: Distance run is healthy within normal variance parameters";
        statContainer.className = "mileage-stat excellent";
    } else {
        status.textContent = "Ready";
        statContainer.className = "mileage-stat";
    }
    return true;
}

// Generic Dropdown State Utilities

document.getElementById('fleetForm').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const msgDiv = document.getElementById('statusMessage');
    msgDiv.className = 'status-message';
    msgDiv.style.display = 'none';

    if (!calculateMileageDifference()) {
        msgDiv.className = 'status-message error';
        msgDiv.textContent = 'Closing mileage must be greater than start mileage.';
        msgDiv.style.display = 'block';
        return;
    }

    setSubmitLoading('submitBtn', true);

    const formData = new FormData(this);
    const dataObject = { action: 'saveLog' };
    formData.forEach((value, key) => {
        dataObject[key] = value;
    });

    console.log('🚀 Submitting weekly log packet:', dataObject);

    FleetAPI.saveLog(dataObject)
    .then(result => {
        setSubmitLoading('submitBtn', false);
        if (result.status === 'success') {
            showToast('Log submitted', 'Weekly log saved successfully.', 'success');
            document.getElementById('fleetForm').reset();
            initializeForm();
        } else {
            showToast('Submission failed', result.message || 'An error occurred.', 'error');
        }
    })
    .catch(error => {
        setSubmitLoading('submitBtn', false);
        showToast('Submission failed', friendlyError(error.message), 'error');
    });
});


export function updateLogSummary() {
    const vehicle = document.getElementById('carPlate')?.value || '';
    const driver  = document.getElementById('driverName')?.value || '';
    const start   = parseFloat(document.getElementById('startMileage')?.value) || 0;
    const close   = parseFloat(document.getElementById('closingMileage')?.value) || 0;
    const revenue = parseFloat(document.getElementById('totalRevenue')?.value) || 0;
    const expense = parseFloat(document.getElementById('expenseOnCar')?.value) || 0;
    const shortage= parseFloat(document.getElementById('shortage')?.value) || 0;
    const distance = Math.max(0, close - start);
    const net = revenue - expense - shortage;

    const panel = document.getElementById('logSummaryContent');
    if (!panel) return;

    if (!vehicle && !driver && !revenue) {
        panel.innerHTML = '<div class="log-summary-placeholder">Fill in the form to see a live summary</div>';
        return;
    }

    const fmt = (n) => 'K' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const netColor = net >= 0 ? 'var(--primary)' : 'var(--danger)';

    panel.innerHTML = `
        ${vehicle ? `<div class="log-summary-row"><label>Vehicle</label><span>${vehicle}</span></div>` : ''}
        ${driver  ? `<div class="log-summary-row"><label>Driver</label><span>${driver}</span></div>` : ''}
        ${distance > 0 ? `<div class="log-summary-row"><label>Distance</label><span>${distance.toLocaleString()} km</span></div>` : ''}
        ${revenue > 0  ? `<div class="log-summary-row"><label>Revenue</label><span>${fmt(revenue)}</span></div>` : ''}
        ${expense > 0  ? `<div class="log-summary-row"><label>Expenses</label><span>${fmt(expense)}</span></div>` : ''}
        ${shortage > 0 ? `<div class="log-summary-row"><label>Shortage</label><span style="color:var(--danger)">${fmt(shortage)}</span></div>` : ''}
        <div class="log-summary-net">
            <label>Net Income</label>
            <div class="net-value" style="color:${netColor}">${fmt(net)}</div>
        </div>
    `;
}

// Hook summary updater to all relevant form inputs
['carPlate','driverName','startMileage','closingMileage','totalRevenue','expenseOnCar','shortage'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateLogSummary);
    document.getElementById(id)?.addEventListener('change', updateLogSummary);
});



