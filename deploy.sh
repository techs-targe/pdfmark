#!/bin/bash
# PDFMark v1.0.2 Server Deployment Script

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/techs-targe/pdfmark.git"
DEPLOY_DIR="/var/www/pdfmark"
WEB_DIR="/var/www/html/pdfmark"
BRANCH="stable-v1"
TAG="v1.0.2"
BACKUP_DIR="/var/backups/pdfmark"

echo -e "${BLUE}🚀 PDFMark v1.0.2 Deployment Starting...${NC}"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run this script with sudo${NC}"
    exit 1
fi

# Create backup of current deployment
if [ -d "$WEB_DIR" ]; then
    echo -e "${YELLOW}📦 Creating backup...${NC}"
    mkdir -p "$BACKUP_DIR"
    cp -r "$WEB_DIR" "$BACKUP_DIR/pdfmark-backup-$(date +%Y%m%d-%H%M%S)"
fi

# Setup deployment directory
echo -e "${BLUE}📁 Setting up deployment directory...${NC}"
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Check if git is available
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git is not installed. Please install git first.${NC}"
    exit 1
fi

# Check if node is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "18" ]; then
    echo -e "${RED}❌ Node.js version must be 18 or higher. Current: $(node --version)${NC}"
    exit 1
fi

# Fetch latest source from GitHub
echo -e "${BLUE}📥 Fetching latest source from GitHub...${NC}"
if [ -d ".git" ]; then
    echo -e "${YELLOW}🔄 Updating existing repository...${NC}"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    
    # Checkout specific tag
    echo -e "${YELLOW}🏷️  Checking out tag $TAG...${NC}"
    git checkout "$TAG"
else
    echo -e "${YELLOW}📋 Cloning repository...${NC}"
    git clone "$REPO_URL" .
    git checkout "$TAG"
fi

# Show current version info
echo -e "${BLUE}📄 Current deployment info:${NC}"
echo "Repository: $REPO_URL"
echo "Tag: $TAG"
echo "Commit: $(git rev-parse HEAD)"
echo "Branch: $(git rev-parse --abbrev-ref HEAD)"

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

# Run type checking
echo -e "${BLUE}🔍 Running type check...${NC}"
npm run typecheck || {
    echo -e "${RED}❌ Type check failed${NC}"
    exit 1
}

# Run linting
echo -e "${BLUE}🔍 Running linter...${NC}"
npm run lint || {
    echo -e "${YELLOW}⚠️  Linting warnings found, but continuing...${NC}"
}

# Build application
echo -e "${BLUE}🔨 Building application...${NC}"
npm run build

# Verify build output
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo -e "${RED}❌ Build failed - dist directory or index.html not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Deploy to web directory
echo -e "${BLUE}📤 Deploying to web directory...${NC}"
mkdir -p "$WEB_DIR"
cp -r dist/* "$WEB_DIR/"

# Set proper ownership and permissions
chown -R www-data:www-data "$WEB_DIR/"
find "$WEB_DIR" -type f -exec chmod 644 {} \;
find "$WEB_DIR" -type d -exec chmod 755 {} \;

# Clean up unnecessary files
echo -e "${BLUE}🧹 Cleaning up unnecessary files...${NC}"
rm -f "$WEB_DIR/vite.svg" 2>/dev/null || true

# Create version info file
echo -e "${BLUE}📝 Creating version info...${NC}"
cat > "$WEB_DIR/VERSION.txt" << EOF
PDFMark v1.0.2
Deployed: $(date)
Branch: $BRANCH
Tag: $TAG
Commit: $(git rev-parse HEAD)
Server: $(hostname)
User: $(whoami)
EOF

# Create .htaccess for Apache (if Apache is detected)
if command -v apache2 &> /dev/null || [ -d "/etc/apache2" ]; then
    echo -e "${BLUE}⚙️  Creating .htaccess for Apache...${NC}"
    cat > "$WEB_DIR/.htaccess" << 'EOF'
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /pdfmark/index.html [L]

# PDF MIME type
AddType application/pdf .pdf

# Cache settings
<filesMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg)$">
    ExpiresActive on
    ExpiresDefault "access plus 1 month"
</filesMatch>

# Security headers
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"
EOF
fi

# Test if web server is running
echo -e "${BLUE}🔍 Testing web server...${NC}"
if curl -s -I "http://localhost/pdfmark/" | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅ Web server is responding${NC}"
else
    echo -e "${YELLOW}⚠️  Web server test inconclusive${NC}"
fi

# Final success message
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 PDFMark v1.0.2 is now live!${NC}"
echo ""
echo -e "${BLUE}📊 Deployment Summary:${NC}"
echo "• Version: v1.0.2"
echo "• Deploy directory: $DEPLOY_DIR"
echo "• Web directory: $WEB_DIR" 
echo "• Backup location: $BACKUP_DIR"
echo "• Version info: $WEB_DIR/VERSION.txt"
echo ""
echo -e "${YELLOW}🔗 Next steps:${NC}"
echo "1. Test the application: http://your-domain.com/pdfmark/"
echo "2. Check logs if needed: tail -f /var/log/apache2/error.log"
echo "3. Monitor application performance"
echo ""
echo -e "${GREEN}🎉 Happy PDF annotating!${NC}"