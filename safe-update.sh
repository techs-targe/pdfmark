#!/bin/bash
# PDFMark v1.0.2 Safe Update Script
# Preserves existing environment configuration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REPO_URL="https://github.com/techs-targe/pdfmark.git"
TAG="v1.0.2"

echo -e "${BLUE}🛡️  PDFMark v1.0.2 Safe Update Script${NC}"
echo -e "${YELLOW}⚠️  This script preserves your existing environment configuration${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run this script with sudo${NC}"
    exit 1
fi

# Step 1: Discover current environment
echo -e "${BLUE}🔍 Step 1: Discovering current environment...${NC}"

# Find existing PDFMark installation
CURRENT_PATH=""
if [ -d "/var/www/pdfmark" ]; then
    CURRENT_PATH="/var/www/pdfmark"
    echo -e "${GREEN}✅ Found PDFMark at: $CURRENT_PATH${NC}"
elif [ -d "/var/www/html/pdfmark" ]; then
    CURRENT_PATH="/var/www/html/pdfmark"
    echo -e "${GREEN}✅ Found PDFMark at: $CURRENT_PATH${NC}"
else
    echo -e "${RED}❌ No existing PDFMark installation found${NC}"
    echo "Expected locations: /var/www/pdfmark or /var/www/html/pdfmark"
    exit 1
fi

# Check current version
echo -e "${BLUE}📄 Current version info:${NC}"
if [ -f "$CURRENT_PATH/VERSION.txt" ]; then
    cat "$CURRENT_PATH/VERSION.txt"
else
    echo "No VERSION.txt found"
fi

# Step 2: Create comprehensive backup
echo -e "${BLUE}💾 Step 2: Creating comprehensive backup...${NC}"

BACKUP_DIR="/var/backups/pdfmark-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup current files
echo "Backing up current files..."
cp -r "$CURRENT_PATH" "$BACKUP_DIR/pdfmark-files/"

# Backup nginx configuration
echo "Backing up nginx configuration..."
find /etc/nginx -name "*.conf" -exec grep -l "pdfmark" {} \; | while read file; do
    cp "$file" "$BACKUP_DIR/nginx-$(basename $file)"
done

# Record current configuration
cat > "$BACKUP_DIR/environment-info.txt" << EOF
PDFMark Environment Backup - $(date)

Current Path: $CURRENT_PATH
Backup Location: $BACKUP_DIR

Directory Contents:
$(ls -la "$CURRENT_PATH")

File Ownership:
$(ls -ld "$CURRENT_PATH")

Disk Usage:
$(du -sh "$CURRENT_PATH")

Nginx Configuration:
$(nginx -T 2>/dev/null | grep -A 20 -B 5 pdfmark || echo "No nginx config found")
EOF

echo -e "${GREEN}✅ Backup created at: $BACKUP_DIR${NC}"

# Step 3: Build new version in temporary location
echo -e "${BLUE}🔨 Step 3: Building new version...${NC}"

TEMP_DIR="/tmp/pdfmark-v1.0.2-build"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo "Cloning repository..."
git clone "$REPO_URL" .
git checkout "$TAG"

echo "Installing dependencies..."
npm install

echo "Preparing build..."
mkdir -p public
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/

echo "Building application..."
npm run build

# Verify build
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Step 4: Create test environment
echo -e "${BLUE}🧪 Step 4: Creating test environment...${NC}"

TEST_PATH="/var/www/pdfmark-test-v102"
rm -rf "$TEST_PATH"
mkdir -p "$TEST_PATH"

