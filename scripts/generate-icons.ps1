# Icon Generation Script for Campus Rides PWA (Windows PowerShell)
# This script helps generate all required PWA icons from a source image
# 
# Usage: .\generate-icons.ps1 -SourceImage "campus-rides-logo.png"
#
# Requirements: ImageMagick installed
# Download from: https://imagemagick.org/download/windows/
#
# Or install via Chocolatey: choco install imagemagick

param(
    [Parameter(Mandatory=$true)]
    [string]$SourceImage,
    
    [string]$OutputDir = ".\public\icons"
)

function Test-CommandExists {
    param($command)
    $null = Get-Command $command -ErrorAction SilentlyContinue
    return $?
}

# Check if ImageMagick is installed
if (-not (Test-CommandExists convert)) {
    Write-Host "Error: ImageMagick 'convert' command not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install ImageMagick:"
    Write-Host "1. Download from: https://imagemagick.org/download/windows/"
    Write-Host "2. Run installer and ensure 'Add to PATH' is checked"
    Write-Host "3. Restart PowerShell"
    exit 1
}

# Check if source image exists
if (-not (Test-Path $SourceImage)) {
    Write-Host "Error: Source image not found: $SourceImage" -ForegroundColor Red
    exit 1
}

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

Write-Host "Generating PWA icons from: $SourceImage" -ForegroundColor Green
Write-Host "Output directory: $OutputDir"
Write-Host ""

# Standard icons (any content OK)
Write-Host "Generating standard icons..." -ForegroundColor Cyan
convert "$SourceImage" -resize 32x32 "$OutputDir\favicon-32x32.png"
Write-Host "✓ favicon-32x32.png"

convert "$SourceImage" -resize 96x96 "$OutputDir\favicon-96x96.png"
Write-Host "✓ favicon-96x96.png"

convert "$SourceImage" -resize 192x192 "$OutputDir\icon-192x192.png"
Write-Host "✓ icon-192x192.png"

convert "$SourceImage" -resize 512x512 "$OutputDir\icon-512x512.png"
Write-Host "✓ icon-512x512.png"

# iOS icon (solid white background)
Write-Host ""
Write-Host "Generating iOS icon (with white background)..." -ForegroundColor Cyan
convert "$SourceImage" -resize 180x180 `
    `( +clone -alpha extract -negate -morphology EdgeOut octagon:2 -morphology Dilate octagon:1 `) `
    -compose CopyOpacity -composite `
    -background white -alpha off -quality 90 `
    "$OutputDir\apple-touch-icon.png"
Write-Host "✓ apple-touch-icon.png"

# Maskable icons (safe zone: center 60%)
Write-Host ""
Write-Host "Generating maskable icons..." -ForegroundColor Cyan
convert "$SourceImage" -resize 192x192 `
    -background transparent `
    "$OutputDir\icon-192x192-maskable.png"
Write-Host "✓ icon-192x192-maskable.png"
Write-Host "  ⚠️  Remember: logo should fit in center 60% of image"

convert "$SourceImage" -resize 512x512 `
    -background transparent `
    "$OutputDir\icon-512x512-maskable.png"
Write-Host "✓ icon-512x512-maskable.png"
Write-Host "  ⚠️  Remember: logo should fit in center 60% of image"

# Safari pinned tab (create placeholder SVG)
Write-Host ""
Write-Host "Creating Safari pinned tab placeholder..." -ForegroundColor Cyan

@'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <!-- Replace this with your monochrome logo SVG -->
  <!-- Logo should be dark/black on transparent background -->
  <!-- Simplify to single color for best results -->
  <circle cx="96" cy="96" r="80" fill="black"/>
  <!-- Remove this circle and add your logo SVG path -->
</svg>
'@ | Out-File "$OutputDir\safari-pinned-tab.svg" -Encoding UTF8

Write-Host "✓ safari-pinned-tab.svg"
Write-Host "  ⚠️  MANUAL: Replace with your monochrome logo SVG"

Write-Host ""
Write-Host "✅ Icon generation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review generated icons in $OutputDir"
Write-Host "2. For maskable icons, ensure logo is in center 60% of image"
Write-Host "3. For safari-pinned-tab.svg, replace placeholder with your logo SVG"
Write-Host "4. Run: npm run build && npm start"
Write-Host "5. Test installation on mobile device"
Write-Host ""

# Check icon files
Write-Host "Generated files:" -ForegroundColor Cyan
Get-ChildItem "$OutputDir" | ForEach-Object {
    $size = (Get-Item $_.FullName).Length / 1KB
    Write-Host "  - $($_.Name) ($([Math]::Round($size, 2)) KB)"
}

$totalSize = (Get-ChildItem "$OutputDir" | Measure-Object -Property Length -Sum).Sum / 1KB
Write-Host ""
Write-Host "Total icons size: $([Math]::Round($totalSize, 2)) KB" -ForegroundColor Green
