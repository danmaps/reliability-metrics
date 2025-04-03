const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

let mainWindow;

// Register a custom arcgis: protocol to handle OAuth redirects
function registerProtocols() {
  protocol.registerFileProtocol('arcgis', (request, callback) => {
    const url = request.url.substr(9); // Remove "arcgis://" protocol
    callback({ path: path.normalize(`${__dirname}/${url}`) });
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'build/app-icon.ico')
  });

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

  // Enable DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Allow navigation to the OAuth callback URL
  mainWindow.webContents.session.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, 
    (details, callback) => {
      const urlObj = new URL(details.url);
      if (urlObj.pathname.includes('oauth-callback.html')) {
        console.log("Allowing OAuth callback navigation:", details.url);
      }
      callback({cancel: false});
    }
  );

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  registerProtocols();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
