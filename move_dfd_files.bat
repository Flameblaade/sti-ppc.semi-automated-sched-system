@echo off
REM Script to move DFD PNG files from Downloads to C:\Users\Flameblade\Downloads\dfd

set "SOURCE=C:\Users\Flameblade\Downloads"
set "DEST=C:\Users\Flameblade\Downloads\dfd"

echo ========================================
echo DFD Files Mover
echo ========================================
echo.

REM Create destination folder if it doesn't exist
if not exist "%DEST%" (
    echo Creating folder: %DEST%
    mkdir "%DEST%"
    if errorlevel 1 (
        echo ERROR: Could not create folder!
        pause
        exit /b 1
    )
    echo Folder created successfully.
) else (
    echo Destination folder already exists: %DEST%
)
echo.

echo Checking for DFD files in: %SOURCE%
echo.

set "MOVED_COUNT=0"

REM Move each DFD file if it exists
if exist "%SOURCE%\Context_Diagram.png" (
    move "%SOURCE%\Context_Diagram.png" "%DEST%\"
    if errorlevel 1 (
        echo ERROR moving Context_Diagram.png
    ) else (
        echo [OK] Moved: Context_Diagram.png
        set /a MOVED_COUNT+=1
    )
) else (
    echo [SKIP] Context_Diagram.png not found
)

if exist "%SOURCE%\DFD_Superadmin.png" (
    move "%SOURCE%\DFD_Superadmin.png" "%DEST%\"
    if errorlevel 1 (
        echo ERROR moving DFD_Superadmin.png
    ) else (
        echo [OK] Moved: DFD_Superadmin.png
        set /a MOVED_COUNT+=1
    )
) else (
    echo [SKIP] DFD_Superadmin.png not found
)

if exist "%SOURCE%\DFD_User.png" (
    move "%SOURCE%\DFD_User.png" "%DEST%\"
    if errorlevel 1 (
        echo ERROR moving DFD_User.png
    ) else (
        echo [OK] Moved: DFD_User.png
        set /a MOVED_COUNT+=1
    )
) else (
    echo [SKIP] DFD_User.png not found
)

if exist "%SOURCE%\DFD_Superadmin_Users.png" (
    move "%SOURCE%\DFD_Superadmin_Users.png" "%DEST%\"
    if errorlevel 1 (
        echo ERROR moving DFD_Superadmin_Users.png
    ) else (
        echo [OK] Moved: DFD_Superadmin_Users.png
        set /a MOVED_COUNT+=1
    )
) else (
    echo [SKIP] DFD_Superadmin_Users.png not found
)

if exist "%SOURCE%\DFD_Superadmin_Schedules.png" (
    move "%SOURCE%\DFD_Superadmin_Schedules.png" "%DEST%\"
    if errorlevel 1 (
        echo ERROR moving DFD_Superadmin_Schedules.png
    ) else (
        echo [OK] Moved: DFD_Superadmin_Schedules.png
        set /a MOVED_COUNT+=1
    )
) else (
    echo [SKIP] DFD_Superadmin_Schedules.png not found
)

if exist "%SOURCE%\DFD_Superadmin_Approve.png" (
    move "%SOURCE%\DFD_Superadmin_Approve.png" "%DEST%\"
    if errorlevel 1 (
        echo ERROR moving DFD_Superadmin_Approve.png
    ) else (
        echo [OK] Moved: DFD_Superadmin_Approve.png
        set /a MOVED_COUNT+=1
    )
) else (
    echo [SKIP] DFD_Superadmin_Approve.png not found
)

echo.
echo ========================================
echo Summary: Moved %MOVED_COUNT% file(s) to %DEST%
echo ========================================
echo.
echo Opening destination folder...
start "" "%DEST%"
echo.
pause

