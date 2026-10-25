@echo off
chcp 65001 >nul
setlocal
title Exclusive - Local Server
cd /d "%~dp0"
if errorlevel 1 goto directory_error

set "EXCLUSIVE_PORT=8000"
set "EXCLUSIVE_PYTHON="
py -3 -c "import http.server" >nul 2>&1
if not errorlevel 1 (
  set "EXCLUSIVE_PYTHON=py -3"
  goto start_server
)
python -c "import http.server" >nul 2>&1
if not errorlevel 1 (
  set "EXCLUSIVE_PYTHON=python"
  goto start_server
)

echo Не знайдено Python 3. Для запуску потрібен встановлений Python 3.
echo Після встановлення відкрийте цей файл повторно.
pause
exit /b 1

:start_server
echo.
echo Локальний сервер Exclusive
echo Відкрийте в браузері: http://127.0.0.1:%EXCLUSIVE_PORT%/
echo.
echo Залишайте це вікно відкритим, поки переглядаєте сайт.
echo Щоб зупинити сервер, закрийте це вікно або натисніть Ctrl+C.
echo Якщо змінювали файли, оновіть сторінку: Ctrl+F5.
echo.
%EXCLUSIVE_PYTHON% -u -m http.server %EXCLUSIVE_PORT% --bind 127.0.0.1
if not errorlevel 1 exit /b 0
echo.
echo Сервер не запущено або його зупинено.
echo Якщо порт 8000 зайнятий, закрийте попереднє вікно сервера.
pause
exit /b 1

:directory_error
echo Не вдалося відкрити папку проєкту.
pause
exit /b 1
