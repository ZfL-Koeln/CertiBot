# CertiBot

> Automated certificate generation for the Zentrum für LehrerInnenbildung (ZfL) — University of Cologne

CertiBot is an Angular web application for the automated creation and secure management of participation certificates for courses and continuing education offerings at ZfL.

## Features

- 📄 Automated generation of participation certificates
- 🔐 Encryption of sensitive certificate data (via `encrypt/` module)
- 🌐 Web-based interface built with Angular 20 (Standalone Components)
- 📦 Static output deployable on Apache web servers

## Tech Stack

| Technology | Version |
|---|---|
| Angular | 20.x (CLI-generated) |
| TypeScript | ~5.x |
| Node.js | ≥ 18.x recommended |
| Package Manager | npm |

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [Angular CLI](https://angular.dev/tools/cli) ≥ 20

```bash
npm install -g @angular/cli
```

## Installation

```bash
git clone https://github.com/ZfL-Koeln/CertiBot.git
cd CertiBot
npm install
```

## Development Server

```bash
ng serve
```

Then open your browser at [http://localhost:4200](http://localhost:4200).

The application reloads automatically when source files are modified.

## Build

```bash
ng build
```

Build artifacts are placed in the `dist/` directory. The production build is optimized for performance and load time.

For deployment on an Apache web server, an `.htaccess` configuration file (`htaccess`) is included — rename it to `.htaccess` and copy it to the target directory before deploying.

## Project Structure

```
CertiBot/
├── src/              # Angular application sources
├── public/           # Static assets (logos, templates)
├── encrypt/          # Encryption module for certificate data
├── angular.json      # Angular CLI configuration
├── htaccess          # Apache configuration (→ rename to .htaccess)
├── tsconfig.json     # TypeScript configuration
└── package.json      # Dependencies and npm scripts
```

## Tests

**Unit tests:**

```bash
ng test
```

**End-to-end tests:**

```bash
ng e2e
```

> For e2e tests, a framework such as [Playwright](https://playwright.dev/) or [Cypress](https://www.cypress.io/) must be installed first.

## Deployment

1. Create a production build: `ng build`
2. Copy the contents of `dist/certibot/browser/` to the web server
3. Copy the `htaccess` file as `.htaccess` into the target directory (required for Angular routing)
