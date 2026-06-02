export const state = {
    allDrivers: [],
    allCars: [],
    nrcCheckTimer: null,
    nrcIsValid: false,
    currentFireDriver: null,
    currentViewCar: null,
    filteredWeeklyMileage: {},
    carsFilterStatus: 'all',
    carsFilterType: 'all',
    driversFilterStatus: 'all',
};

export const pagination = {
    cars:    { page: 1, pageSize: 25, total: 0 },
    drivers: { page: 1, pageSize: 25, total: 0 },
};

export function setAllCars(cars) {
    state.allCars = Array.isArray(cars) ? cars : [];
}

export function setAllDrivers(drivers) {
    state.allDrivers = Array.isArray(drivers) ? drivers : [];
}

export function resetCarsFilters() {
    state.carsFilterStatus = 'all';
    state.carsFilterType = 'all';
}

export function resetDriversFilters() {
    state.driversFilterStatus = 'all';
}
