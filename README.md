# Travel Photos App

A small personal web app to organize your travel photos by trip, tag them, and search them — private by default, running locally on your machine.

## Features

- Create trips with title, dates, location, and description
- Upload multiple photos into each trip
- Tag photos (e.g. `beach`, `sunset`, `family`)
- View photos in a grid per trip and delete unwanted ones
- Search trips (by title/location) and photos (by tags / file name)

## Tech stack

- Node.js + Express
- EJS templates
- Multer for file uploads

## Getting started

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

## CI/CD with Jenkins

This repo includes a `Jenkinsfile` that runs:

- `npm install`
- `npm run lint`
- `npm test`
- `docker build` (skips automatically if Docker is not available on the agent)
- optional `docker push` if you configure Jenkins variables + credentials

### Jenkins requirements

- Jenkins agent has **Node.js + npm** available (or configure the Jenkins *NodeJS* tool and wrap steps with `nodejs(...)`).
- Pipeline works on **Linux or Windows** agents (it uses `sh` on Unix and `bat` on Windows).
- If you want Docker build/push: Jenkins agent has **Docker** available and the Jenkins user can run `docker build`.

Recommended Jenkins plugins:

- **Pipeline**
- **Credentials Binding**
- (Optional) **NodeJS** (only if you want Jenkins-managed Node installations)

### Optional Docker push configuration

Create Jenkins environment variables:

- `DOCKER_REGISTRY` (example: `ghcr.io`)
- `DOCKER_REPO` (example: `gaowmw/travel-photos-app`)

Create Jenkins credentials:

- **Type**: Username with password
- **ID**: `docker-registry`
- **Username**: your registry username
- **Password**: registry token/password

