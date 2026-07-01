#!/bin/bash
# ============================================
# Send a webhook that triggers an action that will FAIL
# Use Tenant B (Beta Store) which has a rule pointing to httpbin.org/status/500
# Usage: ./scripts/trigger-failure.sh <TENANT_B_ID>
# ============================================

TENANT_ID=${1:-"REPLACE_WITH_TENANT_B_ID"}
BASE_URL=${2:-"http://localhost:3000"}
EVENT_ID="evt_fail_$(date +%s)_$(( RANDOM % 1000 ))"

echo "💥 Sending webhook that will trigger a FAILING action..."
echo "   Tenant: $TENANT_ID (Beta Store)"
echo "   Event ID: $EVENT_ID"
echo "   This tenant has a rule pointing to httpbin.org/status/500"
echo ""

curl -s -w "\n\n⏱  Response time: %{time_total}s\n" \
  -X POST "$BASE_URL/webhooks/$TENANT_ID/shopify" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Id: $EVENT_ID" \
  -d "{
    \"eventType\": \"order.created\",
    \"id\": \"$EVENT_ID\",
    \"order\": { \"total_price\": 50, \"currency\": \"USD\" }
  }" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "⏳ Wait for the job to fail after 3 retry attempts..."
echo "   Then go to the Jobs tab in the UI to see the failure."
echo "   Click 'View Details' to see error info and use the 'Replay' button."
