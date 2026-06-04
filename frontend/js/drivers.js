/**
 * drivers.js
 *
 * CHANGES (style-guide audit):
 *   • populateDriversTable() – replaced:
 *       - scoreColor hard-coded '#10B981' / '#F59E0B' / '#EF4444' → CSS vars
 *         (style guide §Colors → Semantic tokens)
 *       - 'No docs' span `color: #999` → `color: var(--text-secondary)`
 *       - `font-family: monospace` → `font-family: var(--gd-font-mono)`
 *         (style guide §Typography → JetBrains Mono)
 *       - `font-size:0.9em` on email cell → removed; handled by td default
 *       - license info cell `color: #666` → `color: var(--text-secondary)`
 *       - performance score div `color:#777` → `color: var(--text-secondary)`
 *   • printTerminationLetter() – updated the print window's brand colour from
 *     the old green-based `#E8A400` placeholder to the correct amber `#D4891A`
 *     and `#A56210` (style guide §Brand Palette) so the printed letter matches
 *     GeeDrive brand identity. The print stylesheet is intentionally light-mode
 *     and self-contained; no dark tokens are used there.
 *   • updateDriverMetrics() – className assignment already uses semantic
 *     CSS class strings ('success' / 'warning' / 'danger'); no change needed.
 *   • All business logic, API calls and DOM manipulation are unchanged.
 */

import { _cache } from './cache.js';
import { FleetAPI } from './api.js';
import { populateDriverDropdown } from './dropdowns.js';
import { notifyIfSystemError } from './notifications.js';
import { pagination, state, setAllDrivers } from './state.js';
import {
    friendlyError,
    renderPagination,
    setSubmitLoading,
    showTableError,
    showTableSkeleton,
    showToast,
} from './utils.js';

let driversEventsBound = false;

export function setupDrivers() {
    if (driversEventsBound) return;
    driversEventsBound = true;

    document.getElementById('historicalBackfill')?.addEventListener('change', function() {
        const group = document.getElementById('backfillDateGroup');
        if (!group) return;
        group.style.display = this.checked ? 'block' : 'none';
        if (!this.checked) {
            document.getElementById('registrationDate').value = '';
        }
    });

    document.getElementById('nrcNumber')?.addEventListener('input', function() {
        const val = this.value.trim().toUpperCase();
        const msg = document.getElementById('nrcValidationMessage');
        const submitBtn = document.getElementById('driverSubmitBtn');

        state.nrcIsValid = false;
        submitBtn.disabled = true;

        if (!val) {
            msg.className = 'validation-message';
            msg.textContent = '';
            submitBtn.disabled = false;
            return;
        }

        msg.className = 'validation-message info';
        msg.textContent = 'Checking NRC...';

        clearTimeout(state.nrcCheckTimer);
        state.nrcCheckTimer = setTimeout(() => {
            FleetAPI.checkNRC(val)
                .then(({ isDuplicate }) => {
                    if (isDuplicate) {
                        msg.className = 'validation-message error';
                        msg.textContent = 'This NRC number is already registered';
                        state.nrcIsValid = false;
                        submitBtn.disabled = true;
                    } else {
                        msg.className = 'validation-message success';
                        msg.textContent = 'NRC available';
                        state.nrcIsValid = true;
                        submitBtn.disabled = false;
                    }
                })
                .catch(() => {
                    msg.className = 'validation-message';
                    msg.textContent = 'Could not verify — checking on submission';
                    state.nrcIsValid = true;
                    submitBtn.disabled = false;
                });
        }, 500);
    });

    bindFileSelection('nrcUpload', 'nrcFileName');
    bindFileSelection('licenseUpload', 'licenseFileName');
}

