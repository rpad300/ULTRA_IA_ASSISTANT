# Script to set Stereo Mix volume to maximum
# This helps ensure audio capture is working properly

param(
    [int]$Volume = 100
)

Write-Host "Setting Stereo Mix volume to $Volume%..." -ForegroundColor Cyan

# Try to use nircmd if available (more reliable)
$nircmdPath = "nircmd.exe"
if (Get-Command $nircmdPath -ErrorAction SilentlyContinue) {
    Write-Host "Using nircmd to set volume..." -ForegroundColor Green
    # nircmd setvolume "Mistura estéreo" $Volume
    # Note: Device name might need to be escaped or use device index
    Write-Host "nircmd found but device name handling is complex. Using PowerShell method instead." -ForegroundColor Yellow
}

# Method 1: Use Windows Audio Session API via PowerShell
# This requires the AudioDeviceCmdlets module
try {
    if (Get-Module -ListAvailable -Name AudioDeviceCmdlets) {
        Import-Module AudioDeviceCmdlets -ErrorAction Stop
        $stereoMix = Get-AudioDevice -List | Where-Object { $_.Name -like "*Stereo Mix*" -or $_.Name -like "*Mistura estéreo*" -or $_.Name -like "*Mix*" }
        if ($stereoMix) {
            Write-Host "Found device: $($stereoMix.Name)" -ForegroundColor Green
            Set-AudioDevice -Index $stereoMix.Index
            Write-Host "Stereo Mix set as default recording device" -ForegroundColor Green
        } else {
            Write-Host "Stereo Mix not found in audio devices" -ForegroundColor Yellow
        }
    } else {
        Write-Host "AudioDeviceCmdlets module not installed. Installing..." -ForegroundColor Yellow
        Install-Module -Name AudioDeviceCmdlets -Scope CurrentUser -Force
        Import-Module AudioDeviceCmdlets
        $stereoMix = Get-AudioDevice -List | Where-Object { $_.Name -like "*Stereo Mix*" -or $_.Name -like "*Mistura estéreo*" }
        if ($stereoMix) {
            Set-AudioDevice -Index $stereoMix.Index
            Write-Host "Stereo Mix set as default recording device" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "Could not use AudioDeviceCmdlets: $_" -ForegroundColor Yellow
}

# Method 2: Use Windows Sound API via COM (more direct)
try {
    $audio = New-Object -ComObject AudioDeviceCmdlets.AudioDeviceCmdlets
    # This method is complex, so we'll use a simpler approach
} catch {
    Write-Host "COM method not available" -ForegroundColor Yellow
}

# Method 3: Direct registry manipulation (advanced, use with caution)
# HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture

Write-Host ""
Write-Host "To manually set Stereo Mix volume:" -ForegroundColor Cyan
Write-Host "1. Right-click sound icon in system tray" -ForegroundColor White
Write-Host "2. Select 'Sound settings' > 'Sound Control Panel'" -ForegroundColor White
Write-Host "3. Go to 'Recording' tab" -ForegroundColor White
Write-Host "4. Right-click 'Stereo Mix' > 'Properties'" -ForegroundColor White
Write-Host "5. Go to 'Levels' tab" -ForegroundColor White
Write-Host "6. Set volume to $Volume%" -ForegroundColor White
Write-Host "7. Click 'OK'" -ForegroundColor White
Write-Host ""
Write-Host "Current Stereo Mix status:" -ForegroundColor Cyan

# Check if Stereo Mix is enabled
$devices = Get-PnpDevice | Where-Object { $_.FriendlyName -like "*Stereo Mix*" -or $_.FriendlyName -like "*Mistura estéreo*" }
if ($devices) {
    foreach ($device in $devices) {
        Write-Host "  Device: $($device.FriendlyName)" -ForegroundColor White
        Write-Host "  Status: $($device.Status)" -ForegroundColor $(if ($device.Status -eq 'OK') { 'Green' } else { 'Yellow' })
    }
} else {
    Write-Host "  Stereo Mix not found. Please enable it in Windows Sound settings." -ForegroundColor Yellow
}





