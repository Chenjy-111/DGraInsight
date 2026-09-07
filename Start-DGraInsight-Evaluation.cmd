@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
  echo Usage: Start-DGraInsight-Evaluation.cmd configs\evaluation_mtgnn.json outputs\mtgnn_evaluation.json
  echo Set DGRAINSIGHT_PYTHON to the Python executable with your model dependencies.
  exit /b 2
)
if not defined DGRAINSIGHT_PYTHON set "DGRAINSIGHT_PYTHON=python"
if "%~2"=="" (
  "%DGRAINSIGHT_PYTHON%" -m dgraudit evaluate --config "%~1"
) else (
  "%DGRAINSIGHT_PYTHON%" -m dgraudit evaluate --config "%~1" --output "%~2"
)
exit /b %errorlevel%
