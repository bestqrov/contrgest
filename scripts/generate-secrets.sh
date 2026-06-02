#!/usr/bin/env bash
# Generate all required secrets for .env
echo "# Generated secrets — paste these into your .env"
echo ""
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 64)"
echo "INTERNAL_SERVICE_SECRET=$(openssl rand -hex 64)"
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)"
echo "WHATSAPP_WEBHOOK_SECRET=$(openssl rand -hex 32)"
echo "DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
