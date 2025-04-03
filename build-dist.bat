@echo off
setlocal enableextensions enabledelayedexpansion

REM Change to script directory
cd /d "%~dp0"
echo ===================================================
echo Reliability Metrics Map - Distribution Builder
echo ===================================================
echo.

REM Parse command line arguments
set BUILD_TYPE=portable
set CLEAN_BUILD=0
set BUILD_ALL=0

:parse_args
if "%~1"=="" goto :end_parse_args
if /i "%~1"=="--clean" (
    set CLEAN_BUILD=1
    goto :next_arg
)
if /i "%~1"=="--nsis" (
    set BUILD_TYPE=nsis
    goto :next_arg
)
if /i "%~1"=="--portable" (
    set BUILD_TYPE=portable
    goto :next_arg
)
if /i "%~1"=="--all" (
    set BUILD_ALL=1
    goto :next_arg
)
if /i "%~1"=="--help" (
    echo Usage: build-dist.bat [options]
    echo Options:
    echo   --clean     Perform a clean build (delete node_modules and cache)
    echo   --portable  Build a portable executable (default)
    echo   --nsis      Build a standard installer (NSIS)
    echo   --all       Build both portable and installer versions
    echo   --help      Show this help message
    exit /b 0
)

:next_arg
shift
goto :parse_args
:end_parse_args

REM Kill any running instances that might cause file locks
echo Closing any running application instances...
taskkill /F /IM "Reliability Metrics Map.exe" /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1
timeout /t 1 >nul

REM Clean build if requested
if %CLEAN_BUILD%==1 (
    echo Performing clean build - removing previous artifacts...
    if exist "dist" rd /s /q "dist"
    if exist ".cache" rd /s /q ".cache"
    if exist "electron-cache" rd /s /q "electron-cache"
    if exist "node_modules\.cache" rd /s /q "node_modules\.cache"
    
    echo Reinstalling dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

REM Create or ensure build directory exists
if not exist "build" mkdir build

REM Create icon if it doesn't exist
if not exist "build\icon.ico" (
    echo Creating icon file...
    
    REM Try to borrow icon from Edge browser
    if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
        copy "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "build\icon.ico" >nul 2>&1
        if not errorlevel 1 (
            echo Icon created from Microsoft Edge.
        ) else (
            echo Failed to copy icon from Edge.
            echo Creating empty icon file.
            type nul > "build\icon.ico"
        )
    ) else (
        REM Try Windows explorer icon as fallback
        if exist "%windir%\explorer.exe" (
            copy "%windir%\explorer.exe" "build\icon.ico" >nul 2>&1
            if not errorlevel 1 (
                echo Icon created from Windows Explorer.
            ) else (
                echo Failed to copy icon from Explorer.
                echo Creating empty icon file.
                type nul > "build\icon.ico"
            )
        ) else (
            echo Creating empty icon file.
            type nul > "build\icon.ico"
        )
    )
)

REM Set up build version from package.json
set APP_VERSION=1.0.0
for /f "tokens=*" %%a in ('node -e "console.log(require('./package.json').version)"') do (
    set APP_VERSION=%%a
)

REM Alternative version extraction if the above fails
if not defined APP_VERSION (
    echo Warning: Could not extract version from package.json
    set APP_VERSION=1.0.0
    echo Using default version: %APP_VERSION%
)
echo Building version: %APP_VERSION%

REM Build the selected package type(s)
if %BUILD_ALL%==1 (
    echo Building both portable and installer versions...
    
    echo 1. Building portable executable...
    call npx electron-builder --win portable --config.asar=false --publish never
    if errorlevel 1 (
        echo Error building portable executable.
        pause
        exit /b 1
    )
    
    echo 2. Building installer (NSIS)...
    call npx electron-builder --win nsis --config.asar=false --publish never
    if errorlevel 1 (
        echo Error building NSIS installer.
        pause
        exit /b 1
    )
    
) else (
    echo Building %BUILD_TYPE% version...
    call npx electron-builder --win %BUILD_TYPE% --config.asar=false --publish never
    if errorlevel 1 (
        echo Error building %BUILD_TYPE% version.
        pause
        exit /b 1
    )
)

echo.
echo =================================================
echo Build completed successfully!
echo =================================================
echo.

REM Copy outputs to a more accessible location
if not exist "releases" mkdir releases

if %BUILD_ALL%==1 (
    echo Copying build artifacts to releases folder...
    copy "dist\*.exe" "releases\" >nul 2>&1
    echo Portable EXE: releases\Reliability Metrics Map-%APP_VERSION%.exe
    echo Installer: releases\Reliability Metrics Map Setup %APP_VERSION%.exe
) else (
    if "%BUILD_TYPE%"=="portable" (
        copy "dist\Reliability Metrics Map-%APP_VERSION%.exe" "releases\" >nul 2>&1
        echo Portable EXE: releases\Reliability Metrics Map-%APP_VERSION%.exe
    ) else if "%BUILD_TYPE%"=="nsis" (
        copy "dist\Reliability Metrics Map Setup %APP_VERSION%.exe" "releases\" >nul 2>&1
        echo Installer: releases\Reliability Metrics Map Setup %APP_VERSION%.exe
    )
)

echo.
echo Usage examples:
if "%BUILD_TYPE%"=="portable" (
    echo - Run the portable version directly: releases\Reliability Metrics Map-%APP_VERSION%.exe
) else if "%BUILD_TYPE%"=="nsis" (
    echo - Run the installer: releases\Reliability Metrics Map Setup %APP_VERSION%.exe
) else if %BUILD_ALL%==1 (
    echo - Run the portable version directly: releases\Reliability Metrics Map-%APP_VERSION%.exe
    echo - Run the installer: releases\Reliability Metrics Map Setup %APP_VERSION%.exe
)

echo.
pause
endlocal
