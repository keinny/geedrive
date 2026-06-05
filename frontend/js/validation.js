export const ZM = {
    nrc(value) {
        const v = value.trim();
        if (!v) return { valid: false, message: 'NRC number is required' };
        if (!/^\d{6}\/\d{2}\/\d{1}$/.test(v)) {
            return { valid: false, message: 'Use format 123456/78/9' };
        }
        return { valid: true, message: 'Valid NRC format' };
    },

    license(value) {
        const v = value.trim().toUpperCase();
        if (!v) return { valid: false, message: 'License number is required' };
        if (!/^\d{8}$/.test(v)) {
            return { valid: false, message: 'Use format 12345678 (8 digits)' };
        }
        return { valid: true, message: 'Valid license format' };
    },

    plate(value) {
        const v = value.trim().toUpperCase();
        if (!v) return { valid: false, message: 'Plate number is required' };
        if (v.replace(/\s/g, '').length > 7) {
            return { valid: false, message: 'Maximum 7 characters' };
        }
        if (!/^[A-Z]{1,3}\s?\d{1,4}$/.test(v)) {
            return { valid: false, message: 'Use format ABK 1234' };
        }
        return { valid: true, message: 'Valid plate format' };
    }
};

export function applyValidation(inputEl, msgEl, result) {
    const formGroup = inputEl.closest('.form-group');
    const showFormatHint = !result.valid && Boolean(inputEl.value.trim());

    inputEl.classList.toggle('error', !result.valid);
    inputEl.classList.toggle('success', result.valid);
    formGroup?.classList.toggle('has-format-error', showFormatHint);
    if (msgEl) {
        msgEl.className = 'validation-message ' + (result.valid ? 'success' : 'error');
        msgEl.textContent = result.message;
    }
}

export function attachLiveValidation(inputId, msgId, validatorFn) {
    const input = document.getElementById(inputId);
    const msg = document.getElementById(msgId);
    if (!input) return;
    input.addEventListener('input', () => {
        applyValidation(input, msg, validatorFn(input.value));
    });
}
