# XYD AI Large Model Locking Data Analysis and Learning Platform

A frontend application for monitoring, analyzing, and managing locking data from an AI large model platform. The application provides dashboards, real-time monitoring, sample search, review workflows, data import, and configuration screens.

## About the Project

This project is a single-page web application built with Angular 22. It is a frontend-only client with no backend code included. Users navigate through a sidebar to access feature modules for viewing analytics, monitoring lock operations, searching historical samples, reviewing low-confidence predictions, and importing data.

From the user's point of view, the application works as follows:

1. The user opens the application and sees the dashboard with KPI cards, an hourly trend chart, failure mode distribution, and a system monitoring table.
2. The user can open Real-time Lock Monitoring to view the latest lock judgment (PASS or FAIL), a torque-angle curve chart, key values such as sample ID and workstation, and recent results.
3. The user can open Sample Query to filter historical lock records by batch, model, result status, failure mode, confidence range, and date, then view the results in a paginated table.
4. The user can open Low Confidence Review to see samples that need manual confirmation, filter them, edit failure mode and corrected status, export to CSV, or delete records.
5. The user can open Data Import to upload curve files (ZIP, CSV, XLSX, JSON) or training data files, preview parsed rows, validate them, and write valid rows to the training set.

The application is a data review and monitoring tool for lock operations. It helps operators view real-time lock results, inspect historical samples, and manage data used for model training.

The main screens or modules are:

| Module | What the user can do |
|--------|---------------------|
| Homepage Overview (Dashboard) | View KPI cards, hourly trend chart, failure mode distribution, and system warnings. |
| Real-time Lock Monitoring | View live lock status, torque-angle curve, key values, and recent results. |
| Sample Query | Filter and search historical lock records with many criteria; view results in a table. |
| Low Confidence Review | Review uncertain predictions, edit failure mode/corrected status, export CSV, delete records. |
| Data Import | Upload curve or training files, preview parsed data, validate rows, write to training set. |
| Data Export | Placeholder page. No export logic implemented. |
| Parameter & Formula Configuration | Placeholder page. |
| Training Task Management | Placeholder page. |
| Version Management | Placeholder page. |
| Logs & Monitoring | Placeholder page. |
| Permission Management | Placeholder page. |

The dashboard, real-time monitoring, sample search, low confidence review, and data import modules are implemented with real components, services, and mock data. The remaining modules (data export, parameters and formulas, training tasks, version management, logs and monitoring, permission management) are placeholder pages only. They display a title and description but have no working logic.

The project is in a partial implementation state. Core monitoring and review features work with mock data. Several modules listed in the navigation are not yet implemented.

## Overview

This application is a frontend for an AI large model locking data analysis platform. It is intended for operators and analysts who need to:

- Monitor lock operations in real time.
- Search historical lock records.
- Review samples with low model confidence.
- Import curve and training data files.

The application connects to no backend API in the current code. All data shown comes from mock data files inside the source code. The purpose beyond showing a UI is not clear from the code alone — there is no backend service, no API client, and no real data source connected.

## Key Features

| Feature | Description |
|---------|-------------|
| Dashboard | Homepage overview with KPI cards (total locked items, PASS rate, FAIL count, low confidence count), hourly trend chart, failure mode distribution bar chart, and a system monitoring table showing recent warnings. |
| Real-time Lock Monitoring | Live status bar, service status badges, torque-angle curve chart for the latest lock, key values (sample ID, workstation, torque, angle, model version), and a recent results list. |
| Sample Query | Search historical lock records with filters for batch, model, screwdriver model, bit type, screw specification, material, glue peeling resistance, tooth type, result status, failure modes, confidence range, and date range. Results display in a paginated table with PASS/FAIL tags. |
| Low Confidence Review | Review samples with confidence below a threshold. Includes filter panel, summary cards (pending, reviewed, completion rate), a checklist table with row selection, edit/view/delete modals, bulk delete, and CSV export. |
| Data Import | Import playback curve files (ZIP, CSV, TSV, TXT, XLSX, XLS, JSON) and training data files. Includes file validation, background parsing via Web Worker, column mapping dialog, progress tracking, row editing, duplicate handling, and error report download. |
| Data Export | Placeholder page only. No export logic. |
| Parameter & Formula Configuration | Placeholder page only. |
| Training Task Management | Placeholder page only. |
| Version Management | Placeholder page only. |
| Logs & Monitoring | Placeholder page only. |
| Permission Management | Placeholder page only. |

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Angular | 22.2.0 |
| Language | TypeScript | 6.0.2 |
| Styling | Tailwind CSS | 4.3.3 |
| Styling | SCSS | — |
| State management | Angular Signals | Built-in |
| Routing | Angular Router | Built-in |
| Build tool | Angular CLI / @angular/build | 22.2.5 |
| ZIP handling | fflate | 0.8.3 |
| Reactive programming | rxjs | 7.8.0 |
| Excel parsing | xlsx | 0.18.5 |
| Utility library | tslib | 2.3.0 |
| Package manager | npm | 11.19.1 |

