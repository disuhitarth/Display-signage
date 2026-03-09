function getPs1Template(baseURL, storeID) {
  return `<#
╔══════════════════════════════════════════════════════════════════╗
║  Pizza Depot Digital Signage — Store Launcher                    ║
║  Auto-detects monitors, launches Chrome kiosk on each screen     ║
║  Runs silently on Windows startup — zero store staff interaction  ║
╚══════════════════════════════════════════════════════════════════╝
#>

# ─── CONFIGURATION ──────────────────────────────────────────────────
# Auto-generated setup for ${storeID}

$CONFIG = @{
    # Your signage server base URL (where the web app is hosted)
    BaseURL       = "${baseURL}"
    
    # Store ID — unique per location (matches your admin dashboard)
    StoreID       = "${storeID}"
    
    # Chrome executable path (auto-detected if not set)
    ChromePath    = ""
    
    # Seconds to wait after boot before launching (lets Windows settle)
    StartupDelay  = 15
    
    # Seconds to wait between launching each Chrome window
    WindowDelay   = 3
    
    # Kill existing Chrome instances on launch? (recommended: true)
    KillExisting  = $true
    
    # Log file location
    LogFile       = "$env:USERPROFILE\\PizzaSignage\\signage-log.txt"
    
    # Config file (saved after first run for persistence)
    ConfigFile    = "$env:USERPROFILE\\PizzaSignage\\config.json"
}

# ─── LOGGING ────────────────────────────────────────────────────────
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Ensure log directory exists
    $logDir = Split-Path $CONFIG.LogFile -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    Add-Content -Path $CONFIG.LogFile -Value $logEntry -ErrorAction SilentlyContinue
    Write-Host $logEntry -ForegroundColor $(
        switch ($Level) {
            "ERROR" { "Red" }
            "WARN"  { "Yellow" }
            "OK"    { "Green" }
            default { "Cyan" }
        }
    )
}

# ─── FIND CHROME ────────────────────────────────────────────────────
function Find-Chrome {
    # Check configured path first
    if ($CONFIG.ChromePath -and (Test-Path $CONFIG.ChromePath)) {
        return $CONFIG.ChromePath
    }
    
    # Common Chrome install locations
    $paths = @(
        "$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe",
        "\${env:ProgramFiles(x86)}\\Google\\Chrome\\Application\\chrome.exe",
        "$env:LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe"
    )
    
    foreach ($path in $paths) {
        if (Test-Path $path) {
            Write-Log "Found Chrome at: $path" "OK"
            return $path
        }
    }
    
    # Try Edge as fallback
    $edgePath = "$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe"
    if (Test-Path $edgePath) {
        Write-Log "Chrome not found, using Microsoft Edge as fallback" "WARN"
        return $edgePath
    }
    
    Write-Log "No compatible browser found!" "ERROR"
    return $null
}

# ─── DETECT MONITORS ───────────────────────────────────────────────
function Get-MonitorInfo {
    Write-Log "Detecting connected monitors..."
    
    Add-Type -AssemblyName System.Windows.Forms
    $screens = [System.Windows.Forms.Screen]::AllScreens
    
    $monitors = @()
    $index = 0
    foreach ($screen in $screens) {
        $index++
        $bounds = $screen.Bounds
        $monitor = @{
            Index     = $index
            Name      = $screen.DeviceName
            IsPrimary = $screen.Primary
            X         = $bounds.X
            Y         = $bounds.Y
            Width     = $bounds.Width
            Height    = $bounds.Height
        }
        $monitors += $monitor
        Write-Log "  Monitor $index: $($bounds.Width)x$($bounds.Height) at ($($bounds.X),$($bounds.Y)) $(if($screen.Primary){'[PRIMARY]'})" "OK"
    }
    
    Write-Log "Total monitors detected: $($monitors.Count)"
    return $monitors
}

# ─── KILL EXISTING CHROME ──────────────────────────────────────────
function Stop-ExistingChrome {
    if (-not $CONFIG.KillExisting) { return }
    
    Write-Log "Closing existing Chrome instances..."
    $chromeProcesses = Get-Process -Name "chrome" -ErrorAction SilentlyContinue
    if ($chromeProcesses) {
        $chromeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Log "Closed $($chromeProcesses.Count) Chrome processes" "OK"
    } else {
        Write-Log "No existing Chrome processes found"
    }
}

# ─── DISABLE SCREEN SAVER & SLEEP ──────────────────────────────────
function Set-AlwaysOn {
    Write-Log "Disabling screen saver and sleep..."
    
    # Disable screen saver
    Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "ScreenSaveActive" -Value "0" -ErrorAction SilentlyContinue
    
    # Set power plan to never sleep (display and system)
    powercfg /change monitor-timeout-ac 0
    powercfg /change standby-timeout-ac 0
    powercfg /change hibernate-timeout-ac 0
    
    Write-Log "Power settings configured — screens will stay on" "OK"
}

# ─── HIDE CURSOR ────────────────────────────────────────────────────
function Hide-Cursor {
    # Move cursor to bottom-right corner so it's not visible on any TV
    Add-Type -AssemblyName System.Windows.Forms
    $totalWidth = 0
    $totalHeight = 0
    foreach ($screen in [System.Windows.Forms.Screen]::AllScreens) {
        $right = $screen.Bounds.X + $screen.Bounds.Width
        $bottom = $screen.Bounds.Y + $screen.Bounds.Height
        if ($right -gt $totalWidth) { $totalWidth = $right }
        if ($bottom -gt $totalHeight) { $totalHeight = $bottom }
    }
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($totalWidth, $totalHeight)
    Write-Log "Cursor hidden at ($totalWidth, $totalHeight)"
}

# ─── LAUNCH CHROME KIOSK WINDOWS ───────────────────────────────────
function Start-SignageDisplays {
    param(
        [string]$ChromePath,
        [array]$Monitors
    )
    
    $screenCount = $Monitors.Count
    Write-Log "Launching signage on $screenCount screen(s)..."
    
    # Create a unique Chrome user data dir to avoid profile conflicts
    $userDataDir = "$env:USERPROFILE\\PizzaSignage\\ChromeData"
    if (-not (Test-Path $userDataDir)) {
        New-Item -ItemType Directory -Path $userDataDir -Force | Out-Null
    }
    
    $screenNum = 0
    foreach ($monitor in $Monitors) {
        $screenNum++
        
        # Build the display URL for this screen
        $displayURL = "$($CONFIG.BaseURL)/display/$($CONFIG.StoreID)/screen/$screenNum"
        
        # Each screen gets its own Chrome profile to allow independent windows
        $profileDir = "$userDataDir\\Screen$screenNum"
        
        # Chrome flags for kiosk mode
        $chromeArgs = @(
            "--kiosk"                                    # Fullscreen kiosk mode
            "--no-first-run"                             # Skip first-run wizard
            "--disable-infobars"                         # No info bars
            "--disable-session-crashed-bubble"            # No crash recovery popup
            "--disable-features=TranslateUI"              # No translate bar
            "--disable-background-networking"              # Reduce background activity
            "--disable-sync"                              # No Chrome sync
            "--disable-extensions"                         # No extensions
            "--noerrdialogs"                              # No error dialogs
            "--disable-popup-blocking"                     # Allow popups if needed
            "--autoplay-policy=no-user-gesture-required"  # Allow video autoplay
            "--user-data-dir=\`"$profileDir\`""             # Separate profile per screen
            "--window-position=$($monitor.X),$($monitor.Y)"  # Position on correct monitor
            "--window-size=$($monitor.Width),$($monitor.Height)"  # Match monitor resolution
            "--start-fullscreen"                           # Start fullscreen
            "\`"$displayURL\`""                             # The URL to display
        )
        
        $argString = $chromeArgs -join " "
        
        Write-Log "  Screen $screenNum → $displayURL"
        Write-Log "    Position: ($($monitor.X),$($monitor.Y)) Size: $($monitor.Width)x$($monitor.Height)"
        
        Start-Process -FilePath $ChromePath -ArgumentList $argString
        
        # Small delay between launches to let Windows handle window placement
        Start-Sleep -Seconds $CONFIG.WindowDelay
    }
    
    Write-Log "All $screenNum display(s) launched successfully!" "OK"
}

# ─── SAVE RUNTIME CONFIG ───────────────────────────────────────────
function Save-RuntimeConfig {
    param([array]$Monitors)
    
    $runtimeConfig = @{
        StoreID       = $CONFIG.StoreID
        BaseURL       = $CONFIG.BaseURL
        ScreenCount   = $Monitors.Count
        LastLaunch    = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        Monitors      = $Monitors
    }
    
    $configDir = Split-Path $CONFIG.ConfigFile -Parent
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    
    $runtimeConfig | ConvertTo-Json -Depth 3 | Set-Content -Path $CONFIG.ConfigFile
    Write-Log "Runtime config saved to $($CONFIG.ConfigFile)"
}

# ─── WATCHDOG (restart Chrome if it crashes) ───────────────────────
function Start-Watchdog {
    Write-Log "Starting watchdog (checks every 60s if Chrome is still running)..."
    
    while ($true) {
        Start-Sleep -Seconds 60
        
        $chromeRunning = Get-Process -Name "chrome" -ErrorAction SilentlyContinue
        if (-not $chromeRunning) {
            Write-Log "Chrome crashed or was closed! Restarting displays..." "WARN"
            
            # Re-detect monitors (in case config changed)
            $monitors = Get-MonitorInfo
            $chromePath = Find-Chrome
            
            if ($chromePath -and $monitors.Count -gt 0) {
                Start-SignageDisplays -ChromePath $chromePath -Monitors $monitors
                Hide-Cursor
            }
        }
    }
}

# ─── INSTALL TO STARTUP ────────────────────────────────────────────
function Install-ToStartup {
    $scriptPath = $MyInvocation.ScriptName
    if (-not $scriptPath) {
        $scriptPath = $PSCommandPath
    }
    
    # Method 1: Startup folder shortcut
    $startupFolder = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
    $shortcutPath = "$startupFolder\\PizzaDepotSignage.lnk"
    
    $WshShell = New-Object -ComObject WScript.Shell
    $shortcut = $WshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "powershell.exe"
    $shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$scriptPath\`""
    $shortcut.WorkingDirectory = Split-Path $scriptPath -Parent
    $shortcut.Description = "Pizza Depot Digital Signage Launcher"
    $shortcut.WindowStyle = 7  # Minimized
    $shortcut.Save()
    
    Write-Log "Startup shortcut created at: $shortcutPath" "OK"
    
    # Method 2: Also create a scheduled task (more reliable)
    $taskName = "PizzaDepotSignage"
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
    
    $action = New-ScheduledTaskAction \`
        -Execute "powershell.exe" \`
        -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$scriptPath\`""
    
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet \`
        -AllowStartIfOnBatteries \`
        -DontStopIfGoingOnBatteries \`
        -StartWhenAvailable \`
        -RestartCount 3 \`
        -RestartInterval (New-TimeSpan -Minutes 1)
    
    Register-ScheduledTask \`
        -TaskName $taskName \`
        -Action $action \`
        -Trigger $trigger \`
        -Settings $settings \`
        -Description "Launches Pizza Depot digital signage displays on all connected monitors" \`
        -ErrorAction SilentlyContinue
    
    Write-Log "Scheduled task '$taskName' registered for auto-start at logon" "OK"
    
    Write-Log "═══════════════════════════════════════════════════" "OK"
    Write-Log "  INSTALLATION COMPLETE!" "OK"
    Write-Log "  Signage will auto-start on next login." "OK"
    Write-Log "  To uninstall, run: .\\LaunchSignage.ps1 -Uninstall" "OK"
    Write-Log "═══════════════════════════════════════════════════" "OK"
}

# ─── UNINSTALL ──────────────────────────────────────────────────────
function Uninstall-Signage {
    Write-Log "Uninstalling Pizza Depot Signage..."
    
    # Remove startup shortcut
    $shortcutPath = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\PizzaDepotSignage.lnk"
    if (Test-Path $shortcutPath) {
        Remove-Item $shortcutPath -Force
        Write-Log "Removed startup shortcut" "OK"
    }
    
    # Remove scheduled task
    $existingTask = Get-ScheduledTask -TaskName "PizzaDepotSignage" -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName "PizzaDepotSignage" -Confirm:$false
        Write-Log "Removed scheduled task" "OK"
    }
    
    Write-Log "Uninstall complete. Signage data preserved in $env:USERPROFILE\\PizzaSignage" "OK"
}

# ─── MAIN ENTRY POINT ──────────────────────────────────────────────
param(
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$NoWatchdog
)

# Header
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor DarkRed
Write-Host "  ║  🍕 Pizza Depot Digital Signage Launcher     ║" -ForegroundColor DarkRed
Write-Host "  ║     Franchise Display Management System      ║" -ForegroundColor DarkRed
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor DarkRed
Write-Host ""

Write-Log "═══════════════ SIGNAGE LAUNCHER START ═══════════════"

# Handle install/uninstall flags
if ($Uninstall) {
    Uninstall-Signage
    exit 0
}

if ($Install) {
    Install-ToStartup
    exit 0
}

# Startup delay (gives Windows time to initialize displays)
if ($CONFIG.StartupDelay -gt 0) {
    Write-Log "Waiting $($CONFIG.StartupDelay)s for system startup to settle..."
    Start-Sleep -Seconds $CONFIG.StartupDelay
}

# Step 1: Find browser
$chromePath = Find-Chrome
if (-not $chromePath) {
    Write-Log "FATAL: No browser found. Install Chrome and try again." "ERROR"
    exit 1
}

# Step 2: Detect monitors
$monitors = Get-MonitorInfo
if ($monitors.Count -eq 0) {
    Write-Log "FATAL: No monitors detected!" "ERROR"
    exit 1
}

# Step 3: Configure power settings
Set-AlwaysOn

# Step 4: Kill existing Chrome
Stop-ExistingChrome

# Step 5: Launch displays
Start-SignageDisplays -ChromePath $chromePath -Monitors $monitors

# Step 6: Hide cursor
Start-Sleep -Seconds 2
Hide-Cursor

# Step 7: Save runtime config
Save-RuntimeConfig -Monitors $monitors

Write-Log "═══════════════ ALL DISPLAYS RUNNING ═══════════════" "OK"

# Step 8: Start watchdog (keeps Chrome alive)
if (-not $NoWatchdog) {
    Start-Watchdog
}
`;
}

function getBatTemplate() {
  return `@echo off
title Pizza Depot Signage - Application Setup
color 0C

echo.
echo Installing Pizza Depot Digital Signage...
if not exist "%USERPROFILE%\\PizzaSignage" mkdir "%USERPROFILE%\\PizzaSignage"
copy /Y "%~dp0LaunchSignage.ps1" "%USERPROFILE%\\PizzaSignage\\LaunchSignage.ps1" >nul
powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\\PizzaSignage\\LaunchSignage.ps1" -Install

echo.
echo  ✅ SETUP COMPLETE! Starting displays...
start /min powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%USERPROFILE%\\PizzaSignage\\LaunchSignage.ps1" -NoWatchdog
pause`;
}

module.exports = { getPs1Template, getBatTemplate };