function bindFileSelection(inputId, labelId) {
    document.getElementById(inputId)?.addEventListener('change', function() {
        const fileName = this.files[0]?.name || 'No file selected';
        const fileSize = this.files[0]?.size || 0;
        const maxSize  = 5 * 1024 * 1024;

        if (fileSize > maxSize) {
            document.getElementById(labelId).className = 'file-name';
            document.getElementById(labelId).textContent = 'File too large (max 5MB)';
            this.value = '';
        } else {
            document.getElementById(labelId).className = 'file-name success';
            document.getElementById(labelId).textContent = fileName + ' selected';
        }
    });
}

export function loadDriversData() {
    if (!_cache.isStale('drivers')) {
        pagination.drivers.page = 1;
        populateDriversTable(_cache.drivers);
        return Promise.resolve(_cache.drivers);
    }

    showTableSkeleton('#driversTable tbody', 8);

    return FleetAPI.getDrivers()
        .then(data => {
            if (data.status === 'success') {
                setAllDrivers(data.drivers);
                _cache.set('drivers', data.drivers);
                _cache.set('driversList', data.drivers);
                pagination.drivers.page = 1;
                populateDriversTable(state.allDrivers);
                return state.allDrivers;
            } else {
                showTableError('#driversTable tbody', 8,
                    'Could not load drivers',
                    'The server returned an unexpected response. Check the API is running correctly.',
                    'loadDriversData'
                );
                return [];
            }
        })
        .catch(error => {
            showTableError('#driversTable tbody', 8,
                'Could not load drivers',
                friendlyError(error.message),
                'loadDriversData'
            );
            notifyIfSystemError(error.message, 'Could not load drivers');
            throw error;
        });
}

