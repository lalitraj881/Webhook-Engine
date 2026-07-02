#!/bin/bash
# ============================================
# Send a test Shopify order webhook
# Usage: ./scripts/send-webhook.sh <TENANT_ID>
# ============================================

TENANT_ID=${1:-"REPLACE_WITH_TENANT_ID"}
BASE_URL=${2:-"http://localhost:3000"}
EVENT_ID="evt_$(date +%s)_$(( RANDOM % 1000 ))"

echo "Sending Shopify order webhook..."
echo "   Tenant: $TENANT_ID"
echo "   Event ID: $EVENT_ID"
echo ""

curl -s -w "\n\nResponse time: %{time_total}s\n" \
  -X POST "$BASE_URL/webhooks/$TENANT_ID/shopify" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Id: $EVENT_ID" \
  -d "{
    \"eventType\": \"order.created\",
    \"id\": \"$EVENT_ID\",
    \"order\": {
      \"id\": \"order_$EVENT_ID\",
      \"total_price\": 750.00,
      \"currency\": \"USD\",
      \"customer\": {
        \"name\": \"John Doe\",
        \"email\": \"john@example.com\"
      },
      \"items\": [
        { \"name\": \"Premium Widget\", \"quantity\": 3, \"price\": 250.00 }
      ]
    }
  }" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "Check the dashboard to see the job processing!"
