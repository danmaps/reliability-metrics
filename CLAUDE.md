# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview

This is a reliability metrics visualization web application that displays electrical circuit reliability data using ArcGIS JavaScript API. The application uses OAuth authentication to connect to ArcGIS Online services and provides interactive mapping and filtering capabilities.

## Key Architecture Components

- **Frontend**: HTML5 web application using ArcGIS JavaScript API 4.28
- **Authentication**: OAuth2 flow with ArcGIS Online (App ID: `pPrg9fAk5JOQBCuq`)
- **Main Entry Points**:
  - `index.html` - Main web application entry point
  - `rel.js` - Primary application logic with ArcGIS integration

## Development Commands

### Running the Application
```bash
# For local development on 127.0.0.1:5500 (required for OAuth redirects):
npx http-server . -p 5500 -a 127.0.0.1
# Then navigate to http://127.0.0.1:5500/

# Alternative Python server (different port):
python3 -m http.server 8000
# Then navigate to http://localhost:8000/
```

## Authentication Configuration

The application uses ArcGIS Online OAuth with these settings:
- Portal URL: `https://sce2.maps.arcgis.com`
- App ID: `pPrg9fAk5JOQBCuq`
- OAuth callback: `oauth-callback.html`
- Flow type: implicit
- Session expires: 2 weeks (20160 minutes)

## Key Files Structure

- `index.html` - Main HTML with embedded CSS and error handling
- `rel.js` - Core application logic, ArcGIS map initialization, and OAuth handling
- `oauth-callback.html` - OAuth callback handler
- `package.json` - Project metadata
- `assets/icons/` - Application icons
- `public/assets/` - Public assets

## Development Notes

- OAuth callback URL is dynamically calculated based on current location
- Error handling displays in-app error messages for debugging
- The app includes a welcome modal that handles authentication flow
- Live version is deployed at: https://reliability-metrics.netlify.app/