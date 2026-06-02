import { friendlyError, showToast } from './utils.js';

const _notifications = [];

export function addNotification(title, message, type = 'error') {
    const id = Date.now();
    const ts = new Date().toLocaleTimeString();
    _notifications.unshift({ id, title, message, type, ts });
    renderNotifTray();
    // Also show toast for immediate visibility
    showToast(title, message, type);
    // Show the red dot on bell
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = 'inline-block';
}

export function renderNotifTray() {
    const list = document.getElementById('notifList');
    if (!list) return;
    if (_notifications.length === 0) {
        list.innerHTML = '<div class="notif-empty">No notifications</div>';
        return;
    }
    list.innerHTML = _notifications.map(n => `
        <div class="notif-item notif-item-${n.type}" id="notif-${n.id}">
            <div class="notif-item-header">
                <span class="notif-item-title">${n.title}</span>
                <span class="notif-item-ts">${n.ts}</span>
                <button class="notif-item-dismiss" data-action="dismiss-notification" data-id="${n.id}">×</button>
            </div>
            <div class="notif-item-msg">${n.message}</div>
        </div>
    `).join('');
}

export function dismissNotif(id) {
    const idx = _notifications.findIndex(n => n.id === id);
    if (idx !== -1) _notifications.splice(idx, 1);
    renderNotifTray();
    if (_notifications.length === 0) {
        const dot = document.getElementById('notifDot');
        if (dot) dot.style.display = 'none';
    }
}

export function clearAllNotifs() {
    _notifications.length = 0;
    renderNotifTray();
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = 'none';
}

export function toggleNotifTray() {
    document.getElementById('notifTray').classList.toggle('open');
    document.getElementById('notifOverlay').classList.toggle('visible');
}

export function closeNotifTray() {
    document.getElementById('notifTray').classList.remove('open');
    document.getElementById('notifOverlay').classList.remove('visible');
}

// Helper: call addNotification for non-422 errors in catch blocks.
// Usage: notifyIfSystemError(error.message, 'Connection Error')
export function notifyIfSystemError(rawMessage, title) {
    const m = (rawMessage || '').toLowerCase();
    const is422 = m.includes('422') || m.includes('unprocessable');
    if (!is422) {
        addNotification(title || 'Connection Error', friendlyError(rawMessage), 'error');
    } else {
        showToast(title || 'Validation Error', friendlyError(rawMessage), 'warning');
    }
}


