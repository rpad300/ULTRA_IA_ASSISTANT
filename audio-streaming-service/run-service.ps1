# Script to run Audio Streaming Service in development mode
# This script is called from ultra_start.bat to avoid escape character issues

# Update PATH to include .NET
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')

# Change to service directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Run dotnet
dotnet run




