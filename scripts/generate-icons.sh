#!/bin/bash
# Icon Generation Script for Campus Rides PWA
# This script helps generate all required PWA icons from a source image

# Usage: bash generate-icons.sh source-image.png

if [ -z "$1" ]; then
    echo "Usage: bash generate-icons.sh <source-image.png>"
    echo ""
    echo "Example:"
    echo "  bash generate-icons.sh campus-rides-logo.png"
    echo ""
    echo "Requirements: ImageMagick (convert command)"
    echo "Install: brew install imagemagick (Mac) or apt-get install imagemagick (Linux)"
    exit 1
fi

SOURCE_IMAGE="$1"
OUTPUT_DIR="./public/icons"

# Check if source image exists
if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "Error: Source image not found: $SOURCE_IMAGE"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Generating PWA icons from: $SOURCE_IMAGE"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Standard icons (any content OK)
echo "Generating standard icons..."
convert "$SOURCE_IMAGE" -resize 32x32 "$OUTPUT_DIR/favicon-32x32.png"
echo "✓ favicon-32x32.png"

convert "$SOURCE_IMAGE" -resize 96x96 "$OUTPUT_DIR/favicon-96x96.png"
echo "✓ favicon-96x96.png"

convert "$SOURCE_IMAGE" -resize 192x192 "$OUTPUT_DIR/icon-192x192.png"
echo "✓ icon-192x192.png"

convert "$SOURCE_IMAGE" -resize 512x512 "$OUTPUT_DIR/icon-512x512.png"
echo "✓ icon-512x512.png"

# iOS icon (solid background)
echo ""
echo "Generating iOS icon (with white background)..."
convert "$SOURCE_IMAGE" -resize 180x180 \
    \( +clone -alpha extract -negate -morphology EdgeOut octagon:2 -morphology Dilate octagon:1 \) \
    -compose CopyOpacity -composite \
    -background white -alpha off -quality 90 \
    "$OUTPUT_DIR/apple-touch-icon.png"
echo "✓ apple-touch-icon.png"

# Maskable icons (safe zone: center 60%)
echo ""
echo "Generating maskable icons..."
# For maskable, we need to ensure the logo is in the center safe zone
convert "$SOURCE_IMAGE" -resize 192x192 \
    -background transparent \
    "$OUTPUT_DIR/icon-192x192-maskable.png"
echo "✓ icon-192x192-maskable.png (remember: logo should be in center 60%)"

convert "$SOURCE_IMAGE" -resize 512x512 \
    -background transparent \
    "$OUTPUT_DIR/icon-512x512-maskable.png"
echo "✓ icon-512x512-maskable.png (remember: logo should be in center 60%)"

# Safari pinned tab (needs manual SVG, but create placeholder)
echo ""
echo "Creating Safari pinned tab placeholder..."
cat > "$OUTPUT_DIR/safari-pinned-tab.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <!-- Replace this with your monochrome logo SVG -->
  <path d="M96,10 C50.5,10 15,45.5 15,91 C15,136.5 50.5,172 96,172 C141.5,172 177,136.5 177,91 C177,45.5 141.5,10 96,10 Z M96,150 C65,150 40,125 40,94 C40,63 65,38 96,38 C127,38 152,63 152,94 C152,125 127,150 96,150 Z"/>
</svg>
EOF
echo "✓ safari-pinned-tab.svg (MANUAL: Replace with your monochrome logo SVG)"

echo ""
echo "✅ Icon generation complete!"
echo ""
echo "Next steps:"
echo "1. Review generated icons in $OUTPUT_DIR"
echo "2. For maskable icons, ensure logo is in center 60% of image"
echo "3. For safari-pinned-tab.svg, replace placeholder with your logo SVG"
echo "4. Run: npm run build && npm start"
echo "5. Test installation on mobile device"
