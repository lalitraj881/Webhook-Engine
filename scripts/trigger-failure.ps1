param(
    [string]$TenantId = "REPLACE_WITH_TENANT_B_ID",
    [string]$BaseUrl = "http://localhost:3000"
)

# ============================================
# Send a webhook that triggers an action that will FAIL (PowerShell)
# Use Tenant B (Beta Store) which has a rule pointing to httpbin.org/status/500
# Usage: .\scripts\trigger-failure.ps1 -TenantId <TENANT_B_ID>
# ============================================

$EventId = "evt_fail_$([int][double]::Parse((Get-Date -UFormat '%s')))_$(Get-Random -Maximum 1000)"

Write-Host "Sending webhook that will trigger a FAILING action..." -ForegroundColor Magenta
Write-Host "   Tenant: $TenantId (Beta Store)"
Write-Host "   Event ID: $EventId"
Write-Host "   This tenant has a rule pointing to httpbin.org/status/500"
Write-Host ""

$Payload = @{
    eventType = "order.created"
    id = $EventId
    order = @{
        total_price = 50
        currency = "USD"
    }
} | ConvertTo-Json -Depth 5

$Headers = @{
    "Content-Type" = "application/json"
    "X-Webhook-Id" = $EventId
}

$Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $Response = Invoke-RestMethod -Uri "$BaseUrl/webhooks/$TenantId/shopify" `
                                  -Method Post `
                                  -Headers $Headers `
                                  -Body $Payload
    
    $Stopwatch.Stop()
    
    Write-Host ""
    Write-Host "Response time: $($Stopwatch.Elapsed.TotalSeconds)s" -ForegroundColor Yellow
    Write-Host ""
    $Response | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    $Stopwatch.Stop()
    Write-Host ""
    Write-Host "Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message
    }
}

Write-Host ""
Write-Host "Wait for the job to fail after 3 retry attempts..." -ForegroundColor Cyan
Write-Host "Then go to the Jobs tab in the UI to see the failure."
Write-Host "Click 'View Details' to see error info and use the 'Replay' button."
