import './state.js';

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

    _nrcIsValid = false;
    submitBtn.disabled = true;

    if (!val) {
        msg.className = 'validation-message';
        msg.textContent = '';
        submitBtn.disabled = false;
        return;
    }

    msg.className = 'validation-message info';
    msg.textContent = 'Checking NRC...';

    clearTimeout(_nrcCheckTimer);
    _nrcCheckTimer = setTimeout(() => {
        FleetAPI.checkNRC(val)
            .then(({ isDuplicate }) => {
                if (isDuplicate) {
                    msg.className = 'validation-message error';
                    msg.textContent = 'This NRC number is already registered';
                    _nrcIsValid = false;
                    submitBtn.disabled = true;
                } else {
                    msg.className = 'validation-message success';
                    msg.textContent = 'NRC available';
                    _nrcIsValid = true;
                    submitBtn.disabled = false;
                }
            })
            .catch(() => {
                msg.className = 'validation-message';
                msg.textContent = 'Could not verify — checking on submission';
                _nrcIsValid = true;
                submitBtn.disabled = false;
            });
    }, 500);
});


document.getElementById('nrcUpload')?.addEventListener('change', function(e) {
    const fileName = this.files[0]?.name || 'No file selected';
    const fileSize = this.files[0]?.size || 0;
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (fileSize > maxSize) {
        document.getElementById('nrcFileName').className = 'file-name';
        document.getElementById('nrcFileName').textContent = 'File too large (max 5MB)';
        this.value = '';
    } else {
        document.getElementById('nrcFileName').className = 'file-name success';
        document.getElementById('nrcFileName').textContent = fileName + ' selected';
    }
});

document.getElementById('licenseUpload')?.addEventListener('change', function(e) {
    const fileName = this.files[0]?.name || 'No file selected';
    const fileSize = this.files[0]?.size || 0;
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (fileSize > maxSize) {
        document.getElementById('licenseFileName').className = 'file-name';
        document.getElementById('licenseFileName').textContent = 'File too large (max 5MB)';
        this.value = '';
    } else {
        document.getElementById('licenseFileName').className = 'file-name success';
        document.getElementById('licenseFileName').textContent = fileName + ' selected';
    }
});

// fileToBase64 removed — driver documents are now uploaded as
// multipart/form-data binary via FleetAPI.registerDriver()

export function loadDriversData() {
    const tbody = document.querySelector('#driversTable tbody');
    if (!_cache.isStale('drivers')) {
        _pagination.drivers.page = 1;
        populateDriversTable(_cache.drivers);
        return;
    }

    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-secondary);">Loading drivers...</td></tr>';

    FleetAPI.getDrivers()
        .then(data => {
            if (data.status === 'success') {
                allDrivers = data.drivers;
                _cache.set('drivers', data.drivers);
                _pagination.drivers.page = 1;
                populateDriversTable(allDrivers);
            } else {
                showTableError('#driversTable tbody', 8,
                    'Could not load drivers',
                    'The server returned an unexpected response. Check the API is running correctly.',
                    'loadDriversData'
                );
            }
        })
        .catch(error => {
            showTableError('#driversTable tbody', 8,
                'Could not load drivers',
                friendlyError(error.message),
                'loadDriversData'
            );
            notifyIfSystemError(error.message, 'Could not load drivers');
        });
}

