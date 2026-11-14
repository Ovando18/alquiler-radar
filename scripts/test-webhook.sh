#!/usr/bin/env bash
# Simula um webhook Hotmart v2.0.  Uso:
#   HOTTOK=xxx ./scripts/test-webhook.sh http://localhost:3000 PURCHASE_APPROVED cliente@exemplo.com
set -euo pipefail
BASE="${1:-http://localhost:3000}"; EVENT="${2:-PURCHASE_APPROVED}"; EMAIL="${3:-teste@exemplo.com}"
curl -sS -X POST "$BASE/api/webhooks/hotmart" \
  -H "Content-Type: application/json" \
  -H "X-Hotmart-Hottok: ${HOTTOK:?defina HOTTOK}" \
  -d @- <<JSON
{
  "id": "$(date +%s)",
  "creation_date": $(date +%s)000,
  "event": "$EVENT",
  "version": "2.0.0",
  "data": {
    "product": { "id": 1234567, "name": "AlquilerRadar España" },
    "buyer": { "email": "$EMAIL", "name": "Cliente Teste" },
    "purchase": { "transaction": "HP$(date +%s)", "status": "APPROVED", "offer": { "code": "MENSAL" } },
    "subscription": { "status": "ACTIVE", "plan": { "name": "Plano Mensal" } }
  }
}
JSON
echo
