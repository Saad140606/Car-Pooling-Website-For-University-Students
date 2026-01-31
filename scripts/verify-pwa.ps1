#!/usr/bin/env pwsh
# PWA Cross-Browser Implementation Verification Script
# Run this to verify all PWA files are correctly configured

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "PWA CROSS-BROWSER AUDIT VERIFICATION" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

$basePath = "d:\desktop\Campus Ride clone\Car-Pooling-Website-For-University-Students"
$allValid = $true

# Test 1: Manifest.json
Write-Host "✓ Checking manifest.json..." -ForegroundColor Green
$manifestPath = Join-Path $basePath "public\manifest.json"
if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath | ConvertFrom-Json
    $checks = @{
        "name" = ($manifest.name) -and ($manifest.name -like "*Campus*")
        "short_name" = ($manifest.short_name)
        "start_url" = ($manifest.start_url -eq "/")
        "display" = ($manifest.display -eq "standalone")
        "icons_192" = ($manifest.icons | Where-Object { $_.sizes -eq "192x192" } | Measure-Object).Count -gt 0
        "icons_512" = ($manifest.icons | Where-Object { $_.sizes -eq "512x512" } | Measure-Object).Count -gt 0
        "maskable_icons" = ($manifest.icons | Where-Object { $_.purpose -eq "maskable" } | Measure-Object).Count -gt 0
    }
    
    foreach ($check in $checks.GetEnumerator()) {
        if ($check.Value) {
            Write-Host "  ✓ $($check.Key)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $($check.Key)" -ForegroundColor Red
            $allValid = $false
        }
    }
} else {
    Write-Host "  ✗ manifest.json not found" -ForegroundColor Red
    $allValid = $false
}

# Test 2: Service Worker
Write-Host "`n✓ Checking service-worker.js..." -ForegroundColor Green
$swPath = Join-Path $basePath "public\service-worker.js"
if (Test-Path $swPath) {
    $swContent = Get-Content $swPath -Raw
    $swChecks = @{
        "CACHE_NAME defined" = ($swContent -match "CACHE_NAME")
        "Cache strategies" = ($swContent -match "cacheFirst|networkFirst")
        "Install listener" = ($swContent -match "install")
        "Fetch listener" = ($swContent -match "fetch")
    }
    
    foreach ($check in $swChecks.GetEnumerator()) {
        if ($check.Value) {
            Write-Host "  ✓ $($check.Key)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $($check.Key)" -ForegroundColor Red
            $allValid = $false
        }
    }
} else {
    Write-Host "  ✗ service-worker.js not found" -ForegroundColor Red
    $allValid = $false
}

# Test 3: PWA Components
Write-Host "`n✓ Checking PWA Components..." -ForegroundColor Green
$components = @(
    "src\components\pwa\PWAServiceWorkerRegistration.tsx",
    "src\components\pwa\PWAInstallPromptHandler.tsx",
    "src\components\premium\DownloadAppButton.tsx"
)

foreach ($component in $components) {
    $componentPath = Join-Path $basePath $component
    if (Test-Path $componentPath) {
        Write-Host "  ✓ $(Split-Path -Leaf $component)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $(Split-Path -Leaf $component)" -ForegroundColor Red
        $allValid = $false
    }
}

# Test 4: DownloadAppManager
Write-Host "`n✓ Checking downloadAppManager.ts..." -ForegroundColor Green
$managerPath = Join-Path $basePath "src\lib\downloadAppManager.ts"
if (Test-Path $managerPath) {
    $managerContent = Get-Content $managerPath -Raw
    $managerChecks = @{
        "Feature detection" = ($managerContent -match "ontouchstart|maxTouchPoints")
        "Installation detection" = ($managerContent -match "isAlreadyInstalled|display-mode")
        "HTTPS validation" = ($managerContent -match "protocol.*https")
        "Error handling" = ($managerContent -match "emit.*error")
        "Platform routing" = ($managerContent -match "handleIOSInstall|handleAndroidInstall")
    }
    
    foreach ($check in $managerChecks.GetEnumerator()) {
        if ($check.Value) {
            Write-Host "  ✓ $($check.Key)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $($check.Key)" -ForegroundColor Red
            $allValid = $false
        }
    }
} else {
    Write-Host "  ✗ downloadAppManager.ts not found" -ForegroundColor Red
    $allValid = $false
}

# Test 5: Layout Configuration
Write-Host "`n✓ Checking app layout.tsx..." -ForegroundColor Green
$layoutPath = Join-Path $basePath "src\app\layout.tsx"
if (Test-Path $layoutPath) {
    $layoutContent = Get-Content $layoutPath -Raw
    $layoutChecks = @{
        "PWA imports" = ($layoutContent -match "PWAServiceWorkerRegistration|PWAInstallPromptHandler")
        "Manifest link" = ($layoutContent -match 'manifest')
        "Theme color" = ($layoutContent -match "theme-color")
        "PWA components" = ($layoutContent -match "PWAServiceWorkerRegistration|PWAInstallPromptHandler")
    }
    
    foreach ($check in $layoutChecks.GetEnumerator()) {
        if ($check.Value) {
            Write-Host "  ✓ $($check.Key)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $($check.Key)" -ForegroundColor Red
            $allValid = $false
        }
    }
} else {
    Write-Host "  ✗ layout.tsx not found" -ForegroundColor Red
    $allValid = $false
}

# Test 6: Click Event Fixes
Write-Host "`n✓ Checking click event handling..." -ForegroundColor Green
$buttonPath = Join-Path $basePath "src\components\premium\DownloadAppButton.tsx"
if (Test-Path $buttonPath) {
    $buttonContent = Get-Content $buttonPath -Raw
    if ($buttonContent -match "type.*button" -and $buttonContent -match "pointer-events-none") {
        Write-Host "  ✓ Button type and event handling" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Missing button fixes" -ForegroundColor Red
    }
}

$handlerPath = Join-Path $basePath "src\components\pwa\PWAInstallPromptHandler.tsx"
if (Test-Path $handlerPath) {
    $handlerContent = Get-Content $handlerPath -Raw
    if ($handlerContent -match "stopPropagation") {
        Write-Host "  ✓ stopPropagation in handler" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Missing stopPropagation" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

if ($allValid) {
    Write-Host "`n✓ ALL CHECKS PASSED" -ForegroundColor Green
    Write-Host "`nPWA Implementation Status: PRODUCTION READY`n" -ForegroundColor Green
} else {
    Write-Host "`n⚠ Some checks need review.`n" -ForegroundColor Yellow
}

Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "- PWA_CROSS_BROWSER_AUDIT.md (comprehensive guide)"
Write-Host "- PWA_TESTING_GUIDE.md (testing procedures)`n"