Exact dependency versions are listed in `package.json`.

## Prerequisites

Install these tools before starting:

- **Git** — Download from https://git-scm.com/
- **Node.js** — Download from https://nodejs.org/. Required version: 20.19+ or 22.12+ (required by Angular 22)
- **npm** — Comes with Node.js. Required version: 11+

After installing, check the versions:

```bash
git --version
node --version
npm --version
```

Angular CLI 22.2.5 is installed as a dev dependency in the project, so you do not need to install it globally.

No other tools are required.

## Installation and Run Guide

### 1. Download the project

Choose one of the following options.

**Option A: Clone with Git**

```bash
git clone https://github.com/hafizbilalakbar/xyd-ai-large-analytics-model.git
cd xyd-ai-large-analytics-model
```

**Option B: Download ZIP from GitHub**

1. Go to https://github.com/hafizbilalakbar/xyd-ai-large-analytics-model
2. Click the green **Code** button and select **Download ZIP**.
3. Extract the ZIP file to any folder on your computer.
4. Open a terminal inside the extracted folder.

> The project folder can be anywhere on your computer. The path does not matter.

### 2. Install dependencies

```bash
npm install
```

This creates the `node_modules` folder and installs all dependencies listed in `package.json`. It may take a few minutes.

### 3. Environment and config setup

- The project does not include an `.env` file or any committed environment template.
- The `.gitignore` file ignores `.env`, `.env.*`, and related files.
- No API URLs or secrets are present in the source code. All data comes from mock files.
- If you need environment variables, create them locally and do not commit them.

### 4. Run the development server

```bash
npm start
```

This runs `ng serve --port 4200`. Open `http://localhost:4200/` in a browser.

To stop the server, press **Ctrl + C** in the terminal.

### 5. Build for production

```bash
npm run build
```

Build artifacts are written to the `dist/` folder.

### 6. Run tests

- No test files (`.spec.ts` or `.test.ts`) exist in the project.
- There is no test script in `package.json`.

### 7. npm scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `ng serve --port 4200` | Start the development server on port 4200 |
| `build` | `ng build` | Build the application for production |
| `watch` | `ng build --watch --configuration development` | Build in watch mode for development |
| `ng` | `ng` | Run Angular CLI commands |

### 8. Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| `npm` is not recognized | npm is not installed or not in PATH | Install Node.js from https://nodejs.org/. npm is included. Restart your terminal after installation. |
| `git` is not recognized | Git is not installed or not in PATH | Install Git from https://git-scm.com/. Restart your terminal after installation. |
| Wrong Node.js version | Angular 22 requires Node.js 20.19+ or 22.12+ | Run `node --version` to check. Install a supported version from https://nodejs.org/. |
| Port 4200 is already in use | Another application is using port 4200 | Close the other application, or change the port: `npm start -- --port 4201` |
| `npm install` fails | Network issue, corrupted cache, or incompatible Node version | Try deleting `node_modules` and `package-lock.json`, then run `npm install` again. Warning: this may change package versions. |

Commands work the same on Windows, macOS, and Linux. No command differences are needed.

## Project Structure

