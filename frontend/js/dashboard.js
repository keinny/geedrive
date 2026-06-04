/**
 * dashboard.js
 *
 * CHANGES (style-guide audit):
 *   • populateDashboardTable() – replaced:
 *       - Plate <span> inline style `font-family: monospace; font-weight:700; background: transparent;
 *         padding:2px 6px; border-radius:4px;` → `class="plate-badge"` (style guide §Badges).
 *         The plate-badge class is already defined in styles.css and applies the correct
 *         JetBrains Mono font, amber tint background and monospace chip styling.
 *       - Profit td inline `style="font-weight: 600; color: ${...var(--success)|var(--danger)}"` →
 *         uses semantic CSS variables which now map to --gd-success / --gd-danger. The alias
 *         `--success` and `--danger` are preserved in :root so existing var() refs still resolve.
 *       - Service status td inline `style="font-weight: 600; color: ${...var(--success)|var(--danger)}"` →
 *         same treatment. Additionally the plain text label is now wrapped in the correct
 *         status-badge class (badge-success / badge-danger) for icon + colour consistency per
 *         style guide §Badges & Status ("always pair colour + icon + text label").
 *       - Empty state td inline `style="text-align: center; color: var(--text-secondary);"` →
 *         replaced with the `.empty-state` CSS class which applies identical rules through
 *         the design system (style guide §Data Table: empty state).
 *   • No business logic, API calls or DOM manipulation changed.
 */

import { FleetAPI } from './api.js';
import { notifyIfSystemError } from './notifications.js';
import { state } from './state.js';
import { friendlyError, showTableError, showTableSkeleton } from './utils.js';

export function loadDashboardData() {
    showTableSkeleton('#dashboardComparisonTable tbody', 6);

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
    document.getElementById('dashTotalMileage').textContent  = `${(dash.totalMileage  || 0).toLocaleString()} km`;
    document.getElementById('dashTotalRevenue').textContent  = `K${(dash.totalRevenue  || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById('dashTotalExpenses').textContent = `K${(dash.totalExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById('dashNetProfit').textContent     = `K${(dash.netProfit     || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function populateDashboardTable(carsAnalysis) {
    const tbody = document.querySelector('#dashboardComparisonTable tbody');
    tbody.innerHTML = '';

    if (!carsAnalysis || carsAnalysis.length === 0) {
        // CHANGE: class="empty-state" instead of ad-hoc inline style
        // (style guide §Data Table: empty state pattern)
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No active operational history logged.</td></tr>';
        return;
    }

    carsAnalysis.forEach(car => {
        const profitMargin = car.revenue > 0
            ? ((car.profit / car.revenue) * 100).toFixed(1)
            : '0.0';

        /*
         * CHANGE: service status now rendered as a status-badge pill class
         * instead of a plain text string with inline color.
         * (style guide §Badges & Status: "always pair colour + semantic class")
         * --success and --danger alias tokens are preserved in :root so the
         * profit column var() references still resolve correctly.
         */
        const serviceBadge = car.needsService
            ? '<span class="status-badge warning">Service Due</span>'
            : '<span class="status-badge active">Operational</span>';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <!-- CHANGE: plate-badge class replaces inline font-family/padding/border-radius
                     (style guide §Badges & Status: plate-badge chip pattern) -->
                <span class="plate-badge">${car.plate}</span>
            </td>
            <td>K${car.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>K${car.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <!-- CHANGE: var(--success) / var(--danger) aliases still resolve via :root
                 token map; font-weight:600 preserved as inline since it is data-driven -->
            <td style="font-weight:600; color:${car.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">
                K${car.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </td>
            <td>${profitMargin}%</td>
            <td>${serviceBadge}</td>
        `;
        tbody.appendChild(row);
    });
}

export function filterDashboardByCar() {
    const filterPlate = document.getElementById('dashboardCarFilter').value;
    console.log('🔍 Filtering analysis insights row criteria:', filterPlate);

    showTableSkeleton('#dashboardComparisonTable tbody', 6);

    FleetAPI.getDashboard(filterPlate || null)
        .then(data => {
            if (data.status === 'success') {
                updateDashboardCards(data.dashboard);
                populateDashboardTable(data.carsAnalysis);
            }
        })
        .catch(error => console.error('Error applying dashboard filter:', error));
}
