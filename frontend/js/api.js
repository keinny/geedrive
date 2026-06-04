import { state } from './state.js';
import { FLEET_API_URL, FLEET_API_KEY } from './config.js';
import { _cache } from './cache.js';

export const FleetAPI = {
    _headers(withBody = false) {
        const h = { 'Authorization': 'Bearer ' + FLEET_API_KEY };
        if (withBody) h['Content-Type'] = 'application/json';
        return h;
    },

    async _get(path) {
        const res = await fetch(FLEET_API_URL + path, { headers: this._headers() });
        if (!res.ok) throw new Error('API error ' + res.status + ': ' + await res.text());
        return res.json();
    },

    async _post(path, body) {
        const res = await fetch(FLEET_API_URL + path, {
            method: 'POST',
            headers: this._headers(true),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('API error ' + res.status + ': ' + await res.text());
        return res.json();
    },

    async _patch(path, body) {
        const res = await fetch(FLEET_API_URL + path, {
            method: 'PATCH',
            headers: this._headers(true),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('API error ' + res.status + ': ' + await res.text());
        return res.json();
    },

    async _patchFormData(path, formData) {
        const res = await fetch(FLEET_API_URL + path, {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + FLEET_API_KEY },
            body: formData
        });
        if (!res.ok) throw new Error('API error ' + res.status + ': ' + await res.text());
        return res.json();
    },

    // ── Cars ──────────────────────────────────────────────────────────────
    async getCars() {
        const cars = await this._get('/cars');
        return {
            status: 'success',
            cars: cars.map(c => ({
                ...c,
                plate: c.plate_number,
                capacity: c.passenger_capacity,
                status: c.status === 'active' ? 'Active' : 'Decommissioned'
            }))
        };
    },

    async getEnrichedCars() {
        const carsPromise = !_cache.isStale('carsList') && _cache.carsList
            ? Promise.resolve({ status: 'success', cars: _cache.carsList })
            : this.getCars();
        const analyticsPromise = !_cache.isStale('carsAnalytics') && _cache.carsAnalytics
            ? Promise.resolve(_cache.carsAnalytics)
            : this._get('/cars/analytics');

        const [carsResponse, analytics] = await Promise.all([carsPromise, analyticsPromise]);
        _cache.set('carsList', carsResponse.cars);
        _cache.set('carsAnalytics', analytics);

        const analyticsByPlate = new Map(
            analytics.map(item => [String(item.plate_number).toUpperCase(), item])
        );

        return {
            status: 'success',
            cars: carsResponse.cars.map(car => {
                const stats = analyticsByPlate.get(String(car.plate_number || car.plate || '').toUpperCase()) || {};
                return {
                    ...car,
                    make: stats.make || car.make || 'N/A',
                    vehicleType: stats.vehicle_type || car.vehicle_type || 'N/A',
                    healthScore: typeof stats.health_score === 'number' ? stats.health_score : (car.healthScore || 0),
                    needsService: Boolean(stats.needs_service),
                    model: car.model || stats.model || 'N/A'
                };
            })
        };
    },

    async getLastMileage(carPlate) {
        const data = await this._get('/cars/' + encodeURIComponent(carPlate) + '/last-mileage');
        return { status: 'success', lastMileage: data.last_mileage };
    },

    async getCarDetails(carPlate) {
        const analytics = await this._get('/cars/analytics?plate=' + encodeURIComponent(carPlate));
        if (!analytics || analytics.length === 0) throw new Error('Car not found');
        const c = analytics[0];
        return {
            status: 'success',
            details: {
                model: c.model,
                revenue: c.total_revenue,
                expenses: c.total_expenses,
                trips: c.trip_count,
                healthScore: c.health_score,
                needsService: c.needs_service,
                weeklyMileage: c.odometer  // used for service threshold display
            }
        };
    },

    async registerCar(payload) {
        const body = {
            plate_number: payload.plate,
            make: payload.make,
            model: payload.model,
            vehicle_type: payload.vehicleType,
            passenger_capacity: parseInt(payload.capacity, 10),
            initial_mileage: parseFloat(payload.initialMileage) || 0,
            last_serviced: payload.lastServiced || null,
            registration_date: payload.registrationDate || new Date().toISOString().split('T')[0]
        };
        await this._post('/cars', body);
        return { status: 'success' };
    },

    async updateCar(carId, payload) {
        const body = {
            make: payload.make,
            model: payload.model,
            vehicle_type: payload.vehicleType,
            passenger_capacity: parseInt(payload.capacity, 10),
            last_serviced: payload.lastServiced || null
        };
        await this._patch('/cars/' + carId, body);
        return { status: 'success' };
    },

    async decommissionCar(carId, payload) {
        await this._patch('/cars/' + carId + '/decommission', {
            decommission_date: new Date().toISOString().split('T')[0],
            reason: payload.reason,
            final_mileage: parseFloat(payload.finalMileage),
            total_revenue_at_decommission: parseFloat(payload.totalRevenueAtDecommission) || 0
        });
        return { status: 'success' };
    },

    async getCarsAnalytics() {
        const data = !_cache.isStale('carsAnalytics') && _cache.carsAnalytics
            ? _cache.carsAnalytics
            : await this._get('/cars/analytics');
        _cache.set('carsAnalytics', data);
        return {
            status: 'success',
            carsAnalysis: data.map(c => ({
                plate: c.plate_number,
                revenue: c.total_revenue,
                expenses: c.total_expenses,
                profit: c.net_profit,
                weeklyMileage: c.odometer,
                healthScore: c.health_score,
                needsService: c.needs_service
            }))
        };
    },

    // ── Drivers ───────────────────────────────────────────────────────────
    async getDrivers() {
        const [drivers, analytics] = await Promise.all([
            this._get('/drivers'),
            this._get('/drivers/analytics').catch(() => [])
        ]);
        const analyticsById = new Map(analytics.map(d => [String(d.driver_id), d]));
        const analyticsByNrc = new Map(analytics.map(d => [String(d.nrc_number || '').toUpperCase(), d]));
        return {
            status: 'success',
            drivers: drivers.map(d => ({
                ...d,
                ...(() => {
                    const stats = analyticsById.get(String(d.id)) || analyticsByNrc.get(String(d.nrc_number || '').toUpperCase()) || {};
                    const docs = Array.isArray(d.documents) ? d.documents : [];
                    return {
                        name: d.first_name + ' ' + d.last_name,
                        nrcNumber: d.nrc_number,
                        licenseNumber: d.license_number,
                        licenseExpiry: d.license_expiry,
                        licenseStatus: d.license_status ?? 'valid',
                        documents: docs,
                        hasNrcDocument: docs.some(doc => doc.document_type === 'nrc'),
                        hasLicenseDocument: docs.some(doc => doc.document_type === 'license'),
                        performanceScore: stats.performance_score ?? null,
                        totalShortages: stats.total_shortage ?? 0,
                        shortagesCount: stats.shortages_count ?? 0,
                        tripCount: stats.trip_count ?? 0,
                        totalRevenue: stats.total_revenue ?? 0,
                        avgRevenue: stats.avg_revenue ?? 0,
                        expenseRatio: stats.expense_ratio ?? 0,
                        status: d.status === 'active' ? 'Active' : 'Inactive',
                    };
                })()
            }))
        };
    },

    async registerDriver(formPayload, nrcFile, licenseFile) {
        const form = new FormData();
        form.append('driver_data', JSON.stringify({
            first_name: formPayload.firstName,
            last_name: formPayload.lastName,
            email: formPayload.email,
            phone: formPayload.phone,
            nrc_number: formPayload.nrcNumber,
            license_number: formPayload.licenseNumber,
            license_expiry: formPayload.licenseExpiry,
            next_of_kin_name: formPayload.nextOfKinName,
            next_of_kin_relationship: formPayload.nextOfKinRelationship,
            next_of_kin_phone: formPayload.nextOfKinPhone,
            next_of_kin_email: formPayload.nextOfKinEmail || null,
            registration_date: formPayload.registrationDate || new Date().toISOString().split('T')[0]
        }));
        form.append('nrc_file', nrcFile);
        form.append('license_file', licenseFile);
        const res = await fetch(FLEET_API_URL + '/drivers', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + FLEET_API_KEY },
            body: form
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(err.detail || 'Registration failed');
        }
        return { status: 'success' };
    },

    async terminateDriver(driverId, reason) {
        await this._patch('/drivers/' + driverId + '/terminate', {
            termination_date: new Date().toISOString().split('T')[0],
            reason: reason
        });
        return { status: 'success' };
    },

    async updateDriver(driverId, payload) {
        const body = {
            first_name: payload.firstName,
            last_name: payload.lastName,
            email: payload.email,
            phone: payload.phone,
            license_number: payload.licenseNumber,
            license_expiry: payload.licenseExpiry,
            next_of_kin_name: payload.nextOfKinName,
            next_of_kin_relationship: payload.nextOfKinRelationship,
            next_of_kin_phone: payload.nextOfKinPhone,
            next_of_kin_email: payload.nextOfKinEmail || null
        };
        await this._patch('/drivers/' + driverId, body);
        return { status: 'success' };
    },

    async checkNRC(nrc) {
        const data = await this._get('/drivers/check-nrc?nrc=' + encodeURIComponent(nrc));
        return { isDuplicate: data.exists };
    },

    async getDriversAnalytics() {
        const data = await this._get('/drivers/analytics');
        return {
            status: 'success',
            drivers: data.map(d => ({
                name: d.full_name,
                nrcNumber: d.nrc_number,
                performanceScore: d.performance_score,
                totalShortages: d.total_shortage,
                status: d.status === 'active' ? 'Active' : 'Inactive'
            }))
        };
    },

    async getSignedUrl(driverId, docType) {
        const data = await this._get('/drivers/' + driverId + '/' + docType + '/signed-url');
        return data.url;
    },

    // ── Logs ──────────────────────────────────────────────────────────────
    async getLogs() {
        const logs = await this._get('/logs');
        return {
            status: 'success',
            logs: logs.map(log => ({
                id: log.id,
                createdAt: log.created_at,
                driverName: log.driver_name,
                car: log.car,
                plateNumber: log.plate_number
            }))
        };
    },

    async saveLog(formData) {
        // formData is the raw object built from the HTML form fields
        const body = {
            car_id: state.allCars.find(c => c.plate_number === formData.carPlate || c.plate === formData.carPlate)?.id,
            driver_id: state.allDrivers.find(d => (d.first_name + ' ' + d.last_name) === formData.driverName || d.name === formData.driverName)?.id,
            week_start_date: formData.date,
            year: parseInt(formData.year),
            start_mileage: parseFloat(formData.startMileage),
            closing_mileage: parseFloat(formData.closingMileage),
            total_revenue: parseFloat(formData.totalRevenue) || 0,
            shortage: parseFloat(formData.shortage) || 0,
            expense_on_car: parseFloat(formData.expenseOnCar) || 0,
            spares_bought: formData.sparesBought || null,
            spares_cost: parseFloat(formData.sparesCost) || 0,
            comments: formData.comments || null
        };
        if (!body.car_id) throw new Error('Car not found in local cache — please refresh the page');
        if (!body.driver_id) throw new Error('Driver not found in local cache — please refresh the page');
        await this._post('/logs', body);
        _cache.invalidate('dashboard');
        _cache.invalidate('carsAnalytics');
        _cache.invalidate('cars');
        _cache.invalidate('logs');
        return { status: 'success' };
    },

    // ── Dashboard ─────────────────────────────────────────────────────────
    async getDashboard(carFilter) {
        const summaryPromise = !_cache.isStale('dashboard') && _cache.dashboard
            ? Promise.resolve(_cache.dashboard)
            : this._get('/dashboard');
        const analyticsPromise = !_cache.isStale('carsAnalytics') && _cache.carsAnalytics
            ? Promise.resolve(_cache.carsAnalytics)
            : this._get('/cars/analytics');

        const [summary, analytics] = await Promise.all([summaryPromise, analyticsPromise]);
        _cache.set('dashboard', summary);
        _cache.set('carsAnalytics', analytics);
        const filteredAnalytics = carFilter
            ? analytics.filter(c => String(c.plate_number).toUpperCase() === String(carFilter).toUpperCase())
            : analytics;
        return {
            status: 'success',
            dashboard: {
                totalMileage: summary.total_mileage,
                totalRevenue: summary.total_revenue,
                totalExpenses: summary.total_expenses,
                netProfit: summary.total_net_profit
            },
            carsAnalysis: filteredAnalytics.map(c => ({
                plate: c.plate_number,
                revenue: c.total_revenue,
                expenses: c.total_expenses,
                profit: c.net_profit,
                weeklyMileage: c.odometer,
                healthScore: c.health_score,
                needsService: c.needs_service
            }))
        };
    }
};