The following tree excludes `node_modules`, `dist`, `.angular`, and `.git`.

```
src/
├── app/
│   ├── core/
│   │   ├── auth/
│   │   │   └── auth.service.ts              # Signal-based auth service (sign in/out, current user)
│   │   └── config/
│   │       ├── app-settings.ts              # App name, version, status label constants
│   │       └── navigation.config.ts         # Sidebar navigation items (label, route, icon)
│   ├── features/
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   │   ├── failure-mode-chart/      # Bar chart of failure mode distribution
│   │   │   │   ├── hourly-trend-chart/      # SVG line/area chart of hourly trends
│   │   │   │   └── system-monitoring-table/ # Table of recent system warnings
│   │   │   ├── data-access/
│   │   │   │   ├── dashboard.data.ts        # Mock KPI, trend, failure mode, and warning data
│   │   │   │   ├── dashboard.models.ts      # TypeScript interfaces for dashboard data
│   │   │   │   └── dashboard.store.ts       # Signal store exposing dashboard data
│   │   │   ├── pages/
│   │   │   │   └── dashboard/               # Dashboard page component
│   │   │   └── dashboard.routes.ts          # Dashboard route definition
│   │   ├── realtime-monitoring/
│   │   │   ├── components/
│   │   │   │   ├── monitoring-empty-state/  # Empty state shown when no live data exists
│   │   │   │   ├── monitoring-live-result/  # Latest lock result, torque-angle chart, key values
│   │   │   │   ├── monitoring-status-bar/   # Reception status, frequency, last received time
│   │   │   │   ├── monitoring-status-badges/# Service status and model version badges
│   │   │   │   └── torque-angle-chart/      # SVG torque vs angle curve chart
│   │   │   ├── data-access/
│   │   │   │   ├── monitoring.mock.ts       # Mock lock records and curve points
│   │   │   │   ├── monitoring.models.ts     # Types for monitoring records
│   │   │   │   └── monitoring.service.ts    # Signal service for live monitoring state
│   │   │   ├── pages/
│   │   │   │   └── realtime-monitoring-page/# Real-time monitoring page
│   │   │   └── realtime-monitoring.routes.ts# Route definition
│   │   ├── sample-search/
│   │   │   ├── components/
│   │   │   │   ├── multi-select-dropdown/   # Accessible multi-select dropdown
│   │   │   │   ├── sample-filter-panel/     # Filter form with many criteria
│   │   │   │   ├── sample-results-table/    # Paginated results table
│   │   │   │   └── table-pagination/        # Pagination controls
│   │   │   ├── data-access/
│   │   │   │   ├── sample-models.ts         # Types for sample filter and results
│   │   │   │   ├── sample.mock.ts           # Mock sample results and filter options
│   │   │   │   └── sample.service.ts        # Signal service for filtering and pagination
│   │   │   ├── pages/
│   │   │   │   ├── sample-search-page/      # Sample search page component
│   │   │   │   └── sample-search/           # Unused feature placeholder page
│   │   │   └── sample-search.routes.ts      # Route definition
│   │   ├── low-confidence-review/
│   │   │   ├── components/
│   │   │   │   ├── review-checklist-table/  # Table with select, view, edit, delete actions
│   │   │   │   ├── review-filter-panel/     # Filter form for review records
│   │   │   │   └── review-summary-cards/    # Summary cards with progress bar
│   │   │   ├── data-access/
│   │   │   │   ├── low-confidence-review.mock.ts  # Mock review rows
│   │   │   │   ├── low-confidence-review.models.ts # Types for review data
│   │   │   │   └── low-confidence-review.service.ts # Service for filter, sort, edit, delete, export
│   │   │   ├── pages/
│   │   │   │   ├── low-confidence-review-page/    # Low confidence review page
│   │   │   │   └── low-confidence-review/         # Unused feature placeholder page
│   │   │   └── low-confidence-review.routes.ts    # Route definition
│   │   ├── data-import/
│   │   │   ├── components/
│   │   │   │   ├── column-mapping-dialog/   # Dialog to review auto-detected column mappings
│   │   │   │   ├── curve-viewer/            # Viewer for a selected playback curve
│   │   │   │   ├── file-dropzone/           # Drag-and-drop file upload zone
│   │   │   │   ├── import-progress/         # Progress bar with import stage steps
│   │   │   │   ├── import-tabs/             # Playback vs Training import tabs
│   │   │   │   ├── playback-import-modal/   # Modal to select batch and files for import
│   │   │   │   ├── playback-import-panel/   # Playback results list and curve viewer
│   │   │   │   ├── playback-results-list/   # Searchable playback results table
│   │   │   │   ├── training-import-panel/   # Training rows preview and actions
│   │   │   │   └── training-preview-table/  # Editable training rows table
│   │   │   ├── data-access/
│   │   │   │   ├── column-mapper.service.ts # Detects and maps CSV column headers to fields
│   │   │   │   ├── data-import.mock.ts      # Mock generators for import files
│   │   │   │   ├── data-import.models.ts    # Types for import, column mapping, progress
│   │   │   │   ├── data-import.service.ts   # Main import orchestration service
│   │   │   │   ├── format-detector.service.ts # Detects file type, encoding, delimiter
│   │   │   │   ├── import-api.service.ts    # Mock API for batches, upload, template download
│   │   │   │   ├── import-parser.service.ts # Web Worker-based file parser service
│   │   │   │   ├── import-parser.worker.ts  # Web Worker that parses playback/training files
│   │   │   │   └── import-constants.ts      # File limits, synonyms, failure codes, validation
│   │   │   ├── pages/
│   │   │   │   ├── data-import-page/        # Main data import page (playback + training)
│   │   │   │   └── data-import/             # Unused feature placeholder page
│   │   │   └── data-import.routes.ts        # Route definition
│   │   ├── data-export/
│   │   │   ├── pages/
│   │   │   │   └── data-export/             # Placeholder page only
│   │   │   └── data-export.routes.ts        # Route definition
│   │   ├── parameters-and-formulas/
│   │   │   ├── pages/
│   │   │   │   └── parameters-and-formulas/ # Placeholder page only
│   │   │   └── parameters-and-formulas.routes.ts # Route definition
│   │   ├── training-tasks/
│   │   │   ├── pages/
│   │   │   │   └── training-tasks/          # Placeholder page only
│   │   │   └── training-tasks.routes.ts     # Route definition
│   │   ├── version-management/
│   │   │   ├── pages/
│   │   │   │   └── version-management/      # Placeholder page only
│   │   │   └── version-management.routes.ts # Route definition
│   │   ├── logs-and-monitoring/
│   │   │   ├── pages/
│   │   │   │   └── logs-and-monitoring/     # Placeholder page only
│   │   │   └── logs-and-monitoring.routes.ts # Route definition
│   │   └── permission-management/
│   │       ├── pages/
│   │       │   └── permission-management/   # Placeholder page only
│   │       └── permission-management.routes.ts # Route definition
│   ├── layout/
│   │   ├── header/                          # Top header with brand, user menu, sign in/out
│   │   ├── main-layout/                     # Shell layout with header, sidebar, content
│   │   └── sidebar/                         # Left navigation sidebar
│   ├── shared/
│   │   ├── components/
│   │   │   ├── confirm-dialog/              # Confirmation dialog built on modal
│   │   │   ├── feature-placeholder/         # Empty state for unimplemented features
│   │   │   ├── icon/                        # SVG icon component and icon paths
│   │   │   ├── modal/                       # Accessible modal dialog with focus trapping
│   │   │   ├── page-header/                 # Page title and description header
│   │   │   ├── stat-card/                   # KPI card with icon, value, delta trend
│   │   │   └── toast-container/             # Toast notification display
│   │   └── services/
│   │       └── toast.service.ts             # Toast signal service (show, dismiss, pause, resume)
│   ├── app.component.ts                     # Root component with router outlet
│   ├── app.component.html                   # Root template
│   ├── app.component.scss                   # Root styles
│   ├── app.config.ts                        # Application providers (router, error listeners)
│   └── app.routes.ts                        # Root lazy-loaded route configuration
├── assets/
│   └── images/
│       └── favicon.ico                      # Application favicon
├── styles/
│   ├── _base.scss                           # CSS custom properties (colors, spacing, fonts)
│   ├── _mixins.scss                         # SCSS mixins (surface-card, media queries)
│   ├── _variables.scss                      # SCSS breakpoint variables
│   └── tailwind.css                         # Tailwind CSS 4 entry with source scanning
├── index.html                               # Application HTML entry point
├── main.ts                                  # Bootstrap entry point
└── styles.scss                              # Global SCSS entry
```