export function populateDriversTable(drivers) {
    const tbody = document.querySelector('#driversTable tbody');
    tbody.innerHTML = '';

    if (drivers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-secondary);">No drivers registered.</td></tr>';
        renderPagination('drivers', 0, 1, _pagination.drivers.pageSize, null);
        return;
    }

    // CHANGE 8: slice to current page
    const state = _pagination.drivers;
    state.total = drivers.length;
    const start = (state.page - 1) * state.pageSize;
    const pageData = drivers.slice(start, start + state.pageSize);

    pageData.forEach(driver => {
        const row = document.createElement('tr');
        const licenseExpiryDate = driver.licenseExpiry ? new Date(driver.licenseExpiry).toLocaleDateString() : 'N/A';
        const licenseStatus = String(driver.licenseStatus || 'valid').toLowerCase();
        let licenseBadge = '';
        if (licenseStatus === 'expired') {
            licenseBadge = '<span class="status-badge decommissioned" style="display:inline-block; margin-top:4px;">Expired</span>';
        } else if (licenseStatus === 'expiring_soon') {
            licenseBadge = '<span class="status-badge warning" style="display:inline-block; margin-top:4px;">Expiring Soon</span>';
        }
        
        let statusBadgeClass = driver.status === 'Active' ? 'active' : 'inactive';
        let safetyScore = driver.performanceScore || 100;
        let scoreColor = safetyScore >= 85 ? '#10B981' : safetyScore >= 65 ? '#F59E0B' : '#EF4444';

        // Setup document link rendering safely
        let docLinksHtml = '';
        if (driver.nrcFolderId || driver.nrcFileUrl) {
            const url = driver.nrcFileUrl || '#';
            docLinksHtml += `<a href="${url}" target="_blank" style="color: var(--primary); margin-right: 8px; font-weight: 600; text-decoration: none;">NRC NRC</a>`;
        }
        if (driver.licenseFileUrl) {
            docLinksHtml += `<a href="${driver.licenseFileUrl}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: none;">License DL</a>`;
        }
        if (!docLinksHtml) docLinksHtml = '<span style="color: #999; font-style: italic;">No docs</span>';

        row.innerHTML = `
            <td><strong>${driver.name}</strong></td>
            <td><span style="font-size:0.9em;">${driver.email || 'N/A'}</span></td>
            <td>${driver.phone || 'N/A'}</td>
            <td><span style="font-family: monospace;">${driver.nrcNumber || 'N/A'}</span></td>
            <td>
                <div style="font-size: 0.85em; line-height: 1.4;">
                    <div>No: <strong>${driver.licenseNumber || 'N/A'}</strong></div>
                    <div style="color: #666;">${licenseStatus === 'valid' ? 'Exp: ' + licenseExpiryDate : 'Status: ' + (licenseStatus === 'expired' ? 'Expired' : 'Expiring Soon')}</div>
                    ${licenseBadge}
                    <div style="margin-top: 4px;">${docLinksHtml}</div>
                </div>
            </td>
            <td><span class="status-badge ${statusBadgeClass}">${driver.status}</span></td>
            <td>
                <div style="text-align: center;">
                    <span style="font-weight:700; color: ${scoreColor}; font-size:1.1em;">${safetyScore}%</span>
                    <div style="font-size:0.75em; color:#777; margin-top:2px;">Shortages: K${(driver.totalShortages || 0).toFixed(0)}</div>
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    ${driver.status === 'Active' ? `
                    <div class="overflow-menu-wrapper">
                        <button class="btn-small btn-icon-only overflow-trigger" onclick="toggleOverflowMenu(this)" title="More actions">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                        </button>
                        <div class="overflow-menu">
                            <button class="overflow-item overflow-item-danger" onclick="closeOverflowMenus(); openFireModal('${driver.name}', ${safetyScore}, ${driver.totalShortages || 0})">
                                Terminate Driver
                            </button>
                        </div>
                    </div>` : '<span class="status-badge inactive" style="font-size:10px;">Terminated</span>'}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    // Update drivers mini metrics
    const activeD = drivers.filter(d => d.status === 'Active').length;
    const expiringD = drivers.filter(d => String(d.licenseStatus || 'valid').toLowerCase() === 'expiring_soon').length;
    const scores = drivers.filter(d => d.performanceScore != null);
    const avgPerf = scores.length
        ? Math.round(scores.reduce((s, d) => s + (d.performanceScore || 0), 0) / scores.length)
        : 0;
    const perfEl = document.getElementById('metricAvgPerformance');
    if (perfEl) {
        perfEl.textContent = avgPerf + '%';
        perfEl.className = 'mini-metric-value ' + (avgPerf >= 85 ? 'success' : avgPerf >= 65 ? 'warning' : 'danger');
    }
    const elD = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    elD('metricTotalDrivers', drivers.length);
    elD('metricActiveDrivers', activeD);
    elD('metricLicenseExpiring', expiringD);
    elD('driversLiveCount', drivers.length + ' Driver' + (drivers.length !== 1 ? 's' : ''));
    updateDriversCount();
    filterDriversTable();
    // CHANGE 8: render pagination controls
    renderPagination('drivers', _pagination.drivers.total, _pagination.drivers.page, _pagination.drivers.pageSize, null);
}

export function openDriverRegModal() {
    document.getElementById('driverRegistrationModal').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    lucide.createIcons();
    // Populate tomorrow date default boundary checks constraints
    document.getElementById('licenseExpiry').min = new Date().toISOString().split('T')[0];
}

export function closeDriverRegModal() {
    document.getElementById('driverRegistrationModal').classList.remove('show');
    document.getElementById('driverRegForm').reset();
    _nrcIsValid = false;
    document.getElementById('driverSubmitBtn').disabled = false;
    document.getElementById('historicalBackfill').checked = false;
    document.getElementById('backfillDateGroup').style.display = 'none';
    document.getElementById('registrationDate').value = '';
    document.getElementById('nrcFileName').textContent = '';
    document.getElementById('licenseFileName').textContent = '';
    document.getElementById('driverModalMessage').className = 'status-message';
    document.getElementById('driverModalMessage').textContent = '';
}

export function submitDriverRegistration() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('driverEmail').value.trim();
    const phone = document.getElementById('driverPhone').value.trim();
    const nrcNumber = document.getElementById('nrcNumber').value.trim();
    const licenseNumber = document.getElementById('licenseNumber').value.trim();
    const licenseExpiry = document.getElementById('licenseExpiry').value;
    const useBackfill = document.getElementById('historicalBackfill').checked;
    const registrationDate = useBackfill
        ? document.getElementById('registrationDate').value
        : new Date().toISOString().split('T')[0];
    
    // Next of Kin fields
    const nextOfKinName = document.getElementById('nextOfKinName').value.trim();
    const nextOfKinRelationship = document.getElementById('nextOfKinRelationship').value;
    const nextOfKinPhone = document.getElementById('nextOfKinPhone').value.trim();
    const nextOfKinEmail = document.getElementById('nextOfKinEmail').value.trim();

    const nrcFile = document.getElementById('nrcUpload').files[0];
    const licenseFile = document.getElementById('licenseUpload').files[0];

    if (!firstName || !lastName || !email || !phone || !nrcNumber || !licenseNumber || !licenseExpiry || !nextOfKinName || !nextOfKinRelationship || !nextOfKinPhone) {
        showDriverModalMessage('Please fill in all required fields', 'error');
        return;
    }

    if (!_nrcIsValid) {
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
        closeDriverRegModal();
        loadDriversData_Init().catch(() => {});
        loadDriversData();
        showToast('Driver registered', 'New driver added to the roster.', 'success');
    })
    .catch(error => {
        showDriverModalMessage(friendlyError(error.message), 'error');
    })
    .finally(() => {
        setSubmitLoading('driverSubmitBtn', false);
    });
}

export function showDriverModalMessage(text, type) {
    const msg = document.getElementById('driverModalMessage');
    msg.className = `status-message ${type}`;
    msg.textContent = text;
}

// ============================================================================
// FIRE / TERMINATE DRIVER PROCESS
// ============================================================================
export function openFireModal(driverName, score, shortages) {
    currentFireDriver = driverName;
    document.getElementById('fireDriverModal').classList.add('show');
    document.getElementById('fireDriverName').textContent = driverName;
    document.getElementById('fireDriverPerformance').textContent = score + '%';
    document.getElementById('fireDriverShortages').textContent = `K${shortages.toLocaleString()}`;
    
    // Reset modal outputs states fields safely
    document.getElementById('terminationReason').value = 'Consistent Revenue Shortages';
    document.getElementById('customReasonWrapper').style.display = 'none';
    document.getElementById('customTerminationReason').value = '';
}

export function closeFireModal() {
    document.getElementById('fireDriverModal').classList.remove('show');
    currentFireDriver = null;
}

export function handleTerminationReasonChange() {
    const val = document.getElementById('terminationReason').value;
    const customWrapper = document.getElementById('customReasonWrapper');
    if (val === 'Custom Reason') {
        customWrapper.style.display = 'block';
    } else {
        customWrapper.style.display = 'none';
    }
}

export function confirmFireDriver() {
    let reason = document.getElementById('terminationReason').value;
    if (reason === 'Custom Reason') {
        reason = document.getElementById('customTerminationReason').value.trim();
        if (!reason) {
            alert('Please specify the custom termination reason text field.');
            return;
        }
    }

    const terminationData = {
        action: 'terminateDriver',
        driverName: currentFireDriver,
        reason: reason,
        terminationDate: new Date().toISOString()
    };

    // Lookup driver UUID from local cache
    const driverRecord = allDrivers.find(d => d.name === currentFireDriver || (d.first_name + ' ' + d.last_name) === currentFireDriver);
    if (!driverRecord) {
        alert('Driver record not found. Please refresh the page.');
        return;
    }

    setSubmitLoading('fireConfirmBtn', true);

    FleetAPI.terminateDriver(driverRecord.id, reason)
    .then(result => {
        setSubmitLoading('fireConfirmBtn', false);
        closeFireModal();
        _cache.invalidate('drivers');
        loadDriversData();
        loadDriversData_Init().catch(() => {});
        showToast('Driver terminated', `${currentFireDriver} has been removed from active duty.`, 'warning');
    })
    .catch(error => {
        console.error('Error terminating driver:', error);
        showToast('Action failed', friendlyError(error.message), 'error');
        setSubmitLoading('fireConfirmBtn', false);
    });
}

export function printTerminationLetter() {
    const driverName = currentFireDriver;
    let reason = document.getElementById('terminationReason').value;
    if (reason === 'Custom Reason') {
        reason = document.getElementById('customTerminationReason').value.trim() || 'Contractual breach rules violation';
    }
    
    const date = new Date().toLocaleDateString();
    const printContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Termination Letter - ${driverName}</title>
    <style>
body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; color: #1a1a1a; }
.header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #E8A400; padding-bottom: 20px; }
.company-name { font-size: 28px; font-weight: bold; color: #E8A400; letter-spacing: 1px; }
.meta-info { margin-bottom: 30px; margin-top: 20px; }
.content { margin: 30px 0; font-size: 14px; text-align: justify; }
.reason-box { background: #f9f9f9; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; font-style: italic; }
.signature-line { margin-top: 60px; display: flex; justify-content: space-between; }
.sig-block { width: 200px; text-align: center; }
.line { border-top: 1px solid #333; margin-bottom: 5px; margin-top: 40px; }

/* ── V2 MODAL COMPONENTS (brought forward) ───────────────────────── */
.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border);
}

.modal-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
}

.modal-body {
    padding: 24px;
    flex: 1;
}

.modal-footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    align-items: center;
    padding: 14px 20px;
    border-top: 1px solid var(--border);
    flex-wrap: wrap;
}

.close-btn {
    background: none;
    border: none;
    font-size: 22px;
    color: var(--text-secondary);
    cursor: pointer;
    line-height: 1;
    padding: 0 4px;
}
.close-btn:hover { color: #ffffff; }

.btn-secondary {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
}
.btn-secondary:hover { background: var(--bg-input); color: #ffffff; }

.btn-danger {
    background: var(--danger);
    color: #ffffff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
}
.btn-danger:hover { background: #dc2626; }
.btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-print {
    background: transparent;
    border: 1px solid var(--primary);
    color: var(--primary);
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
}
.btn-print:hover { background: rgba(14, 171, 114, 0.1); }

.form-note {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 4px;
}

.validation-message {
    font-size: 12px;
    margin-top: 4px;
    min-height: 16px;
    display: block;
}
.validation-message.success { color: var(--success); }
.validation-message.error   { color: var(--danger); }
.validation-message.info    { color: var(--warning); }

.stat-card {
    background: var(--bg-input);
    padding: 16px;
    border-radius: 6px;
    border: 1px solid var(--border);
}
.stat-card label {
    font-size: 13px;
    color: var(--text-secondary);
    display: block;
    margin-bottom: 8px;
    font-weight: 400;
}
.stat-card span {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    display: block;
}
.stat-card.danger span { color: var(--danger); }

.comparison-table {
    width: 100%;
    border-collapse: collapse;
}

.subtext {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
}

.btn-view, .btn-decommission, .btn-fire, .btn-edit {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border);
    background: var(--bg-input);
    color: var(--text-secondary);
    transition: all 0.15s;
}
.btn-view:hover { border-color: var(--primary); color: var(--primary); }
.btn-fire:hover, .btn-decommission:hover { border-color: var(--danger); color: var(--danger); }

.btn-warning {
    background: var(--warning);
    color: #000;
    border: none;
    padding: 10px 18px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}

/* ── TOAST NOTIFICATIONS ─────────────────────────────────────────── */
#toastContainer {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
}

.toast {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 8px;
    min-width: 300px;
    max-width: 420px;
    background: #1e1e20;
    border: 1px solid var(--border);
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    pointer-events: all;
    animation: toastIn 0.25s ease;
    position: relative;
    overflow: hidden;
}

.toast::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: currentColor;
    animation: toastProgress 4s linear forwards;
    width: 100%;
}

@keyframes toastIn {
    from { opacity: 0; transform: translateX(32px); }
    to   { opacity: 1; transform: translateX(0); }
}

@keyframes toastOut {
    from { opacity: 1; transform: translateX(0);   max-height: 100px; }
    to   { opacity: 0; transform: translateX(32px); max-height: 0; padding: 0; margin: 0; }
}

@keyframes toastProgress {
    from { width: 100%; }
    to   { width: 0%; }
}

.toast.success { border-left: 3px solid var(--success); color: var(--success); }
.toast.error   { border-left: 3px solid var(--danger);  color: var(--danger);  }
.toast.warning { border-left: 3px solid var(--warning); color: var(--warning); }
.toast.info    { border-left: 3px solid #60a5fa;        color: #60a5fa;        }

.toast-icon { flex-shrink: 0; margin-top: 1px; }
.toast-icon svg { width: 16px; height: 16px; }

.toast-body { flex: 1; min-width: 0; }

.toast-title {
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 2px;
    line-height: 1.3;
}

.toast-message {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
}

.toast-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
    font-size: 16px;
    margin-top: -1px;
}

.toast-close:hover { color: #ffffff; }

/* ── TABLE EMPTY-STATE ERROR PANEL ───────────────────────────────── */
.table-error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 56px 24px;
    gap: 12px;
    text-align: center;
}

.table-error-icon {
    width: 40px;
    height: 40px;
    color: #3a3a3c;
    margin-bottom: 4px;
}

.table-error-heading {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
}

.table-error-subtext {
    font-size: 12px;
    color: var(--text-secondary);
    max-width: 320px;
    line-height: 1.5;
}

.table-error-retry {
    margin-top: 8px;
    padding: 7px 18px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.table-error-retry:hover {
    border-color: var(--primary);
    color: var(--primary);
}

/* ── HIDE OLD STATUS-MESSAGE DIV WHEN UNUSED ─────────────────────── */
.status-message:empty { display: none !important; }

/* ── HEALTH PILL ─────────────────────────────────────────────────── */
.health-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 20px;
    white-space: nowrap;
}

.health-pill-score {
    font-weight: 700;
    font-size: 12px;
}

.health-pill-label {
    font-size: 11px;
    font-weight: 500;
    opacity: 0.85;
}

/* ── VEHICLE CELL (combined make/model/type) ─────────────────────── */
.vehicle-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.vehicle-cell-name {
    font-size: 13px;
    color: var(--text-primary);
}

.vehicle-cell-type {
    font-size: 11px;
    color: var(--text-secondary);
}

.plate-badge {
    font-family: 'Roboto Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--bg-input);
    border: 1px solid var(--border);
    padding: 3px 8px;
    border-radius: 4px;
    letter-spacing: 0.5px;
    white-space: nowrap;
}

/* ── TABLE HEADER SUBTITLE ───────────────────────────────────────── */
.table-header-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 2px;
    font-weight: 400;
}

/* ── MINI METRIC CARDS ───────────────────────────────────────────── */
.mini-metrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-card);
}

.mini-metric {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.mini-metric-label {
    font-size: 11px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
}

.mini-metric-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
}

.mini-metric-sub {
    font-size: 11px;
    color: var(--text-secondary);
}

.mini-metric-value.success { color: var(--success); }
.mini-metric-value.warning { color: var(--warning); }
.mini-metric-value.danger  { color: var(--danger);  }

@media (max-width: 900px) {
    .mini-metrics { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
    .mini-metrics { grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 12px; }
    .mini-metric-value { font-size: 18px; }
}

/* ── FORM SECTION CARDS ──────────────────────────────────────────── */
.form-section {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
    margin-bottom: 16px;
}

.form-section:last-of-type { margin-bottom: 0; }

.section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
}

.section-title svg,
.section-title i {
    width: 16px;
    height: 16px;
    color: var(--primary);
    flex-shrink: 0;
}

/* ── OVERFLOW / THREE-DOT MENU ───────────────────────────────────── */
.overflow-menu-wrapper {
    position: relative;
    display: inline-block;
}

.btn-icon-only {
    width: 28px;
    height: 28px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
}

.btn-icon-only:hover {
    background: var(--bg-input);
    color: var(--text-primary);
}

.overflow-menu {
    display: none;
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 300;
    background: #1e1e20;
    border: 1px solid var(--border);
    border-radius: 8px;
    min-width: 160px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    padding: 4px 0;
}

.overflow-menu.open { display: block; }

.overflow-item {
    display: block;
    width: 100%;
    padding: 9px 14px;
    font-size: 13px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    color: var(--text-secondary);
    transition: background 0.1s;
}

.overflow-item:hover {
    background: rgba(255,255,255,0.04);
    color: var(--text-primary);
}

.overflow-item-danger:hover { color: var(--danger); }

/* ── WEEKLY LOG LAYOUT WITH LIVE SUMMARY ────────────────────────── */
.log-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
    align-items: start;
}

.log-summary-panel {
    position: sticky;
    top: 80px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
}

.log-summary-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
}

.log-summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    font-size: 13px;
}

.log-summary-row:last-child { border-bottom: none; }

.log-summary-row label {
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 400;
    margin: 0;
}

.log-summary-row span {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 13px;
}

.log-summary-net {
    margin-top: 12px;
    padding: 12px;
    background: rgba(14, 171, 114, 0.08);
    border: 1px solid rgba(14, 171, 114, 0.2);
    border-radius: 8px;
    text-align: center;
}

.log-summary-net label {
    font-size: 11px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: block;
    margin-bottom: 4px;
}

.log-summary-net .net-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--primary);
}

.log-summary-placeholder {
    text-align: center;
    color: var(--text-secondary);
    font-size: 12px;
    padding: 20px 0;
}

@media (max-width: 900px) {
    .log-layout {
        grid-template-columns: 1fr;
    }
    .log-summary-panel {
        position: static;
        order: -1;
    }
}

/* ══════════════════════════════════════════════════════════════════
   VEHICLE PERFORMANCE INSIGHTS MODAL (VPI)
══════════════════════════════════════════════════════════════════ */
.vpi-modal {
    width: 420px;
    max-width: 95vw;
    border-radius: 16px;
    overflow: hidden;
    position: relative;
    padding: 0;
}

/* ── Close button ─────────────────────────────────────────────── */
.vpi-close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    z-index: 10;
}
.vpi-close:hover { background: rgba(255,255,255,0.12); color: #fff; }

/* ── Vehicle identity header ───────────────────────────────────── */
.vpi-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px 24px 20px;
    border-bottom: 1px solid var(--border);
}

.vpi-icon-wrap {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(14, 171, 114, 0.1);
    border: 1px solid rgba(14, 171, 114, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary);
    flex-shrink: 0;
}

.vpi-identity { display: flex; flex-direction: column; gap: 2px; }

.vpi-label {
    font-size: 11px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
}

.vpi-plate {
    font-size: 24px;
    font-weight: 700;
    color: var(--primary);
    letter-spacing: 0.5px;
    line-height: 1.1;
}

.vpi-model {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 1px;
}

/* ── Body ──────────────────────────────────────────────────────── */
.vpi-body { padding: 20px 24px; }

/* ── Section title ─────────────────────────────────────────────── */
.vpi-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 12px;
}
.vpi-section-title i,
.vpi-section-title svg {
    width: 16px;
    height: 16px;
    color: var(--primary);
    flex-shrink: 0;
}

/* ── Stats grid ────────────────────────────────────────────────── */
.vpi-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
}

.vpi-stat {
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: hidden;
    position: relative;
}

.vpi-stat-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.vpi-stat-label {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.3;
}

.vpi-stat-icon {
    width: 14px;
    height: 14px;
    color: var(--primary);
    opacity: 0.7;
    flex-shrink: 0;
}

.vpi-stat-value {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
}

.vpi-stat-bar {
    height: 2px;
    background: var(--primary);
    border-radius: 2px;
    margin-top: 4px;
    opacity: 0.5;
}

/* ── Maintenance status ────────────────────────────────────────── */
.vpi-maintenance {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
}

.vpi-maint-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(14, 171, 114, 0.12);
    border: 2px solid var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary);
    flex-shrink: 0;
    transition: all 0.2s;
}

.vpi-maint-icon-wrap.warning {
    background: rgba(245, 158, 11, 0.12);
    border-color: var(--warning);
    color: var(--warning);
}

.vpi-maint-text { flex: 1; min-width: 0; }

.vpi-maint-status {
    font-size: 14px;
    font-weight: 600;
    color: var(--primary);
}
.vpi-maint-status.warning { color: var(--warning); }

.vpi-maint-sub {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 2px;
    line-height: 1.4;
}

.vpi-maint-badge {
    background: rgba(14, 171, 114, 0.12);
    border: 1px solid rgba(14, 171, 114, 0.25);
    color: var(--primary);
    font-size: 12px;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 6px;
    white-space: nowrap;
    flex-shrink: 0;
}
.vpi-maint-badge.warning {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.25);
    color: var(--warning);
}

/* ── Health score ──────────────────────────────────────────────── */
.vpi-health { display: flex; flex-direction: column; gap: 10px; }

.vpi-health-score {
    font-size: 36px;
    font-weight: 800;
    color: var(--primary);
    line-height: 1;
}

.vpi-health-bar-track {
    width: 100%;
    height: 8px;
    background: rgba(255,255,255,0.06);
    border-radius: 8px;
    overflow: hidden;
}

.vpi-health-bar-fill {
    height: 100%;
    border-radius: 8px;
    background: var(--primary);
    transition: width 0.6s ease, background 0.3s ease;
}

.vpi-health-sub {
    font-size: 12px;
    color: var(--text-secondary);
}
    </style>
</head>
<body>
    <div class="header">
<div class="company-name">GEEDRIVE MOTORS</div>
<p style="margin: 5px 0 0; color: #555; font-weight: 600; text-transform: uppercase; font-size: 12px;">Official Fleet Operations Corporate Infrastructure</p>
    </div>
    
    <div class="meta-info">
<p><strong>Date:</strong> ${date}</p>
<p><strong>To:</strong> ${driverName}</p>
<p><strong>Status Profile:</strong> Notice of Contract Termination / Dismissal</p>
    </div>

    <div class="content">
<p>Dear ${driverName},</p>
<p>This document serves as formal notification that your employment contract and driving engagement privileges with <strong>GeeDrive Motors</strong> are being terminated officially, effective immediately as of today's date.</p>
<p>This managerial decision follows a comprehensive review of operations logs, database tracking sheets, safety compliance indexes, and audit data matrices, which revealed a breach of standard operational requirements. Specifically, this action is taken on the following grounds:</p>

<div class="reason-box">
    <strong>Official Grounds for Dismissal:</strong><br>
    ${reason}
</div>

<p>You are requested to immediately turn over all company assets, vehicle car keys, log books, and accessory equipment currently under your possession to the transport registry officer. Any outstanding balance payouts or accountability assessments will be finalized pursuant to fleet operational standard protocol guidelines within the standard regulatory period.</p>
<p>We thank you for the service rendered during your tenure and wish you the best in your future endeavors.</p>
    </div>

    <div class="signature-line">
<div class="sig-block">
    <div class="line"></div>
    <p style="font-size: 12px; font-weight: bold;">Fleet Operations Director</p>
    <p style="font-size: 11px; color: #666;">GeeDrive Motors Logistics</p>
</div>
<div class="sig-block">
    <div class="line"></div>
    <p style="font-size: 12px; font-weight: bold;">Driver Acknowledgment</p>
    <p style="font-size: 11px; color: #666;">Received Copy Signature</p>
</div>
    </div>

    <scr'+'ipt>
window.print();
    <\/scr'+'ipt>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
}


export function filterDriversTable() {
    const query = (document.getElementById('driversSearchInput')?.value || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#driversTable tbody tr');
    let visible = 0;
    rows.forEach(row => {
        if (row.querySelector('.empty-state')) { row.style.display = ''; return; }
        const text = row.innerText.toLowerCase();
        const statusCell = row.cells[5];
        const statusText = statusCell ? statusCell.innerText.trim() : '';
        const matchesSearch = !query || text.includes(query);
        const matchesStatus = _driversFilterStatus === 'all' || statusText.includes(_driversFilterStatus);
        const show = matchesSearch && matchesStatus;
        row.style.display = show ? '' : 'none';
        if (show) visible++;
    });
    const badge = document.getElementById('driversCountBadge');
    if (badge) badge.textContent = visible + ' record' + (visible !== 1 ? 's' : '');
}

export function setDriversFilter(status, el) {
    _driversFilterStatus = status;
    _pagination.drivers.page = 1;
    document.querySelectorAll('#driversFilterDropdown .filter-dropdown-item').forEach(i => i.classList.remove('active-filter'));
    if (el) el.classList.add('active-filter');
    const badge = document.getElementById('driversFilterBadge');
    if (badge) badge.style.display = status !== 'all' ? 'inline-flex' : 'none';
    document.getElementById('driversFilterDropdown')?.classList.remove('open');
    filterDriversTable();
}

export function toggleDriversFilter(e) {
    e.stopPropagation();
    const dd = document.getElementById('driversFilterDropdown');
    document.getElementById('carsFilterDropdown')?.classList.remove('open');
    if (dd) dd.classList.toggle('open');
}


export function updateDriversCount() {
    const dataRows = Array.from(document.querySelectorAll('#driversTable tbody tr'))
        .filter(r => !r.querySelector('.empty-state') && r.style.display !== 'none');
    const badge = document.getElementById('driversCountBadge');
    if (badge) badge.textContent = dataRows.length + ' record' + (dataRows.length !== 1 ? 's' : '');
}



