@echo off
chcp 65001 >nul
title Agente Tales - NATIVE WhatsApp
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependências...
  call npm install
)
if not exist .env (
  echo .env não encontrado. Copie .env.example para .env e preencha as chaves.
  pause
  exit /b 1
)
node server.js
pause