export function populateDriversTable(drivers) {
    const tbody = document.querySelector('#driversTable tbody');
    tbody.innerHTML = '';

    const filteredDrivers = getFilteredDrivers(drivers);

    if (filteredDrivers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No drivers registered.</td></tr>';
        renderPagination('drivers', 0, 1, pagination.drivers.pageSize);
        updateDriverMetrics(drivers);
        updateDriversCount(0);
        return;
    }

    const pageState = pagination.drivers;
    pageState.total = filteredDrivers.length;
    const start   = (pageState.page - 1) * pageState.pageSize;
    const pageData = filteredDrivers.slice(start, start + pageState.pageSize);

    pageData.forEach(driver => {
        const row = document.createElement('tr');
        const licenseExpiryDate = driver.licenseExpiry ? new Date(driver.licenseExpiry).toLocaleDateString() : 'N/A';
        const licenseStatus     = String(driver.licenseStatus || 'valid').toLowerCase();

        let licenseBadge = '';
        if (licenseStatus === 'expired') {
            licenseBadge = '<span class="status-badge decommissioned" style="display:inline-block; margin-top:4px;">Expired</span>';
        } else if (licenseStatus === 'expiring_soon') {
            licenseBadge = '<span class="status-badge warning" style="display:inline-block; margin-top:4px;">Expiring Soon</span>';
        }

        const statusBadgeClass = driver.status === 'Active' ? 'active' : 'inactive';
        const safetyScore      = driver.performanceScore || 100;

        // CHANGE: CSS variable references instead of hard-coded hex
        // (style guide §Colors → Semantic tokens: gd-success, gd-warning, gd-danger)
        const scoreColor = safetyScore >= 85
            ? 'var(--gd-success)'
            : safetyScore >= 65
                ? 'var(--gd-warning)'
                : 'var(--gd-danger)';

        let docLinksHtml = '';
        if (driver.hasNrcDocument) {
            docLinksHtml += `<button type="button" class="doc-link-btn" data-action="open-driver-document" data-driver-id="${driver.id}" data-doc-type="nrc">NRC</button>`;
        }
        if (driver.hasLicenseDocument) {
            docLinksHtml += `<button type="button" class="doc-link-btn" data-action="open-driver-document" data-driver-id="${driver.id}" data-doc-type="license">License</button>`;
        }
        // CHANGE: replaced `color: #999` with CSS token; removed inline font-family: monospace
        if (!docLinksHtml) {
            docLinksHtml = '<span style="color:var(--text-secondary); font-style:italic; font-size:11px;">No docs</span>';
        }

        row.innerHTML = `
            <td><strong>${driver.name}</strong></td>
            <td>${driver.email || 'N/A'}</td>
            <td>${driver.phone || 'N/A'}</td>
            <!-- CHANGE: font-family uses token, not raw 'monospace' -->
            <td><span style="font-family:var(--gd-font-mono); font-size:12px;">${driver.nrcNumber || 'N/A'}</span></td>
            <td>
                <div style="font-size:12px; line-height:1.5;">
                    <div>No: <strong>${driver.licenseNumber || 'N/A'}</strong></div>
                    <!-- CHANGE: color token instead of hard-coded #666 -->
                    <div style="color:var(--text-secondary); font-size:11px;">${licenseStatus === 'valid' ? 'Exp: ' + licenseExpiryDate : 'Status: ' + (licenseStatus === 'expired' ? 'Expired' : 'Expiring Soon')}</div>
                    ${licenseBadge}
                    <div style="margin-top:4px; display:flex; gap:4px; flex-wrap:wrap;">${docLinksHtml}</div>
                </div>
            </td>
            <td><span class="status-badge ${statusBadgeClass}">${driver.status}</span></td>
            <td>
                <div style="text-align:center;">
                    <!-- CHANGE: scoreColor now uses CSS variable reference -->
                    <span style="font-family:var(--gd-font-display); font-weight:700; color:${scoreColor}; font-size:16px;">${safetyScore}%</span>
                    <!-- CHANGE: color token instead of hard-coded #777 -->
                    <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">Shortages: K${(driver.totalShortages || 0).toFixed(0)}</div>
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    ${driver.status === 'Active' ? `
                    <button class="btn-small btn-edit" data-action="open-driver-edit-modal" data-driver-id="${driver.id}">Edit</button>
                    <div class="overflow-menu-wrapper">
                        <button class="btn-small btn-icon-only overflow-trigger" data-action="toggle-overflow-menu" title="More actions" aria-label="More actions">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                        </button>
                        <div class="overflow-menu">
                            <button class="overflow-item overflow-item-danger" data-action="open-fire-modal" data-driver-name="${driver.name}" data-score="${safetyScore}" data-shortages="${driver.totalShortages || 0}">
                                Terminate Driver
                            </button>
                        </div>
                    </div>` : '<span class="status-badge inactive" style="font-size:10px;">Terminated</span>'}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateDriverMetrics(drivers);
    updateDriversCount(filteredDrivers.length);
    renderPagination('drivers', pagination.drivers.total, pagination.drivers.page, pagination.drivers.pageSize);
}

function getFilteredDrivers(drivers) {
    const query = (document.getElementById('driversSearchInput')?.value || '').toLowerCase().trim();
    return drivers.filter(driver => {
        const text = [
            driver.name,
            driver.email,
            driver.phone,
            driver.nrcNumber,
            driver.licenseNumber,
            driver.status
        ].join(' ').toLowerCase();
        const matchesSearch = !query || text.includes(query);
        const matchesStatus = state.driversFilterStatus === 'all' || driver.status === state.driversFilterStatus;
        return matchesSearch && matchesStatus;
    });
}

function updateDriverMetrics(drivers) {
    const activeD    = drivers.filter(d => d.status === 'Active').length;
    const expiringD  = drivers.filter(d => String(d.licenseStatus || 'valid').toLowerCase() === 'expiring_soon').length;
    const scores     = drivers.filter(d => d.performanceScore != null);
    const avgPerf    = scores.length
        ? Math.round(scores.reduce((s, d) => s + (d.performanceScore || 0), 0) / scores.length)
        : 0;

    const perfEl = document.getElementById('metricAvgPerformance');
    if (perfEl) {
        perfEl.textContent = avgPerf + '%';
        perfEl.className   = 'mini-metric-value ' + (avgPerf >= 85 ? 'success' : avgPerf >= 65 ? 'warning' : 'danger');
    }

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('metricTotalDrivers',   drivers.length);
    el('metricActiveDrivers',  activeD);
    el('metricLicenseExpiring', expiringD);
    el('driversLiveCount', drivers.length + ' Driver' + (drivers.length !== 1 ? 's' : ''));
}

export function openDriverRegModal() {
    document.getElementById('driverRegistrationModal').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    document.getElementById('licenseExpiry').min = new Date().toISOString().split('T')[0];
}

export function closeDriverRegModal() {
    document.getElementById('driverRegistrationModal').classList.remove('show');
    document.getElementById('driverRegForm').reset();
    state.nrcIsValid = false;
    document.getElementById('driverSubmitBtn').disabled = false;
    document.getElementById('historicalBackfill').checked = false;
    document.getElementById('backfillDateGroup').style.display = 'none';
    document.getElementById('registrationDate').value = '';
    document.getElementById('nrcFileName').textContent = '';
    document.getElementById('licenseFileName').textContent = '';
    const msg = document.getElementById('driverModalMessage');
    msg.className = 'status-message';
    msg.textContent = '';
}

export function openDriverEditModal(driverId) {
    const driver = state.allDrivers.find(d => String(d.id) === String(driverId));
    if (!driver) {
        showToast('Driver not found', 'Refresh the drivers table and try again.', 'error');
        return;
    }
    state.currentEditDriverId = driver.id;
    document.getElementById('editFirstName').value              = driver.first_name || '';
    document.getElementById('editLastName').value               = driver.last_name || '';
    document.getElementById('editDriverEmail').value            = driver.email || '';
    document.getElementById('editDriverPhone').value            = driver.phone || '';
    document.getElementById('editLicenseNumber').value          = driver.licenseNumber || driver.license_number || '';
    document.getElementById('editLicenseExpiry').value          = driver.licenseExpiry || driver.license_expiry || '';
    document.getElementById('editNextOfKinName').value          = driver.next_of_kin_name || '';
    document.getElementById('editNextOfKinRelationship').value  = driver.next_of_kin_relationship || '';
    document.getElementById('editNextOfKinPhone').value         = driver.next_of_kin_phone || '';
    document.getElementById('editNextOfKinEmail').value         = driver.next_of_kin_email || '';
    const msg = document.getElementById('driverEditModalMessage');
    msg.className = 'status-message';
    msg.textContent = '';
    document.getElementById('driverEditModal').classList.add('show');
}

export function closeDriverEditModal() {
    document.getElementById('driverEditModal').classList.remove('show');
    document.getElementById('driverEditForm').reset();
    state.currentEditDriverId = null;
}

export function submitDriverEdit() {
    const payload = {
        firstName:             document.getElementById('editFirstName').value.trim(),
        lastName:              document.getElementById('editLastName').value.trim(),
        email:                 document.getElementById('editDriverEmail').value.trim(),
        phone:                 document.getElementById('editDriverPhone').value.trim(),
        licenseNumber:         document.getElementById('editLicenseNumber').value.trim(),
        licenseExpiry:         document.getElementById('editLicenseExpiry').value,
        nextOfKinName:         document.getElementById('editNextOfKinName').value.trim(),
        nextOfKinRelationship: document.getElementById('editNextOfKinRelationship').value,
        nextOfKinPhone:        document.getElementById('editNextOfKinPhone').value.trim(),
        nextOfKinEmail:        document.getElementById('editNextOfKinEmail').value.trim(),
    };

    if (!payload.firstName || !payload.lastName || !payload.email || !payload.phone ||
        !payload.licenseNumber || !payload.licenseExpiry || !payload.nextOfKinName ||
        !payload.nextOfKinRelationship || !payload.nextOfKinPhone) {
        showDriverEditMessage('Please fill in all required fields', 'error');
        return;
    }

    setSubmitLoading('driverEditSubmitBtn', true);
    FleetAPI.updateDriver(state.currentEditDriverId, payload)
        .then(() => {
            _cache.invalidate('drivers');
            _cache.invalidate('driversList');
            _cache.invalidate('dashboard');
            closeDriverEditModal();
            loadDriversData()
                .then(() => populateDriverDropdown())
                .catch(() => {});
            showToast('Driver updated', 'Mutable driver details were saved.', 'success');
        })
        .catch(error => showDriverEditMessage(friendlyError(error.message), 'error'))
        .finally(() => setSubmitLoading('driverEditSubmitBtn', false));
}

function showDriverEditMessage(text, type) {
    const msg = document.getElementById('driverEditModalMessage');
    msg.className = `status-message ${type}`;
    msg.textContent = text;
}

export function openDriverDocument(driverId, docType) {
    FleetAPI.getSignedUrl(driverId, docType)
        .then(url => { window.open(url, '_blank', 'noopener'); })
        .catch(error => { showToast('Document unavailable', friendlyError(error.message), 'error'); });
}

export function submitDriverRegistration() {
    const firstName            = document.getElementById('firstName').value.trim();
    const lastName             = document.getElementById('lastName').value.trim();
    const email                = document.getElementById('driverEmail').value.trim();
    const phone                = document.getElementById('driverPhone').value.trim();
    const nrcNumber            = document.getElementById('nrcNumber').value.trim();
    const licenseNumber        = document.getElementById('licenseNumber').value.trim();
    const licenseExpiry        = document.getElementById('licenseExpiry').value;
    const useBackfill          = document.getElementById('historicalBackfill').checked;
    const registrationDate     = useBackfill
        ? document.getElementById('registrationDate').value
        : new Date().toISOString().split('T')[0];
    const nextOfKinName        = document.getElementById('nextOfKinName').value.trim();
    const nextOfKinRelationship = document.getElementById('nextOfKinRelationship').value;
    const nextOfKinPhone       = document.getElementById('nextOfKinPhone').value.trim();
    const nextOfKinEmail       = document.getElementById('nextOfKinEmail').value.trim();
    const nrcFile              = document.getElementById('nrcUpload').files[0];
    const licenseFile          = document.getElementById('licenseUpload').files[0];

    if (!firstName || !lastName || !email || !phone || !nrcNumber || !licenseNumber ||
        !licenseExpiry || !nextOfKinName || !nextOfKinRelationship || !nextOfKinPhone) {
        showDriverModalMessage('Please fill in all required fields', 'error');
        return;
    }

    if (!state.nrcIsValid) {
        showDriverModalMessage('Please verify the NRC number before registering.', 'error');
        return;
    }

    if (useBackfill && !registrationDate) {
        showDriverModalMessage('Please enter the actual registration date.', 'error');
        return;
    }

    if (!nrcFile || !licenseFile) {
        showDriverModalMessage('Please upload both NRC and License documents.', 'error');
        return;
    }

    setSubmitLoading('driverSubmitBtn', true);
    FleetAPI.registerDriver({
        firstName, lastName, email, phone, nrcNumber,
        licenseNumber, licenseExpiry, nextOfKinName,
        nextOfKinRelationship, nextOfKinPhone, nextOfKinEmail,
        registrationDate
    }, nrcFile, licenseFile)
    .then(result => {
        if (!result) return;
        _cache.invalidate('drivers');
        _cache.invalidate('driversList');
        _cache.invalidate('dashboard');
        closeDriverRegModal();
        loadDriversData()
            .then(() => populateDriverDropdown())
            .catch(() => {});
        showToast('Driver registered', 'New driver added to the roster.', 'success');
    })
    .catch(error => { showDriverModalMessage(friendlyError(error.message), 'error'); })
    .finally(() => { setSubmitLoading('driverSubmitBtn', false); });
}

export function showDriverModalMessage(text, type) {
    const msg = document.getElementById('driverModalMessage');
    msg.className = `status-message ${type}`;
    msg.textContent = text;
}

// ════════════════════════════════════════════════════════════════
// FIRE / TERMINATE DRIVER
// ════════════════════════════════════════════════════════════════

export function openFireModal(driverName, score, shortages) {
    state.currentFireDriver = driverName;
    document.getElementById('fireDriverModal').classList.add('show');
    document.getElementById('fireDriverName').textContent        = driverName;
    document.getElementById('fireDriverPerformance').textContent = score + '%';
    document.getElementById('fireDriverShortages').textContent   = `K${shortages.toLocaleString()}`;
    document.getElementById('terminationReason').value           = 'Consistent Revenue Shortages';
    document.getElementById('customReasonWrapper').style.display = 'none';
    document.getElementById('customTerminationReason').value     = '';
}

export function closeFireModal() {
    document.getElementById('fireDriverModal').classList.remove('show');
    state.currentFireDriver = null;
}

export function handleTerminationReasonChange() {
    const val = document.getElementById('terminationReason').value;
    document.getElementById('customReasonWrapper').style.display =
        val === 'Custom Reason' ? 'block' : 'none';
}

export function confirmFireDriver() {
    let reason = document.getElementById('terminationReason').value;
    if (reason === 'Custom Reason') {
        reason = document.getElementById('customTerminationReason').value.trim();
        if (!reason) {
            alert('Please specify the custom termination reason.');
            return;
        }
    }

    const driverRecord = state.allDrivers.find(d =>
        d.name === state.currentFireDriver ||
        (d.first_name + ' ' + d.last_name) === state.currentFireDriver
    );

    if (!driverRecord) {
        alert('Driver record not found. Please refresh the page.');
        return;
    }

    setSubmitLoading('fireConfirmBtn', true);
    const terminatedDriverName = state.currentFireDriver;

    FleetAPI.terminateDriver(driverRecord.id, reason)
        .then(() => {
            setSubmitLoading('fireConfirmBtn', false);
            closeFireModal();
            _cache.invalidate('drivers');
            _cache.invalidate('driversList');
            _cache.invalidate('dashboard');
            loadDriversData()
                .then(() => populateDriverDropdown())
                .catch(() => {});
            showToast('Driver terminated', `${terminatedDriverName} has been removed from active duty.`, 'warning');
        })
        .catch(error => {
            showToast('Action failed', friendlyError(error.message), 'error');
            setSubmitLoading('fireConfirmBtn', false);
        });
}

export function printTerminationLetter() {
    const driverName = state.currentFireDriver;
    let reason = document.getElementById('terminationReason').value;
    if (reason === 'Custom Reason') {
        reason = document.getElementById('customTerminationReason').value.trim() || 'Contractual breach rules violation';
    }

    const date = new Date().toLocaleDateString();

    /*
     * CHANGE: print window colour scheme updated to GeeDrive amber brand colours.
     * Old values: #E8A400 (wrong amber), #0eab72 (brand green).
     * New values: #D4891A (--gd-amber-400), #A56210 (--gd-amber-600).
     * (style guide §Brand Palette)
     *
     * The print window is intentionally light-mode and uses system fonts
     * (Arial fallback) because it renders in a new browser tab for physical
     * printing — dark tokens are not appropriate here.
     */
    const printContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Termination Letter – ${driverName}</title>
    <style>
        body            { font-family: Arial, Helvetica, sans-serif; padding: 40px; line-height: 1.6; color: #1a1a1a; }
        .header         { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #D4891A; padding-bottom: 20px; }
        .company-name   { font-size: 28px; font-weight: 800; color: #D4891A; letter-spacing: 2px; text-transform: uppercase; }
        .company-sub    { margin: 6px 0 0; color: #666; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
        .meta-info      { margin: 20px 0 30px; }
        .meta-info p    { margin: 4px 0; font-size: 13px; }
        .content        { margin: 30px 0; font-size: 14px; text-align: justify; }
        .content p      { margin-bottom: 14px; }
        .reason-box     { background: #fef3e0; border-left: 4px solid #D4891A; padding: 15px 18px; margin: 20px 0; font-style: italic; font-size: 13px; }
        .signature-line { margin-top: 60px; display: flex; justify-content: space-between; }
        .sig-block      { width: 200px; text-align: center; }
        .sig-block .line { border-top: 1px solid #333; margin-bottom: 5px; margin-top: 50px; }
        .sig-block p    { margin: 3px 0; }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">GeeDrive Motors</div>
        <p class="company-sub">Official Fleet Operations – Corporate Infrastructure</p>
    </div>
    <div class="meta-info">
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>To:</strong> ${driverName}</p>
        <p><strong>Status:</strong> Notice of Contract Termination / Dismissal</p>
    </div>
    <div class="content">
        <p>Dear ${driverName},</p>
        <p>This document serves as formal notification that your employment contract and driving engagement privileges with <strong>GeeDrive Motors</strong> are being terminated officially, effective immediately as of today's date.</p>
        <p>This managerial decision follows a comprehensive review of operations logs, database tracking sheets, safety compliance indexes, and audit data matrices, which revealed a breach of standard operational requirements. Specifically, this action is taken on the following grounds:</p>
        <div class="reason-box">
            <strong>Official Grounds for Dismissal:</strong><br>
            ${reason}
        </div>
        <p>You are requested to immediately turn over all company assets, vehicle car keys, log books, and accessory equipment currently under your possession to the transport registry officer. Any outstanding balance payouts or accountability assessments will be finalised pursuant to fleet operational standard protocol guidelines within the standard regulatory period.</p>
        <p>We thank you for the service rendered during your tenure and wish you the best in your future endeavours.</p>
    </div>
    <div class="signature-line">
        <div class="sig-block">
            <div class="line"></div>
            <p style="font-size:12px; font-weight:bold;">Fleet Operations Director</p>
            <p style="font-size:11px; color:#666;">GeeDrive Motors Logistics</p>
        </div>
        <div class="sig-block">
            <div class="line"></div>
            <p style="font-size:12px; font-weight:bold;">Driver Acknowledgment</p>
            <p style="font-size:11px; color:#666;">Received Copy Signature</p>
        </div>
    </div>
    <scr` + `ipt>window.print();<\/scr` + `ipt>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
}

export function filterDriversTable() {
    populateDriversTable(state.allDrivers);
}

export function setDriversFilter(status, el) {
    state.driversFilterStatus = status;
    pagination.drivers.page = 1;
    document.querySelectorAll('#driversFilterDropdown .filter-dropdown-item').forEach(i => i.classList.remove('active-filter'));
    if (el) el.classList.add('active-filter');
    const badge = document.getElementById('driversFilterBadge');
    if (badge) badge.style.display = status !== 'all' ? 'inline-flex' : 'none';
    document.getElementById('driversFilterDropdown')?.classList.remove('open');
    populateDriversTable(state.allDrivers);
}

export function toggleDriversFilter(e) {
    e.stopPropagation();
    const dd = document.getElementById('driversFilterDropdown');
    document.getElementById('carsFilterDropdown')?.classList.remove('open');
    if (dd) dd.classList.toggle('open');
}

export function updateDriversCount(count = null) {
    const value = count == null ? getFilteredDrivers(state.allDrivers).length : count;
    const badge = document.getElementById('driversCountBadge');
    if (badge) badge.textContent = value + ' record' + (value !== 1 ? 's' : '');
}
