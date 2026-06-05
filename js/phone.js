const _instances = new Map();

export function initPhoneInput(inputId, options = {}) {
    const input = document.getElementById(inputId);
    if (!input || _instances.has(inputId)) return _instances.get(inputId);
    if (typeof window.intlTelInput !== 'function') return null;

    const iti = window.intlTelInput(input, {
        initialCountry: 'zm',
        preferredCountries: ['zm', 'zw', 'za', 'mw', 'tz'],
        separateDialCode: true,
        dropdownContainer: document.body,
        nationalMode: false,
        autoPlaceholder: 'aggressive',
        utilsScript: 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/18.2.1/js/utils.js',
        ...options
    });
    _instances.set(inputId, iti);
    return iti;
}

export function getE164(inputId) {
    const iti = _instances.get(inputId);
    if (!iti) return document.getElementById(inputId)?.value || null;
    return iti.isValidNumber() ? iti.getNumber() : null;
}

export function isPhoneValid(inputId) {
    const input = document.getElementById(inputId);
    const iti = _instances.get(inputId);
    if (!input || !input.value.trim()) return false;
    if (!iti) return true;
    return iti.isValidNumber();
}

export function destroyPhoneInput(inputId) {
    const iti = _instances.get(inputId);
    if (iti) {
        iti.destroy();
        _instances.delete(inputId);
    }
}

export function resetPhoneInput(inputId) {
    const iti = _instances.get(inputId);
    if (iti) {
        iti.setNumber('');
    } else {
        const el = document.getElementById(inputId);
        if (el) el.value = '';
    }
}
