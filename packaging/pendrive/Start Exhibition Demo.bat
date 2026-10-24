@echo off
rem Starts the exhibition demo full screen. Press Esc (or the Exit demo button) to leave the demo, Ctrl+Q to quit.
cd /d "%~dp0Sinor Marine Simulator"
start "" "Sinor Marine Simulator.exe" --demo --no-intro
