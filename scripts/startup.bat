@echo off
cd /d %~dp0..
call npx pm2 start ecosystem.config.cjs
call npx pm2 save