Configuration and tooling files at the project root:

| File | Purpose |
|------|---------|
| `angular.json` | Angular build and serve configuration |
| `package.json` | npm scripts and dependency declarations |
| `package-lock.json` | Locked dependency versions |
| `tsconfig.json` | TypeScript compiler options (strict mode) |
| `tsconfig.app.json` | Application-specific TypeScript config |
| `.editorconfig` | Editor formatting rules (indent, charset) |
| `.prettierrc` | Prettier code formatting rules |
| `.postcssrc.json` | PostCSS plugins (Tailwind CSS) |
| `.gitignore` | Git ignore rules |
| `serve.log` | Development server build log |
| `tsc.log` | TypeScript compile log (binary, not readable) |

## Architecture and Data Flow

### Application startup

1. `main.ts` calls `bootstrapApplication(AppComponent, appConfig)`.
2. `appConfig` provides the router with routes from `app.routes.ts` and browser error listeners.
3. `AppComponent` renders a `router-outlet`.
4. The root route renders `MainLayoutComponent`, which contains the header, sidebar, and a child `router-outlet` for feature pages.
5. The default path redirects to `/dashboard`.

### Routing

- `app.routes.ts` defines lazy-loaded routes for all feature modules.
- Each feature module has its own `feature.routes.ts` file.
- Implemented features use `loadComponent` for lazy loading. `sample-search` and `data-import` use eager `component` loading for their page components.
- All routes are children of `MainLayoutComponent`.
- An empty path redirects to `/dashboard`. Any unknown path redirects to the root.

