# FleetMIS Frontend

This folder contains the modularized GeeDrive Motors fleet management frontend.

## Run Locally

Serve the app over HTTP from this directory:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://127.0.0.1:8080/index.html
```

Do not open `index.html` with `file://`; the app shows the existing file-protocol warning and ES modules are expected to be served over HTTP.

## External Dependencies

- Roboto is loaded from Google Fonts in `index.html`.
- Lucide is loaded globally from `https://unpkg.com/lucide@latest` in `index.html`.
- `js/main.js` keeps the existing `lucide.createIcons()` boot behavior.
- The API client points to `http://127.0.0.1:8000` and uses the existing hardcoded `FLEET_API_KEY` from the original file.

## Module Scope And Window Compatibility

The original file used inline HTML handlers and global variables. The refactor keeps those handlers compatible by attaching exported module functions to `window` in `js/main.js`.

Shared state is defined in `js/state.js` and exposed through `globalThis` accessors so existing names such as `allCars`, `allDrivers`, `_pagination`, `currentFireDriver`, and `currentViewCar` keep working across modules and inline handlers.

## Inline Handlers

Inline handlers remain in the HTML and generated table/modal markup for existing commands such as modal open/close actions, filters, pagination buttons, notification dismissal, overflow menus, dashboard filtering, car details, driver termination, and retry buttons.

## Window Exports

`js/main.js` attaches the exported functions from these modules to `window`:

- `utils.js`
- `notifications.js`
- `dropdowns.js`
- `cars.js`
- `drivers.js`
- `dashboard.js`
- `weekly-log.js`
- `navigation.js`

This preserves compatibility for existing `onclick`, `oninput`, `onchange`, and generated HTML strings without renaming the original functions.