# Copy built files to test location
cp -r dist/* "$TEST_PATH/"
chown -R www-data:www-data "$TEST_PATH"
chmod -R 755 "$TEST_PATH"

# Create test nginx configuration
TEST_LOCATION="/pdfmark-test"
cat > /etc/nginx/sites-available/pdfmark-test-v102 << EOF
location $TEST_LOCATION/ {
    alias $TEST_PATH/;
    try_files \$uri \$uri/ $TEST_LOCATION/index.html;
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|mjs)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Version header for testing
    add_header X-PDFMark-Version "v1.0.2-test";
}
EOF

# Enable test configuration
ln -sf /etc/nginx/sites-available/pdfmark-test-v102 /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo -e "${GREEN}✅ Test environment created${NC}"
echo -e "${YELLOW}🔗 Test URL: http://your-server.com$TEST_LOCATION/${NC}"

# Step 5: Interactive testing
echo ""
echo -e "${YELLOW}🧪 Please test the new version at: http://your-server.com$TEST_LOCATION/${NC}"
echo ""
echo "Test these v1.0.2 features:"
echo "• Left/Right arrow keys for page navigation"
echo "• Enter key for page input focus"
echo "• Zoom dropdown menu selection"
echo "• Tile mode boundary resizing"
echo "• All layout modes (Single/Vertical/Horizontal/Tile)"
echo ""

# Wait for user confirmation
read -p "Is the test version working correctly? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Update cancelled by user${NC}"
    echo "Test environment remains at: $TEST_PATH"
    echo "To clean up test: sudo rm -rf $TEST_PATH && sudo rm /etc/nginx/sites-enabled/pdfmark-test-v102"
    exit 0
fi

# Step 6: Production update
echo -e "${BLUE}🚀 Step 6: Updating production environment...${NC}"

# Final backup before update
FINAL_BACKUP="$CURRENT_PATH-backup-final-$(date +%Y%m%d-%H%M%S)"
cp -r "$CURRENT_PATH" "$FINAL_BACKUP"

# Update production files
echo "Updating production files..."
rm -rf "$CURRENT_PATH"/*
cp -r "$TEST_PATH"/* "$CURRENT_PATH/"

# Restore ownership and permissions
chown -R www-data:www-data "$CURRENT_PATH"
chmod -R 755 "$CURRENT_PATH"

# Create version info
cat > "$CURRENT_PATH/VERSION.txt" << EOF
PDFMark v1.0.2
Updated: $(date)
Previous backup: $FINAL_BACKUP
Repository: $REPO_URL
Tag: $TAG
Features:
- Fixed arrow key page navigation in single layout
- Fixed Enter key for page input focus
- Fixed tile mode boundary resizing  
- Fixed zoom dropdown menu selection
- Improved keyboard navigation stability
EOF

echo -e "${GREEN}✅ Production update completed${NC}"

# Step 7: Cleanup test environment
echo -e "${BLUE}🧹 Step 7: Cleaning up test environment...${NC}"

rm -rf "$TEST_PATH"
rm -f /etc/nginx/sites-enabled/pdfmark-test-v102
rm -f /etc/nginx/sites-available/pdfmark-test-v102
nginx -t && systemctl reload nginx

rm -rf "$TEMP_DIR"

echo -e "${GREEN}✅ Cleanup completed${NC}"

# Final verification
echo -e "${BLUE}🔍 Final verification...${NC}"

if curl -s -I "http://localhost$(echo $CURRENT_PATH | sed 's|/var/www||')/" | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅ Production site is responding${NC}"
else
    echo -e "${YELLOW}⚠️  Production site test inconclusive${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}🎉 PDFMark v1.0.2 Update Completed Successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Update Summary:${NC}"
echo "• Production path: $CURRENT_PATH"
echo "• Backup location: $BACKUP_DIR"
echo "• Final backup: $FINAL_BACKUP"
echo "• Version: v1.0.2"
echo ""
echo -e "${BLUE}🔄 Rollback Instructions (if needed):${NC}"
echo "sudo cp -r '$FINAL_BACKUP'/* '$CURRENT_PATH'/"
echo "sudo chown -R www-data:www-data '$CURRENT_PATH'"
echo ""
echo -e "${YELLOW}⚠️  Keep backups for at least 30 days${NC}"
echo ""
echo -e "${GREEN}✨ Enjoy the improved PDFMark experience!${NC}"