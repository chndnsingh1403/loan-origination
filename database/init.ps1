# Database initialization script for Windows
# PowerShell version of init.sh

param(
    [string]$DbHost = $env:POSTGRES_HOST ?? "localhost",
    [string]$DbPort = $env:POSTGRES_PORT ?? "5432", 
    [string]$DbName = $env:POSTGRES_DB ?? "originate",
    [string]$DbUser = $env:POSTGRES_USER ?? "postgres",
    [string]$DbPassword = $env:POSTGRES_PASSWORD ?? "postgres"
)

Write-Host "🚀 Initializing Originate Lite Database..." -ForegroundColor Green
Write-Host "📡 Connecting to: $DbHost`:$DbPort/$DbName" -ForegroundColor Blue

# Set password environment variable for psql
$env:PGPASSWORD = $DbPassword

try {
    Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
    
    # Wait for PostgreSQL (simple retry loop)
    $retries = 30
    $connected = $false
    
    for ($i = 0; $i -lt $retries; $i++) {
        try {
            psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -c "SELECT 1;" | Out-Null
            $connected = $true
            break
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }
    
    if (-not $connected) {
        throw "Could not connect to PostgreSQL after $retries attempts"
    }
    
    Write-Host "✅ PostgreSQL is ready!" -ForegroundColor Green
    
    # Run the schema
    Write-Host "📋 Creating database schema..." -ForegroundColor Blue
    psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f "schema.sql"
    
    Write-Host "🎉 Database initialized successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Demo credentials:" -ForegroundColor Cyan
    Write-Host "  Admin: admin@demo.com / demo123" -ForegroundColor White
    Write-Host "  Tenant Admin: tenant@demo.com / demo123" -ForegroundColor White  
    Write-Host "  Broker: broker@demo.com / demo123" -ForegroundColor White
    Write-Host "  Underwriter: underwriter@demo.com / demo123" -ForegroundColor White
}
catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}