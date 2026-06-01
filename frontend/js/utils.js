import './config.js';
import './state.js';

export function friendlyError(rawMessage) {
    const m = (rawMessage || '').toLowerCase();
    if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('network request failed')) {
        return 'Cannot reach the server. Check that the API is running at ' + FLEET_API_URL + '.';
    }
    if (m.includes('cors') || m.includes('blocked by cors')) {
        return 'Request blocked by CORS. Ensure ALLOWED_ORIGIN in .env includes this page\'s address.';
    }
    if (m.includes('401') || m.includes('unauthorized') || m.includes('invalid or missing')) {
        return 'Authentication failed. Check your FLEET_API_KEY is correct.';
    }
    if (m.includes('403') || m.includes('forbidden')) {
        return 'Access denied. Your API key may not have permission for this action.';
    }
    if (m.includes('404')) {
        return 'Resource not found. The API endpoint may have changed.';
    }
    if (m.includes('422')) {
        return 'The data sent was invalid. Check all required fields are filled correctly.';
    }
    if (m.includes('500') || m.includes('internal server')) {
        return 'Server error. Check the FastAPI logs for details.';
    }
    if (m.includes('timeout') || m.includes('timed out')) {
        return 'Request timed out. The server is taking too long to respond.';
    }
    return rawMessage || 'An unexpected error occurred.';
}

/**
 * Shows a toast notification. Auto-dismisses after 4 seconds.
 * type: 'success' | 'error' | 'warning' | 'info'
 */
export function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        error:   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
        warning: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        info:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
        <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Renders a clean empty-state error panel inside a table tbody.
 * colspan: number of columns in the table
 * retryFn: string name of the function to call on retry (e.g. 'loadCarsData')
 */
export function showTableError(tbodySelector, colspan, heading, subtext, retryFn) {
    const tbody = document.querySelector(tbodySelector);
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="${colspan}" style="padding: 0; border: none;">
                <div class="table-error-state">
                    <svg class="table-error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 7h18M3 12h18M3 17h18"/><line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444" stroke-width="2"/>
                    </svg>
                    <div class="table-error-heading">${heading}</div>
                    <div class="table-error-subtext">${subtext}</div>
                    ${retryFn ? `<button class="table-error-retry" onclick="${retryFn}()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        Try again
                    </button>` : ''}
                </div>
            </td>
        </tr>
    `;
}

// ============================================================================
// SIDEBAR NAVIGATION & TAB SWITCHING
// ============================================================================

// switchTab is defined here so it can be called from anywhere.
// The actual wiring of click listeners happens inside setupNavigation()
// which is called from the single DOMContentLoaded block at the bottom.

export function setDropdownLoading(selectId, statusId, retryBtnId) {
    const select = document.getElementById(selectId);
    const retryBtn = document.getElementById(retryBtnId);
    if (select) {
        select.innerHTML = '<option value="">Loading...</option>';
        select.disabled = true;
    }
    if (retryBtn) retryBtn.disabled = true;
    setDropdownStatus(statusId, 'info', 'Fetching data...');
}

export function setDropdownStatus(statusId, type, message) {
    const el = document.getElementById(statusId);
    if (!el) return;
    el.className = 'dropdown-loading ' + type;
    el.textContent = message;
}

export function setDropdownError(selectId, statusId, retryBtnId, errorMsg) {
    const select = document.getElementById(selectId);
    const retryBtn = document.getElementById(retryBtnId);
    if (select) {
        select.innerHTML = '<option value="">Failed to load — click Retry</option>';
        select.disabled = false;
    }
    if (retryBtn) retryBtn.disabled = false;
    setDropdownStatus(statusId, 'error', friendlyError(errorMsg));
    console.error('Dropdown error [' + selectId + ']:', errorMsg);
}

export function setDropdownSuccess(selectId, statusId, retryBtnId, count, label) {
    const select = document.getElementById(selectId);
    const retryBtn = document.getElementById(retryBtnId);
    if (select) select.disabled = false;
    if (retryBtn) retryBtn.disabled = false;

    if (count === 0) {
        setDropdownStatus(statusId, 'error', 'No ' + label + ' registered yet');
    } else {
        setDropdownStatus(statusId, 'success', count + ' ' + label + ' loaded');
        setTimeout(() => setDropdownStatus(statusId, '', ''), 3000);
    }
}


export function setSubmitLoading(buttonId, isLoading) {
    const btn = document.getElementById(buttonId);
    const textSpan = document.getElementById(buttonId.replace('Btn', 'Text'));
    if (isLoading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}


export function renderPagination(tableKey, total, currentPage, pageSize, onPageChange) {
    const containerId = tableKey === 'cars' ? 'carsPagination' : 'driversPagination';
    const container = document.getElementById(containerId);
    if (!container) return;

    if (total <= pageSize) {
        container.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(total / pageSize);

    function btn(label, page, isActive, isDisabled) {
        const cls = ['pg-btn', isActive ? 'active' : ''].filter(Boolean).join(' ');
        const dis = isDisabled ? 'disabled' : '';
        return `<button class="${cls}" ${dis} onclick="(function(){_pagination['${tableKey}'].page=${page};${tableKey === 'cars' ? 'populateCarsTable(allCars)' : 'populateDriversTable(allDrivers)'};})()">${label}</button>`;
    }

    let pages = '';
    // Always show first, last, and ±1 around current
    const show = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]
        .filter(p => p >= 1 && p <= totalPages));
    const sorted = Array.from(show).sort((a, b) => a - b);

    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) {
            pages += '<span class="pg-ellipsis">…</span>';
        }
        pages += btn(p, p, p === currentPage, false);
    });

    container.innerHTML =
        btn('‹ Prev', currentPage - 1, false, currentPage === 1) +
        pages +
        btn('Next ›', currentPage + 1, false, currentPage === totalPages);
}