### Components and services

- Components use `ChangeDetectionStrategy.OnPush` and are standalone.
- State is managed with Angular Signals (`signal`, `computed`, `effect`).
- Each feature has a `data-access` folder containing models (TypeScript interfaces), mock data, and a signal-based service.
- Pages inject services and pass data down to presentational components via `@input()` and events via `@output()`.
- Shared components (modal, confirm-dialog, stat-card, icon, toast-container, page-header) are reused across features.

### Data flow from user action to screen

Example: Sample Query search
1. User changes a filter value in `sample-filter-panel`.
2. `sample-filter-panel` calls `sample.service.setFilter(key, value)` to update the signal.
3. User clicks Query. `sample-filter-panel` emits a `query` event.
4. `sample-search-page` calls `sample.service.query()`.
5. `sample.service` applies filters to mock data, stores the result in a signal, and sets `isLoading` to true/false.
6. `sample-results-table` reads the `results()` signal and renders the table rows.
7. `table-pagination` reads page signals and renders pagination controls.

Example: Data import parsing
1. User selects files in `playback-import-modal`.
2. `data-import-page` calls `data-import.service.importPlayback(batchId, files)`.
3. `data-import.service` calls `import-parser.service.parsePlayback(files, batchId)`.
4. `import-parser.service` sends the request to `import-parser.worker.ts` (Web Worker).
5. The worker parses files in the background and sends progress/result messages back.
6. `data-import.service` updates progress signals and stores parsed items.
7. `playback-import-panel` and `playback-results-list` read the signals and render the UI.

## AI / Analytics Features

The application name references an AI large model, but the code itself contains no AI model, no machine learning logic, and no inference code. The analytics features are:

