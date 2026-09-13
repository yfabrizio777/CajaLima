# Use Compose's own dotenv parser; never evaluate .env as PowerShell code.
$ErrorActionPreference = 'Stop'
$previousSecret = [Environment]::GetEnvironmentVariable('JWT_SECRET', 'Process')
$previousExpiration = [Environment]::GetEnvironmentVariable('JWT_EXPIRATION', 'Process')
$exitCode = 1

Push-Location $PSScriptRoot
try {
    # Capture output: this command includes private values and must not be printed.
    $configuration = & docker compose config --environment 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudo leer la configuración local de Docker Compose. Revisa Docker y .env.'
    }
    $jwtVariables = @{}
    foreach ($line in $configuration) {
        if ($line -match '^(JWT_SECRET|JWT_EXPIRATION)=(.*)$') {
            $jwtVariables[$matches[1]] = $matches[2]
        }
    }
    $configuration = $null
    if ([string]::IsNullOrWhiteSpace($jwtVariables['JWT_SECRET']) -or
        [Text.Encoding]::UTF8.GetByteCount($jwtVariables['JWT_SECRET']) -lt 32) {
        throw 'Define JWT_SECRET con al menos 32 bytes aleatorios en .env o en el entorno.'
    }
    [long]$expiration = 0
    if (-not [long]::TryParse($jwtVariables['JWT_EXPIRATION'], [ref]$expiration) -or
        $expiration -lt 1000 -or $expiration -gt 86400000) {
        throw 'Define JWT_EXPIRATION entre 1000 y 86400000 milisegundos.'
    }
    [Environment]::SetEnvironmentVariable('JWT_SECRET', $jwtVariables['JWT_SECRET'], 'Process')
    [Environment]::SetEnvironmentVariable('JWT_EXPIRATION', $jwtVariables['JWT_EXPIRATION'], 'Process')
    Set-Location (Join-Path $PSScriptRoot 'backend')
    & mvn spring-boot:run
    $exitCode = $LASTEXITCODE
}
finally {
    [Environment]::SetEnvironmentVariable('JWT_SECRET', $previousSecret, 'Process')
    [Environment]::SetEnvironmentVariable('JWT_EXPIRATION', $previousExpiration, 'Process')
    $jwtVariables = $null
    Pop-Location
}
if ($exitCode -ne 0) { throw 'El backend terminó con un error. Revisa el registro local.' }
