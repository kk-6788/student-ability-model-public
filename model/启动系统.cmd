@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if not errorlevel 1 goto run
if exist "%ProgramFiles%\nodejs\node.exe" (
  "%ProgramFiles%\nodejs\node.exe" "%~dp0server.cjs" %*
  goto done
)
echo 未找到 Node.js。请安装 Node.js LTS 后重试，或将便携版 node.exe 所在目录加入 PATH。
echo 本程序不会自动安装或修改系统设置。
goto done
:run
echo 请在浏览器打开 http://localhost:8765/
node "%~dp0server.cjs" %*
:done
pause

