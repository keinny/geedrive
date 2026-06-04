import { FleetAPI } from './api.js';
import { _cache } from './cache.js';
import { loadCarsData } from './cars.js';
import { loadDashboardData } from './dashboard.js';
import { loadCarsData_Init, loadDriversData_Init } from './dropdowns.js';
import { pagination, setAllLogs, state } from './state.js';
import { friendlyError, renderPagination, setSubmitLoading, showTableError, showTableSkeleton, showToast } from './utils.js';

let weeklyLogEventsBound = false;

export function initializeForm() {
    // Setup protocol warnings
    if (window.location.protocol === 'file:') {
        document.getElementById('fileProtocolWarning').style.display = 'block';
    }

    // Standardize today's date context injection default limits
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    document.getElementById('year').value = new Date().getFullYear();

    // Execute asynchronous fetches for drop options initial loads
    loadDriversData_Init().catch(err => console.error('Initial drivers load failed:', err));
    loadCarsData_Init().catch(err => console.error('Initial vehicles load failed:', err));
}

export function setupWeeklyLog() {
    if (weeklyLogEventsBound) return;
    weeklyLogEventsBound = true;

    document.getElementById('startMileage')?.addEventListener('input', calculateMileageDifference);
    document.getElementById('closingMileage')?.addEventListener('input', calculateMileageDifference);
    document.querySelectorAll('[data-action="close-weekly-log-modal"]').forEach(btn => {
        btn.addEventListener('click', closeWeeklyLogModal);
    });
    ['carPlate','driverName','startMileage','closingMileage','totalRevenue','expenseOnCar','shortage'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateLogSummary);
        document.getElementById(id)?.addEventListener('change', updateLogSummary);
    });
    document.getElementById('sparesBought')?.addEventListener('input', updateLogSummary);
    document.getElementById('sparesCost')?.addEventListener('input', updateLogSummary);
    document.getElementById('fleetForm')?.addEventListener('reset', () => {
        setTimeout(() => {
            calculateMileageDifference();
            updateLogSummary();
        }, 0);
    });
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

export function handleWeeklyLogSubmit(event) {
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

    const formData = new FormData(event.currentTarget);
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
            closeWeeklyLogModal();
            _cache.invalidate('logs');
            _cache.invalidate('dashboard');
            _cache.invalidate('cars');
            _cache.invalidate('carsAnalytics');
            document.getElementById('fleetForm').reset();
            initializeForm();
            loadWeeklyLogs();
            loadDashboardData();
            loadCarsData().catch(() => {});
        } else {
            showToast('Submission failed', result.message || 'An error occurred.', 'error');
        }
    })
    .catch(error => {
        setSubmitLoading('submitBtn', false);
        showToast('Submission failed', friendlyError(error.message), 'error');
    });
}

export function openWeeklyLogModal() {
    document.getElementById('weeklyLogModal')?.classList.add('show');
    initializeForm();
    updateLogSummary();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function closeWeeklyLogModal() {
    document.getElementById('weeklyLogModal')?.classList.remove('show');
}

export function loadWeeklyLogs() {
    if (!_cache.isStale('logs') && _cache.logs) {
        pagination.logs.page = 1;
        setAllLogs(_cache.logs);
        populateLogsTable(state.allLogs);
        return Promise.resolve(state.allLogs);
    }

    showTableSkeleton('#logsTable tbody', 5);

    return FleetAPI.getLogs()
        .then(data => {
            if (data.status !== 'success') throw new Error('Unexpected response shape');
            setAllLogs(data.logs);
            _cache.set('logs', data.logs);
            pagination.logs.page = 1;
            populateLogsTable(state.allLogs);
            return state.allLogs;
        })
        .catch(error => {
            showTableError('#logsTable tbody', 5,
                'Could not load weekly logs',
                friendlyError(error.message),
                'loadWeeklyLogs'
            );
            throw error;
        });
}

export function populateLogsTable(logs) {
    const tbody = document.querySelector('#logsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No weekly logs submitted yet.</td></tr>';
        renderPagination('logs', 0, 1, pagination.logs.pageSize);
        return;
    }

    const pageState = pagination.logs;
    pageState.total = logs.length;
    const start = (pageState.page - 1) * pageState.pageSize;
    const pageData = logs.slice(start, start + pageState.pageSize);

    pageData.forEach(log => {
        const row = document.createElement('tr');
        const created = log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A';
        row.innerHTML = `
            <td>${created}</td>
            <td><strong>${log.driverName || 'N/A'}</strong></td>
            <td>${log.car || 'N/A'}</td>
            <td><span class="plate-badge">${log.plateNumber || 'N/A'}</span></td>
            <td><button class="btn-small btn-view" data-action="view-log-entry" data-log-id="${log.id}">View</button></td>
        `;
        tbody.appendChild(row);
    });

    renderPagination('logs', pagination.logs.total, pagination.logs.page, pagination.logs.pageSize);
}


export function updateLogSummary() {
    const vehicle = document.getElementById('carPlate')?.value || '';
    const driver  = document.getElementById('driverName')?.value || '';
    const start   = parseFloat(document.getElementById('startMileage')?.value) || 0;
    const close   = parseFloat(document.getElementById('closingMileage')?.value) || 0;
    const revenue = parseFloat(document.getElementById('totalRevenue')?.value) || 0;
    const expense = parseFloat(document.getElementById('expenseOnCar')?.value) || 0;
    const shortage= parseFloat(document.getElementById('shortage')?.value) || 0;
    const spares = parseFloat(document.getElementById('sparesCost')?.value) || 0;
    const distance = Math.max(0, close - start);
    const net = revenue - expense - shortage - spares;

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
        ${spares > 0  ? `<div class="log-summary-row"><label>Spares</label><span>${fmt(spares)}</span></div>` : ''}
        ${shortage > 0 ? `<div class="log-summary-row"><label>Shortage</label><span style="color:var(--danger)">${fmt(shortage)}</span></div>` : ''}
        <div class="log-summary-net">
            <label>Net Income</label>
            <div class="net-value" style="color:${netColor}">${fmt(net)}</div>
        </div>
    `;
}
