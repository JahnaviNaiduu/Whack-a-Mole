@echo off
echo ========================================
echo Whack-a-Mole Neo4j Setup
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo.
    echo Please edit .env file and add your Neo4j credentials!
    echo.
) else (
    echo .env file already exists
    echo.
)

REM Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    echo.
) else (
    echo Dependencies already installed
    echo.
)

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Make sure Neo4j is running
echo 2. Edit .env file with your Neo4j credentials
echo 3. Run: npm start
echo 4. Open: http://localhost:3000
echo.
pause
