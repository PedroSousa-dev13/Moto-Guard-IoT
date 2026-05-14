@echo off
REM =========================================================================
REM MotoGuard IoT — Setup Rápido (Windows)
REM =========================================================================

echo.
echo === MotoGuard IoT — Setup ===
echo.

REM 1. .env
if not exist "app\.env" (
    if exist "app\.env.example" (
        copy "app\.env.example" "app\.env"
        echo [OK] .env criado a partir de .env.example
    )
) else (
    echo [SKIP] .env ja existe
)

REM 2. npm install
echo.
echo A instalar dependencias...
cd app
call npm install
if %errorlevel% neq 0 (
    echo [ERRO] npm install falhou
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas

REM 3. Prisma generate
echo.
echo A gerar Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo [ERRO] prisma generate falhou
    pause
    exit /b 1
)
echo [OK] Prisma client gerado

REM 4. Prisma migrate
echo.
echo A correr migrations...
call npx prisma migrate dev --name init 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Pode ser preciso criar a BD primeiro (docker-compose)
)

REM 5. Seed
echo.
echo A popular BD com dados iniciais...
call npx tsx prisma/seed.ts 2>nul
echo [OK] Seed concluido

cd ..
echo.
echo === Setup concluido! ===
echo.
echo Comandos:
echo   npm run dev       — backend com hot-reload
echo   npm run dev:watch — backend com watch
echo   npm test          — testes
echo.
echo Swagger UI: http://localhost:3000/api-docs
echo.
pause
