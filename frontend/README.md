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

## Module Scope

The frontend is organized as ES modules with explicit imports between concerns:

- `js/api.js` owns backend transport and response mapping.
- `js/state.js` owns shared frontend state and pagination.
- `js/cache.js` owns short-lived client cache entries.
- Feature modules such as `cars.js`, `drivers.js`, `dashboard.js`, `dropdowns.js`, and `weekly-log.js` own their feature behavior.
- `js/events.js` owns DOM event delegation for user actions.
- `js/main.js` is the composition root that wires setup functions and starts the app.

No module publishes application functions or state onto `window`/`globalThis`.

## Event Wiring

HTML and generated markup use `data-action` attributes rather than inline JavaScript handlers. `js/events.js` translates those action names into imported feature functions, which keeps markup, event wiring, feature logic, API calls, and shared state separate.
