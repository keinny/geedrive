import { FleetAPI } from './api.js';
import { _cache } from './cache.js';
import { loadCarsData } from './cars.js';
import { loadDashboardData } from './dashboard.js';
import { loadCarsData_Init, loadDriversData_Init } from './dropdowns.js';
import { pagination, setAllLogs, state } from './state.js';
import { exportToCSV, fmtZMW, friendlyError, renderPagination, setSubmitLoading, showTableError, showTableSkeleton, showToast } from './utils.js';

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

    const sortedLogs = sortLogs(logs);
    const pageState = pagination.logs;
    pageState.total = sortedLogs.length;
    const start = (pageState.page - 1) * pageState.pageSize;
    const pageData = sortedLogs.slice(start, start + pageState.pageSize);

    pageData.forEach(log => {
        const row = document.createElement('tr');
        const created = log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A';
        row.innerHTML = `
            <td>${created}</td>
            <td><strong>${log.driverName || 'N/A'}</strong></td>
            <td>${log.car || 'N/A'}</td>
            <td><span class="plate-badge">${log.plateNumber || 'N/A'}</span></td>
            <td>
                <div class="ctx-menu-wrapper">
                    <button class="ctx-menu-btn" data-action="toggle-context-menu" title="More actions" aria-label="More actions" aria-haspopup="menu" aria-expanded="false">
                        <i data-lucide="more-vertical" aria-hidden="true"></i>
                    </button>
                    <div class="ctx-menu" role="menu">
                        <button class="ctx-item" data-action="view-log-entry" data-log-id="${log.id}" role="menuitem">
                            <i data-lucide="eye" aria-hidden="true"></i> View Details
                        </button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    renderPagination('logs', pagination.logs.total, pagination.logs.page, pagination.logs.pageSize);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function sortLogs(logs) {
    const mode = state.logsSortMode || document.getElementById('logsSortSelect')?.value || 'created-desc';
    const dateValue = value => {
        const time = value ? new Date(value).getTime() : 0;
        return Number.isFinite(time) ? time : 0;
    };
    const monthValue = log => {
        const source = log.weekStartDate || log.createdAt;
        const date = source ? new Date(source) : null;
        if (!date || Number.isNaN(date.getTime())) return 0;
        return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    };

    return [...logs].sort((a, b) => {
        if (mode === 'week-desc') return dateValue(b.weekStartDate) - dateValue(a.weekStartDate);
        if (mode === 'month-desc') return monthValue(b) - monthValue(a);
        return dateValue(b.createdAt) - dateValue(a.createdAt);
    });
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

    const netColor = net >= 0 ? 'var(--primary)' : 'var(--danger)';

    panel.innerHTML = `
        ${vehicle ? `<div class="log-summary-row"><label>Vehicle</label><span>${vehicle}</span></div>` : ''}
        ${driver  ? `<div class="log-summary-row"><label>Driver</label><span>${driver}</span></div>` : ''}
        ${distance > 0 ? `<div class="log-summary-row"><label>Distance</label><span>${distance.toLocaleString()} km</span></div>` : ''}
        ${revenue > 0  ? `<div class="log-summary-row"><label>Revenue</label><span>${fmtZMW(revenue)}</span></div>` : ''}
        ${expense > 0  ? `<div class="log-summary-row"><label>Expenses</label><span>${fmtZMW(expense)}</span></div>` : ''}
        ${spares > 0  ? `<div class="log-summary-row"><label>Spares</label><span>${fmtZMW(spares)}</span></div>` : ''}
        ${shortage > 0 ? `<div class="log-summary-row"><label>Shortage</label><span style="color:var(--danger)">${fmtZMW(shortage)}</span></div>` : ''}
        <div class="log-summary-net">
            <label>Net Income</label>
            <div class="net-value" style="color:${netColor}">${fmtZMW(net)}</div>
        </div>
    `;
}

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[ch]));
}

export function openLogDetailModal(logId) {
    const log = state.allLogs.find(l => String(l.id) === String(logId));
    if (!log) {
        showToast('Log not found', '', 'error');
        return;
    }

    const dist = Math.max(0, (Number(log.closingMileage) || 0) - (Number(log.startMileage) || 0));
    const net = (Number(log.totalRevenue) || 0) - (Number(log.expenseOnCar) || 0) - (Number(log.shortage) || 0) - (Number(log.sparesCost) || 0);
    const netColor = net >= 0 ? 'var(--gd-success)' : 'var(--gd-danger)';

    document.getElementById('logDetailModalTitle').textContent =
        `Log - ${log.driverName || 'Unknown'} · ${log.plateNumber || ''}`;

    document.getElementById('logDetailBody').innerHTML = `
        <div class="log-detail-header">
            <div class="log-detail-hero">
                <div class="log-detail-hero-item">
                    <span class="log-detail-label">Driver</span>
                    <span class="log-detail-value">${esc(log.driverName || 'N/A')}</span>
                </div>
                <div class="log-detail-hero-item">
                    <span class="log-detail-label">Vehicle</span>
                    <span class="log-detail-value">${esc(log.car || 'N/A')}</span>
                </div>
                <div class="log-detail-hero-item">
                    <span class="log-detail-label">Plate</span>
                    <span class="plate-badge">${esc(log.plateNumber || 'N/A')}</span>
                </div>
                <div class="log-detail-hero-item">
                    <span class="log-detail-label">Week Start</span>
                    <span class="log-detail-value">${esc(log.weekStartDate || 'N/A')}</span>
                </div>
                <div class="log-detail-hero-item">
                    <span class="log-detail-label">Submitted</span>
                    <span class="log-detail-value">${log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A'}</span>
                </div>
            </div>
        </div>
        <div class="log-detail-section">
            <div class="log-detail-section-title"><i data-lucide="map-pin"></i> Mileage</div>
            <div class="log-detail-grid-3">
                <div class="log-detail-stat">
                    <span class="log-detail-stat-label">Start Mileage</span>
                    <span class="log-detail-stat-value">${(Number(log.startMileage) || 0).toLocaleString()} km</span>
                </div>
                <div class="log-detail-stat">
                    <span class="log-detail-stat-label">Closing Mileage</span>
                    <span class="log-detail-stat-value">${(Number(log.closingMileage) || 0).toLocaleString()} km</span>
                </div>
                <div class="log-detail-stat">
                    <span class="log-detail-stat-label">Distance Covered</span>
                    <span class="log-detail-stat-value" style="color:${dist > 450 ? 'var(--gd-warning)' : 'var(--gd-success)'}">
                        ${dist.toLocaleString()} km
                        ${dist > 450 ? '<span class="badge-warning gd-badge" style="margin-left:6px;">Flagged</span>' : ''}
                    </span>
                </div>
            </div>
        </div>
        <div class="log-detail-section">
            <div class="log-detail-section-title"><i data-lucide="dollar-sign"></i> Financials</div>
            <div class="log-detail-grid-4">
                <div class="log-detail-stat">
                    <span class="log-detail-stat-label">Total Revenue</span>
                    <span class="log-detail-stat-value success">${fmtZMW(log.totalRevenue)}</span>
                </div>
                <div class="log-detail-stat">
                    <span class="log-detail-stat-label">Car Expenses</span>
                    <span class="log-detail-stat-value">${fmtZMW(log.expenseOnCar)}</span>
                </div>
                <div class="log-detail-stat">
                    <span class="log-detail-stat-label">Spares Cost</span>
                    <span class="log-detail-stat-value">${fmtZMW(log.sparesCost)}</span>
                </div>
                <div class="log-detail-stat">
                    <span class="log-detail-stat-label">Shortage</span>
                    <span class="log-detail-stat-value" style="color:${(Number(log.shortage) || 0) > 0 ? 'var(--gd-danger)' : 'inherit'}">${fmtZMW(log.shortage)}</span>
                </div>
            </div>
            ${log.sparesBought ? `
            <div class="log-detail-spares">
                <span class="log-detail-label">Spares Bought:</span>
                <span>${esc(log.sparesBought)}</span>
            </div>` : ''}
            <div class="log-detail-net">
                <span class="log-detail-net-label">Net Income</span>
                <span class="log-detail-net-value" style="color:${netColor}">${fmtZMW(net)}</span>
            </div>
        </div>
        ${log.comments ? `
        <div class="log-detail-section">
            <div class="log-detail-section-title"><i data-lucide="message-square"></i> Comments</div>
            <p class="log-detail-comments">${esc(log.comments)}</p>
        </div>` : ''}
    `;

    document.getElementById('logDetailModal').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function closeLogDetailModal() {
    document.getElementById('logDetailModal')?.classList.remove('show');
}

export function exportLogs() {
    if (!state.allLogs.length) {
        showToast('No data', 'No logs to export.', 'info');
        return;
    }
    const headers = ['Date Created', 'Driver', 'Vehicle', 'Plate', 'Week Start', 'Start Mileage', 'Closing Mileage', 'Distance (km)', 'Revenue (ZMW)', 'Expenses (ZMW)', 'Shortage (ZMW)', 'Spares (ZMW)', 'Net Income (ZMW)', 'Comments'];
    const rows = state.allLogs.map(l => {
        const dist = Math.max(0, (Number(l.closingMileage) || 0) - (Number(l.startMileage) || 0));
        const net = (Number(l.totalRevenue) || 0) - (Number(l.expenseOnCar) || 0) - (Number(l.shortage) || 0) - (Number(l.sparesCost) || 0);
        return [
            l.createdAt ? new Date(l.createdAt).toLocaleString() : '',
            l.driverName,
            l.car,
            l.plateNumber,
            l.weekStartDate,
            l.startMileage,
            l.closingMileage,
            dist,
            (Number(l.totalRevenue) || 0).toFixed(2),
            (Number(l.expenseOnCar) || 0).toFixed(2),
            (Number(l.shortage) || 0).toFixed(2),
            (Number(l.sparesCost) || 0).toFixed(2),
            net.toFixed(2),
            l.comments || ''
        ];
    });
    exportToCSV(`geedrive-logs-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
}
