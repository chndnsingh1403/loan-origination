#!/bin/bash
# Database initialization script for Originate Lite

set -e

# Database connection parameters
DB_HOST=${POSTGRES_HOST:-localhost}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-originate}
DB_USER=${POSTGRES_USER:-postgres}
DB_PASSWORD=${POSTGRES_PASSWORD:-postgres}

echo "🚀 Initializing Originate Lite Database..."
echo "📡 Connecting to: $DB_HOST:$DB_PORT/$DB_NAME"

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
    sleep 2
done

echo "✅ PostgreSQL is ready!"

# Run the schema
echo "📋 Creating database schema..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f schema.sql

echo "🎉 Database initialized successfully!"
echo ""
echo "Demo credentials:"
echo "  Admin: admin@demo.com / demo123"
echo "  Tenant Admin: tenant@demo.com / demo123"
echo "  Broker: broker@demo.com / demo123"
echo "  Underwriter: underwriter@demo.com / demo123"