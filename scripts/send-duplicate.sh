#!/bin/bash
# ============================================
# Send the same webhook twice to demonstrate deduplication
# The second request should return "duplicate" status
# Usage: ./scripts/send-duplicate.sh <TENANT_ID>
# ============================================

TENANT_ID=${1:-"REPLACE_WITH_TENANT_ID"}
BASE_URL=${2:-"http://localhost:3000"}
EVENT_ID="evt_duplicate_test_fixed_id_$((RANDOM))"

PAYLOAD="{
    \"eventType\": \"order.created\",
    \"id\": \"$EVENT_ID\",
    \"order\": { \"total_price\": 750, \"currency\": \"USD\" }
  }"

echo "Sending webhook #1 (should process normally)..."
curl -s \
  -X POST "$BASE_URL/webhooks/$TENANT_ID/shopify" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Id: $EVENT_ID" \
  -d "$PAYLOAD" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "Waiting 1 second..."
sleep 1

echo ""
echo "Sending webhook #2 (SAME event ID — should be deduplicated)..."
curl -s \
  -X POST "$BASE_URL/webhooks/$TENANT_ID/shopify" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Id: $EVENT_ID" \
  -d "$PAYLOAD" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "The second response should show status: 'duplicate'"
echo "The job should NOT be processed twice!"
