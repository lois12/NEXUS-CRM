@echo off
chcp 65001 >nul
title NEXUS - finish pending changes
cd /d "G:\CRT THE NEXUS CRM"

echo [1/3] Проверка типов клиента...
cd client
call npx tsc --noEmit
if errorlevel 1 (
  echo.
  echo TSC_FAILED - в коде есть ошибки типов, ничего не коммичу.
  pause
  exit /b 1
)
cd ..

echo [2/3] Коммит...
git add client/src/pages/Registrations.tsx client/src/components/surveys/SurveyCard.tsx client/src/pages/Quizzes.tsx client/src/components/surveys/SurveyPreviewModal.tsx
git commit -m "fix: icon centering on cards + unified preview modal shell across reg/quizzes/surveys"

echo [3/3] Push...
git push

echo.
echo Готово. Проверь вывод выше: должен быть PUSH_OK / main -> main
pause
