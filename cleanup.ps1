# Kill Node.js processes specific to this project
try {
    $projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -like "$projectPath*" -or $_.CommandLine -like "*$projectPath*"
    } | Stop-Process -Force -ErrorAction SilentlyContinue
}
catch {
    # Ignore any errors
}
exit 0