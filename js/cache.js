export const _cache = {
    cars: null,
    carsList: null,
    drivers: null,
    driversList: null,
    carsAnalytics: null,
    dashboard: null,
    TTL: 300000, // 5 minutes
    timestamps: {},
    isStale(key) {
        return !this.timestamps[key] || (Date.now() - this.timestamps[key]) > this.TTL;
    },
    set(key, data) {
        this[key] = data;
        this.timestamps[key] = Date.now();
    },
    invalidate(key) {
        this.timestamps[key] = 0;
    }
};
