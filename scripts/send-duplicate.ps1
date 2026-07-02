param(
    [string]$TenantId = "REPLACE_WITH_TENANT_ID",
    [string]$BaseUrl = "http://localhost:3000"
)

# ============================================
# Send the same webhook twice to demonstrate deduplication (PowerShell)
# The second request should return "duplicate" status
# Usage: .\scripts\send-duplicate.ps1 -TenantId <TENANT_ID>
# ============================================

$EventId = "evt_duplicate_test_fixed_id_$([int][double]::Parse((Get-Date -UFormat '%s')))"

$Payload = @{
    eventType = "order.created"
    id = $EventId
    order = @{
        total_price = 750
        currency = "USD"
    }
} | ConvertTo-Json -Depth 5

$Headers = @{
    "Content-Type" = "application/json"
    "X-Webhook-Id" = $EventId
}

Write-Host "Sending webhook #1 (should process normally)..." -ForegroundColor Cyan

try {
    $Response1 = Invoke-RestMethod -Uri "$BaseUrl/webhooks/$TenantId/shopify" `
                                   -Method Post `
                                   -Headers $Headers `
                                   -Body $Payload
    $Response1 | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host ""
    Write-Host "Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "Waiting 1 second..." -ForegroundColor Yellow
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "Sending webhook #2 (SAME event ID - should be deduplicated)..." -ForegroundColor Cyan

try {
    $Response2 = Invoke-RestMethod -Uri "$BaseUrl/webhooks/$TenantId/shopify" `
                                   -Method Post `
                                   -Headers $Headers `
                                   -Body $Payload
    $Response2 | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host ""
    Write-Host "Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "The second response should show status: 'duplicate'" -ForegroundColor Green
Write-Host "The job should NOT be processed twice!" -ForegroundColor Green
