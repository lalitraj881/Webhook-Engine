param(
    [string]$TenantId = "REPLACE_WITH_TENANT_ID",
    [string]$BaseUrl = "http://localhost:3000"
)

# ============================================
# Send a test Shopify order webhook (PowerShell)
# Usage: .\scripts\send-webhook.ps1 -TenantId <TENANT_ID>
# ============================================

$EventId = "evt_$([int][double]::Parse((Get-Date -UFormat '%s')))_$(Get-Random -Maximum 1000)"

Write-Host "Sending Shopify order webhook..." -ForegroundColor Cyan
Write-Host "   Tenant: $TenantId"
Write-Host "   Event ID: $EventId"
Write-Host ""

$Payload = @{
    eventType = "order.created"
    id = $EventId
    order = @{
        id = "order_$EventId"
        total_price = 750.00
        currency = "USD"
        customer = @{
            name = "John Doe"
            email = "john@example.com"
        }
        items = @(
            @{ name = "Premium Widget"; quantity = 3; price = 250.00 }
        )
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
Write-Host "Check the dashboard to see the job processing!" -ForegroundColor Green