- **Dashboard:** KPI cards, hourly trend chart, failure mode distribution bar chart, system warning table. All data is hardcoded mock data in `dashboard.data.ts`.
- **Real-time monitoring:** Torque-angle curve visualization using SVG, lock judgment (PASS/FAIL) based on torque values, service status indicators.
- **Sample search:** Filtering and pagination of historical lock records. Mock data contains sample IDs, locking times, models, results, failure modes, and confidence scores.
- **Low confidence review:** Samples are flagged when confidence is below 80 (`LOW_CONFIDENCE_THRESHOLD = 80` in `sample.service.ts`). Users can review, edit, and export these records.
- **Data import:** Curve judgment logic in `import-parser.worker.ts` marks a curve as PASS if peak torque >= 0.5 and final torque >= 0.2, otherwise FAIL.

There is no model training, no prediction API, and no AI integration in the frontend code.

## Configuration

| File | Purpose |
|------|---------|
| `angular.json` | Configures the Angular build: browser entry (`src/main.ts`), TypeScript config, SCSS stylesheet, assets (`src/assets`), output budgets, and serve port. |
| `tsconfig.json` | TypeScript compiler options: strict mode, no unused locals/parameters, ES2022 target, module preservation, experimental decorators, isolated modules. Angular strict templates enabled. |
| `tsconfig.app.json` | Extends `tsconfig.json`. Includes all `src/**/*.ts` files, excludes spec files. |
| `.postcssrc.json` | PostCSS configuration with `@tailwindcss/postcss` plugin for Tailwind CSS 4. |
| `.prettierrc` | Prettier formatting: print width 100, single quotes, Angular HTML parser. |
| `.editorconfig` | Editor settings: UTF-8 charset, 2-space indent, insert final newline, trim trailing whitespace, single quotes for TypeScript. |

No `.env` file exists in the repository. The `.gitignore` ignores `.env`, `.env.*`, `.local`, and secrets files. No API URLs, keys, or credentials are present in the source code.

## Common Problems and Fixes

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| Wrong Node.js version | Angular 22 requires Node.js 20.19+ or 22.12+ | Install a supported Node.js version and run `node --version` to confirm |
| Port 4200 already in use | Another process is using port 4200 | Stop the other process or change the port in `package.json` (`ng serve --port <port>`) |
| `npm install` fails | Network issue or incompatible Node version | Clear npm cache (`npm cache clean --force`) and retry with a supported Node version |
| Build fails with type errors | Strict TypeScript config (`tsconfig.json`) | Fix type errors in `src/**/*.ts`. `noUnusedLocals` and `noUnusedParameters` are enabled. |
| Development server does not reload | File watching issue | Use `npm run watch` for build watch mode, or restart `npm start` |

The `serve.log` file shows a successful development server build on `http://localhost:4200/` with lazy chunks for each feature module. The `tsc.log` file exists but is binary and could not be read.

## Coding Standards

Formatting rules from `.prettierrc`:

- Print width: 100 characters
- Single quotes: true
- HTML files use the Angular parser

Formatting rules from `.editorconfig`:

- Charset: UTF-8
- Indent style: space
- Indent size: 2
- Insert final newline: true
- Trim trailing whitespace: true
- TypeScript files use single quotes

Run Prettier to format all files:
```
npx prettier --write .
```

## Contributing and Git workflow

No contributing guidelines, commit message conventions, or branch policies are present in the repository. The `README.md` previously contained a contributing section with branch and commit instructions, but that content was not found in any code or config file. If you want to add a contributing workflow, use a TODO note here.

## License and Contact

No license file exists in the repository. The previous README described the project as proprietary, but no `LICENSE` file was found. No contact information or repository URL is present in code or config files.

TODO: Add license information.
TODO: Add contact information.
TODO: Add repository URL if applicable.

---

### Confirmation

- Only `README.md` was edited. No other file was created, modified, or deleted.
- No code files, config files, or log files were changed.

### Items that could not be confirmed

- The `tsc.log` file is binary and could not be read, so no TypeScript compile errors or fixes could be extracted from it.
- No test files exist, so no test commands or coverage information could be included.
- No `.env` file or environment template exists, so no environment setup steps could be provided beyond noting their absence.
- The ultimate purpose of the application beyond the frontend UI is not clear from the code; no backend or API client is present.
- No license, contact, or repository information exists in the repository files.
