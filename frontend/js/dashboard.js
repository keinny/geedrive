import { FleetAPI } from './api.js';
import { notifyIfSystemError } from './notifications.js';
import { state } from './state.js';
import { friendlyError, showTableError } from './utils.js';

export function loadDashboardData() {
    const tableBody = document.querySelector('#dashboardComparisonTable tbody');
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Loading dashboard...</td></tr>';

    FleetAPI.getDashboard()
        .then(data => {
            if (data.status === 'success') {
                state.filteredWeeklyMileage = {};
                if (data.carsAnalysis && Array.isArray(data.carsAnalysis)) {
                    data.carsAnalysis.forEach(c => {
                        state.filteredWeeklyMileage[c.plate] = c.weeklyMileage || 0;
                    });
                }
                updateDashboardCards(data.dashboard);
                populateDashboardTable(data.carsAnalysis);
            } else {
                showTableError('#dashboardComparisonTable tbody', 6,
                    'Could not load dashboard',
                    'The server returned an unexpected response.',
                    'loadDashboardData'
                );
            }
        })
        .catch(error => {
            showTableError('#dashboardComparisonTable tbody', 6,
                'Could not load dashboard',
                friendlyError(error.message),
                'loadDashboardData'
            );
            notifyIfSystemError(error.message, 'Could not load dashboard');
        });
}

export function updateDashboardCards(dash) {
    if (!dash) return;
    document.getElementById('dashTotalMileage').textContent = `${(dash.totalMileage || 0).toLocaleString()} km`;
    document.getElementById('dashTotalRevenue').textContent = `K${(dash.totalRevenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('dashTotalExpenses').textContent = `K${(dash.totalExpenses || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('dashNetProfit').textContent = `K${(dash.netProfit || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
}

export function populateDashboardTable(carsAnalysis) {
    const tbody = document.querySelector('#dashboardComparisonTable tbody');
    tbody.innerHTML = '';

    if (!carsAnalysis || carsAnalysis.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No active operational history logged.</td></tr>';
        return;
    }

    carsAnalysis.forEach(car => {
        const profitMargin = car.revenue > 0 ? ((car.profit / car.revenue) * 100).toFixed(1) : '0.0';
        
        const serviceDue = car.needsService
            ? 'Service Due'
            : 'Operational';
        const serviceColor = car.needsService ? 'var(--danger)' : 'var(--success)';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span style="font-family: monospace; font-weight:700; background: transparent; padding:2px 6px; border-radius:4px;">${car.plate}</span></td>
            <td>K${car.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td>K${car.expenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td style="font-weight: 600; color: ${car.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">K${car.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td>${profitMargin}%</td>
            <td style="font-weight: 600; color: ${serviceColor}">${serviceDue}</td>
        `;
        tbody.appendChild(row);
    });
}

export function filterDashboardByCar() {
    const filterPlate = document.getElementById('dashboardCarFilter').value;
    console.log('🔍 Filtering analysis insights row criteria:', filterPlate);
    
    const tableBody = document.querySelector('#dashboardComparisonTable tbody');
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Loading dashboard...</td></tr>';

    FleetAPI.getDashboard(filterPlate || null)
        .then(data => {
            if (data.status === 'success') {
                updateDashboardCards(data.dashboard);
                populateDashboardTable(data.carsAnalysis);
            }
        })
        .catch(error => console.error('Error applying dashboard filter:', error));
}


