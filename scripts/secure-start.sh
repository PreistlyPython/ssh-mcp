#!/bin/bash
# Secure SSH-MCP startup script that reads credentials from gopass

# Check if gopass is available and initialized
if ! command -v gopass &> /dev/null; then
    echo "Warning: gopass is not installed. Using environment variables."
elif ! gopass ls &> /dev/null; then
    echo "Warning: gopass is not initialized. Using environment variables."
fi

# Read OptinAmpOut credentials from gopass
export OPTINAMPOUT_HOST=$(gopass show -o ssh/optinamp/host 2>/dev/null || echo "fr3.fcomet.com")
export OPTINAMPOUT_PORT=$(gopass show -o ssh/optinamp/port 2>/dev/null || echo "17177")
export OPTINAMPOUT_USERNAME=$(gopass show -o ssh/optinamp/username 2>/dev/null || echo "optinamp")
export OPTINAMPOUT_PASSWORD=$(gopass show -o ssh/optinamp/password 2>/dev/null)
export OPTINAMPOUT_PASSPHRASE=$(gopass show -o ssh/optinamp/passphrase 2>/dev/null)
export OPTINAMPOUT_DEFAULT_DIR=$(gopass show -o ssh/optinamp/defaultdir 2>/dev/null || echo "/home/optinamp/public_html/")
export OPTINAMPOUT_DESCRIPTION="OptinAmpOut Production Server"

# Read JoeDreamz credentials from gopass
export JOEDREAMZ_HOST=$(gopass show -o ssh/joedreamz/host 2>/dev/null || echo "joedreamz.com")
export JOEDREAMZ_PORT=$(gopass show -o ssh/joedreamz/port 2>/dev/null || echo "22")
export JOEDREAMZ_USERNAME=$(gopass show -o ssh/joedreamz/username 2>/dev/null || echo "wajk74lwk7tp")
export JOEDREAMZ_PASSWORD=$(gopass show -o ssh/joedreamz/password 2>/dev/null)
export JOEDREAMZ_DEFAULT_DIR=$(gopass show -o ssh/joedreamz/defaultdir 2>/dev/null || echo "~/public_html/joedreamz.com/wp-content/themes/twentytwentyfour/homepage")
export JOEDREAMZ_DESCRIPTION="JoeDreamz WordPress Production Server"

# Read encryption keys from gopass or environment
export SSH_MCP_ENCRYPTION_KEY=${SSH_MCP_ENCRYPTION_KEY:-$(gopass show -o ssh-mcp/encryption_key 2>/dev/null || echo "")}
export SSH_MCP_JWT_SECRET=${SSH_MCP_JWT_SECRET:-$(gopass show -o ssh-mcp/jwt_secret 2>/dev/null || echo "")}

# If encryption keys don't exist in gopass, generate and store them
if [ -z "$SSH_MCP_ENCRYPTION_KEY" ]; then
    echo "Generating new encryption key..."
    SSH_MCP_ENCRYPTION_KEY=$(openssl rand -hex 32)
    echo "$SSH_MCP_ENCRYPTION_KEY" | gopass insert -f ssh-mcp/encryption_key
    export SSH_MCP_ENCRYPTION_KEY
fi

if [ -z "$SSH_MCP_JWT_SECRET" ]; then
    echo "Generating new JWT secret..."
    SSH_MCP_JWT_SECRET=$(openssl rand -hex 64)
    echo "$SSH_MCP_JWT_SECRET" | gopass insert -f ssh-mcp/jwt_secret
    export SSH_MCP_JWT_SECRET
fi

# Set other environment variables
export NODE_ENV="production"
export SSH_MCP_LOG_LEVEL="info"
export SSH_MCP_AUDIT_ENABLED="true"
export SSH_MCP_AUDIT_LOG_LEVEL="info"
export SSH_MCP_AUDIT_RETENTION_DAYS="2555"
export SSH_MCP_MFA_ENABLED="true"
export SSH_MCP_MFA_TOTP_ENABLED="true"
export SSH_MCP_COMPLIANCE_SOC2="true"
export SSH_MCP_COMPLIANCE_GDPR="true"
export SSH_MCP_COMPLIANCE_NIST="true"
export SSH_MCP_CIRCUIT_BREAKER_ENABLED="true"
export SSH_MCP_CREDENTIAL_ENCRYPTION="true"
export SSH_MCP_KEY_ROTATION_ENABLED="true"

# Example server configuration
export MY_SERVER_HOST="example.com"
export MY_SERVER_USERNAME="myuser"
export MY_SERVER_DEFAULT_DIR="/home/myuser"

# Start the SSH-MCP server
cd /home/dell/coding/mcp/ssh-mcp
exec node ./build/index.js