@echo off
cd /d "%~dp0"
start cmd /k "python server.py"
start cmd /k "python -m http.server 8000"
start "" "http://127.0.0.1:8000"
