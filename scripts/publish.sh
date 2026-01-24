#!/bin/bash
# Publish mcp-gov to npm

set -e  # Exit on error

echo "=========================================="
echo "Publishing mcp-gov"
echo "=========================================="
echo ""

# Pre-checks
echo "Step 1: Pre-checks..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "✗ Node.js not found"
    exit 1
fi
echo "✓ Node.js: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "✗ npm not found"
    exit 1
fi
echo "✓ npm: $(npm --version)"

# Check if logged in to npm
if ! npm whoami &> /dev/null; then
    echo "✗ Not logged in to npm"
    echo "  Run: npm login"
    exit 1
fi
NPM_USER=$(npm whoami)
echo "✓ npm user: $NPM_USER"

# Check for NPM_TOKEN (for 2FA bypass)
NPM_PUBLISH_READY=false
if [ -z "$NPM_TOKEN" ]; then
    if command -v pass &> /dev/null && pass show amr/npmjs_token &> /dev/null; then
        echo "✓ npm token found in pass"
        export NPM_TOKEN=$(pass show amr/npmjs_token | head -n1)
        NPM_PUBLISH_READY=true
    else
        echo "⚠ NPM_TOKEN not set - may need OTP for 2FA"
        echo "  To skip OTP: pass insert amr/npmjs_token"
    fi
else
    echo "✓ NPM_TOKEN is set"
    NPM_PUBLISH_READY=true
fi

# Set npm auth token if available
if [ "$NPM_PUBLISH_READY" = true ]; then
    npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN
fi

echo ""
echo "Step 2: Validating package..."

# Check package.json exists
if [ ! -f package.json ]; then
    echo "✗ package.json not found"
    exit 1
fi
echo "✓ package.json exists"

# Get version
PACKAGE_VERSION=$(node -p "require('./package.json').version")
PACKAGE_NAME=$(node -p "require('./package.json').name")
echo "✓ Package: $PACKAGE_NAME@$PACKAGE_VERSION"

# Check bin files exist
for bin in bin/mcp-gov-proxy.js bin/mcp-gov-wrap.js bin/mcp-gov-unwrap.js; do
    if [ ! -f "$bin" ]; then
        echo "✗ Missing: $bin"
        exit 1
    fi
done
echo "✓ All bin files exist"

# Run tests
echo ""
echo "Step 3: Running tests..."
if npm test; then
    echo "✓ Tests passed"
else
    echo "✗ Tests failed"
    exit 1
fi

# Check if version already published
echo ""
echo "Step 4: Publishing..."
if npm view $PACKAGE_NAME@$PACKAGE_VERSION version &>/dev/null; then
    echo "⚠ Version $PACKAGE_VERSION already exists on npm"
    echo "  Bump version: npm version patch (or minor/major)"
    exit 0
fi

# Publish
echo "Publishing $PACKAGE_NAME@$PACKAGE_VERSION to npm..."
if npm publish --access public; then
    NPM_STATUS="success"
else
    NPM_STATUS="failed"
fi

# Post-checks
echo ""
echo "Step 5: Post-checks..."
sleep 2  # Wait for registry to update

if npm view $PACKAGE_NAME@$PACKAGE_VERSION version &>/dev/null; then
    echo "✓ Package verified on npm registry"
else
    echo "⚠ Package not yet visible (may take a moment)"
fi

# Summary
echo ""
echo "=========================================="
echo "PUBLISHING SUMMARY"
echo "=========================================="
echo ""
echo "Package: $PACKAGE_NAME"
echo "Version: $PACKAGE_VERSION"
echo ""

if [ "$NPM_STATUS" = "success" ]; then
    echo "✓ npm: PUBLISHED"
    echo "  → https://www.npmjs.com/package/$PACKAGE_NAME"
    echo ""
    echo "Install with:"
    echo "  npm install -g $PACKAGE_NAME"
    echo "  npx mcp-gov-wrap"
else
    echo "✗ npm: FAILED"
    exit 1
fi

echo ""
echo "=========================================="
echo "✓ Publishing COMPLETED"
echo "=========================================="
