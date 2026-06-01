export let allDrivers = [];
export let allCars = [];
export let _nrcCheckTimer = null;
export let _nrcIsValid = false;
export let currentFireDriver = null;
export let currentViewCar = null;
export let filteredWeeklyMileage = {}; // Track weekly mileage by car
export let _carsFilterStatus = 'all';
export let _carsFilterType   = 'all';
export let _driversFilterStatus = 'all';

export const _pagination = {
    cars:    { page: 1, pageSize: 25, total: 0 },
    drivers: { page: 1, pageSize: 25, total: 0 },
};

const bindings = {
    allDrivers: { get: () => allDrivers, set: value => { allDrivers = value; } },
    allCars: { get: () => allCars, set: value => { allCars = value; } },
    _nrcCheckTimer: { get: () => _nrcCheckTimer, set: value => { _nrcCheckTimer = value; } },
    _nrcIsValid: { get: () => _nrcIsValid, set: value => { _nrcIsValid = value; } },
    currentFireDriver: { get: () => currentFireDriver, set: value => { currentFireDriver = value; } },
    currentViewCar: { get: () => currentViewCar, set: value => { currentViewCar = value; } },
    filteredWeeklyMileage: { get: () => filteredWeeklyMileage, set: value => { filteredWeeklyMileage = value; } },
    _carsFilterStatus: { get: () => _carsFilterStatus, set: value => { _carsFilterStatus = value; } },
    _carsFilterType: { get: () => _carsFilterType, set: value => { _carsFilterType = value; } },
    _driversFilterStatus: { get: () => _driversFilterStatus, set: value => { _driversFilterStatus = value; } },
    _pagination: { get: () => _pagination }
};

Object.entries(bindings).forEach(([key, descriptor]) => {
    Object.defineProperty(globalThis, key, { ...descriptor, configurable: true });
});

