# Reliability Metrics Application

This web application displays reliability metrics for electrical circuits using ArcGIS JavaScript API.

**Live Version:** [https://reliability-metrics.netlify.app/#](https://reliability-metrics.netlify.app/#)

## Overview

The Reliability Metrics Application is a web-based tool that visualizes reliability metrics data for electrical circuits. It uses ArcGIS Online feature services to display spatial data on a map, allowing users to analyze reliability metrics for different circuits, districts, and regions.

## Prerequisites

- ArcGIS Online organizational account with access to the feature services
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Internet connection to access ArcGIS Online services

## Installation

1. Clone or download this repository to your local machine.
2. No additional installation is required as this is a web application.

## Running the Application

There are two ways to run the application locally:

### Method 1: Local Development

1. Navigate to the `src` directory.
2. Open the `index.html` file in a web browser.
   - For security reasons, some browsers may restrict access to ArcGIS Online when running from a local file. In this case, use a local web server.

### Method 2: Using a Local Web Server

1. Install a simple web server if you don't have one:
   - Python: `python -m http.server 8000` (run from the `reliability_app` directory)
   - Node.js: Install `http-server` using `npm install -g http-server` and run `http-server` from the `reliability_app` directory
2. Open your browser and navigate to `http://localhost:8000/src/` (or the appropriate port number)

## Authentication

The application requires authentication with ArcGIS Online:

1. Click the "Login with ArcGIS Online" button when prompted.
2. Enter your ArcGIS Online organizational credentials.
3. If you remain logged in to ArcGIS Online in your browser, you may be authenticated automatically.

## Troubleshooting

- **Authentication Issues**: Ensure you have the correct permissions to access the feature services.
- **Map Not Loading**: Check your network connection and that you have access to the ArcGIS Online services.
- **No Data Visible**: Verify that the feature services have been updated with the latest reliability metrics data.


