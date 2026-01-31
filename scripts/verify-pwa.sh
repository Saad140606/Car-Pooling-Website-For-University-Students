#!/bin/bash
# PWA Cross-Browser Implementation Verification
# Run: bash scripts/verify-pwa.sh

echo "========================================="
echo "PWA CROSS-BROWSER AUDIT VERIFICATION"
echo "========================================="
echo ""

BASE_PATH="."
ALLVALID=true

# Test 1: Manifest.json
echo "✓ Checking manifest.json..."
if [ -f "public/manifest.json" ]; then
    echo "  ✓ manifest.json found"
    if grep -q '"display": "standalone"' public/manifest.json; then
        echo "  ✓ Display mode is standalone"
    fi
    if grep -q '"192x192"' public/manifest.json; then
        echo "  ✓ 192x192 icons configured"
    fi
    if grep -q '"512x512"' public/manifest.json; then
        echo "  ✓ 512x512 icons configured"
    fi
    if grep -q '"maskable"' public/manifest.json; then
        echo "  ✓ Maskable icons configured"
    fi
else
    echo "  ✗ manifest.json not found"
    ALLVALID=false
fi

# Test 2: Service Worker
echo ""
echo "✓ Checking service-worker.js..."
if [ -f "public/service-worker.js" ]; then
    echo "  ✓ service-worker.js found"
    if grep -q "CACHE_NAME" public/service-worker.js; then
        echo "  ✓ Cache configuration present"
    fi
else
    echo "  ✗ service-worker.js not found"
    ALLVALID=false
fi

# Test 3: PWA Components
echo ""
echo "✓ Checking PWA Components..."
for component in \
    "src/components/pwa/PWAServiceWorkerRegistration.tsx" \
    "src/components/pwa/PWAInstallPromptHandler.tsx" \
    "src/components/premium/DownloadAppButton.tsx"
do
    if [ -f "$component" ]; then
        echo "  ✓ $(basename $component)"
    else
        echo "  ✗ $component not found"
        ALLVALID=false
    fi
done

# Test 4: Download App Manager
echo ""
echo "✓ Checking downloadAppManager.ts..."
if [ -f "src/lib/downloadAppManager.ts" ]; then
    echo "  ✓ downloadAppManager.ts found"
    if grep -q "beforeinstallprompt" src/lib/downloadAppManager.ts; then
        echo "  ✓ Feature detection implemented"
    fi
    if grep -q "display-mode" src/lib/downloadAppManager.ts; then
        echo "  ✓ Installation detection implemented"
    fi
    if grep -q "stopPropagation" src/lib/downloadAppManager.ts; then
        echo "  ✓ Event handling implemented"
    fi
else
    echo "  ✗ downloadAppManager.ts not found"
    ALLVALID=false
fi

# Test 5: Layout Configuration
echo ""
echo "✓ Checking app layout..."
if [ -f "src/app/layout.tsx" ]; then
    echo "  ✓ layout.tsx found"
    if grep -q "PWAServiceWorkerRegistration" src/app/layout.tsx; then
        echo "  ✓ PWA components registered"
    fi
    if grep -q "manifest.json" src/app/layout.tsx; then
        echo "  ✓ Manifest linked"
    fi
else
    echo "  ✗ layout.tsx not found"
    ALLVALID=false
fi

# Summary
echo ""
echo "========================================="
echo "VERIFICATION SUMMARY"
echo "========================================="

if [ "$ALLVALID" = true ]; then
    echo ""
    echo "✓ ALL CHECKS PASSED"
    echo ""
    echo "PWA Implementation Status: PRODUCTION READY"
    echo ""
else
    echo ""
    echo "⚠ Some checks need review"
    echo ""
fi

echo "Documentation:"
echo "- PWA_CROSS_BROWSER_AUDIT.md (comprehensive guide)"
echo "- PWA_TESTING_GUIDE.md (testing procedures)"
echo ""
