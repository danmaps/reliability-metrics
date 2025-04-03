@echo off
echo Building Reliability Metrics Map application...
echo.

REM Create the build directory if it doesn't exist
if not exist "build" mkdir build

REM Check if icon file exists, if not create a placeholder
if not exist "build\app-icon.ico" (
  echo Creating placeholder icon file...
  copy "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "build\icon.ico" >nul 2>&1
  if errorlevel 1 (
    echo Warning: Couldn't create icon file. The app will use default Electron icon.
    echo. > "build\app-icon.ico"
  )
)

REM Clean up previous build files that might be locked
echo Cleaning up previous build files...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM Reliability*.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Try to remove the app.asar file if it exists
if exist "dist\win-unpacked\resources\app.asar" (
  del /F "dist\win-unpacked\resources\app.asar" >nul 2>&1
  if errorlevel 1 (
    echo Warning: Could not delete previous app.asar file. You may need to reboot.
  )
)

REM Run the build command
echo Running build process...
npm run dist:win

if errorlevel 1 (
  echo.
  echo Build failed. Try running this script as administrator.
  echo Right-click on this batch file and select "Run as administrator".
  pause
) else (
  echo.
  echo Build completed successfully!
  echo Your application is available in the dist folder.
  echo.
  pause
)