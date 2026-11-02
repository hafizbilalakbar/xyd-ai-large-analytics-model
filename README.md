# XYD AI Large Analytics Model

A modern analytics and monitoring front end for the **XYD AI Large Model Locking Data Analysis and Learning Platform**. The application provides a real-time operational dashboard, sample analysis, review workflows, data import/export, model parameter management, training task oversight, version control, system logs, and permission management.

Built with **Angular 22**, **TypeScript**, **Tailwind CSS 4**, and **SCSS**, using standalone components, lazy-loaded feature routes, and a clean feature-based architecture.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Angular 22 (standalone components) |
| Language | TypeScript 6 |
| Styling | Tailwind CSS 4, SCSS |
| State | Angular Signals |
| Routing | Angular Router with lazy-loaded feature routes |
| Build | Angular CLI / `@angular/build` |
| Formatting | Prettier |

---

## Features

- **Homepage Overview** — KPI cards, hourly trend charts, failure mode distribution, and system monitoring table.
- **Real-time Lock Monitoring** — live status bar, torque-angle visualization, and monitoring result panels.
- **Sample Query** — search and inspect historical samples.
- **Low Confidence Review** — dedicated review workflow for uncertain model predictions.
- **Data Import / Export** — structured data ingestion and export screens.
- **Parameter & Formula Configuration** — manage model parameters and formulas.
- **Training Task Management** — track model training tasks.
- **Version Management** — manage model versions and release history.
- **Logs & Monitoring** — inspect application and system logs.
- **Permission Management** — role and access administration.

---

## Getting Started

### Prerequisites

- **Node.js** 20.19+ or 22.12+ (Angular 22 requirement)
- **npm** 11+

### Installation

```bash
git clone https://github.com/hafizbilalakbar/xyd-ai-large-analytics-model.git
cd xyd-ai-large-analytics-model
npm install
```

### Development server

```bash
npm start
```

Open `http://localhost:4200/`. The application reloads automatically when source files change.

### Production build

```bash
npm run build
```

Build artifacts are written to `dist/`.

### Code formatting

```bash
npx prettier --write .
```

---

## Project Structure

```text
src/
├── app/
│   ├── core/                 # Auth, app settings and navigation configuration
│   ├── features/             # Lazy-loaded feature modules
│   │   ├── dashboard/
│   │   ├── realtime-monitoring/
│   │   ├── sample-search/
│   │   ├── low-confidence-review/
│   │   ├── data-import/
│   │   ├── data-export/
│   │   ├── parameters-and-formulas/
│   │   ├── training-tasks/
│   │   ├── version-management/
│   │   ├── logs-and-monitoring/
│   │   └── permission-management/
│   ├── layout/               # Header, sidebar and main layout shell
│   ├── shared/               # Reusable components (icons, cards, page headers)
│   ├── app.routes.ts         # Root lazy-loaded route configuration
│   └── app.config.ts         # Application providers
├── assets/                   # Static assets
├── styles/                   # Tailwind entry point, SCSS variables and mixins
├── index.html
├── main.ts
└── styles.scss
```

Each feature follows a consistent structure:

```text
feature/
├── components/       # Feature-specific UI components
├── data-access/      # Models, mock data and services
├── pages/            # Routed page components
└── feature.routes.ts # Feature route definitions
```

---

## Configuration and Secrets

This project does not commit environment files or credentials. Copy the required environment template if one is added, and keep local values in untracked files:

```bash
cp .env.example .env
```

Files matching `.env*`, certificates, credentials, and local configuration overrides are ignored by Git. Never commit API keys, passwords, or access tokens.

---

## Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make focused changes and follow the existing project structure and Prettier configuration.
3. Verify the production build: `npm run build`
4. Commit using a clear message, for example: `feat(dashboard): add failure trend filter`
5. Push the branch and open a pull request against `main`.

---

## Repository

- **GitHub:** https://github.com/hafizbilalakbar/xyd-ai-large-analytics-model
- **Default branch:** `main`

---

## License

This project is proprietary. All rights reserved unless a separate license is added to the repository.
