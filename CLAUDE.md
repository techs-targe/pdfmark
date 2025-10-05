# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**pdfmark** - A web-based PDF viewer with non-destructive annotation capabilities for study purposes (IPA exams, etc.)

## Important Working Practices

### Temporary Files Usage

**CRITICAL**: When creating temporary files for investigation, testing, or quick verification:
- **ALWAYS use the `tmp/` folder** for any temporary files
- The `tmp/` folder is excluded from git tracking (.gitignore)
- Examples of temporary files:
  - Test scripts (`tmp/test-pdf-load.js`)
  - Sample HTML for testing (`tmp/canvas-test.html`)
  - Quick investigation scripts (`tmp/check-browser-api.js`)
  - Mock data files (`tmp/sample-annotations.json`)
  - Debug outputs (`tmp/debug-log.txt`)

```bash
# Correct usage
tmp/test-feature.js
tmp/sample-data.json
tmp/debug-output.html

# Incorrect - DO NOT create temporary files in root or src
test.js           # ❌ Wrong
src/test.html     # ❌ Wrong
debug.txt         # ❌ Wrong
```

### Directory Structure for Development

```
pdfmark/
├── tmp/              # Temporary files (git-ignored)
│   └── .gitkeep     # Keep folder in structure
├── src/             # Source code only
├── public/          # Public assets only
└── ...
```

## Key Technologies

- **PDF Rendering**: PDF.js
- **Annotation Layer**: Canvas API over PDF layer
- **Framework**: React (preferred) or Vanilla JavaScript
- **Data Storage**: LocalStorage/IndexedDB
- **Styling**: CSS3/Tailwind CSS

## Development Commands

The project uses Vite + React + TypeScript:

```bash
# Install dependencies
npm install

# Development server (runs on port 4567)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run typecheck

# Linting
npm run lint

# Run all checks (lint + typecheck)
npm run check
```

## Architecture Overview

### Core Components

1. **PDF Viewer Layer**: Uses PDF.js for rendering PDF documents
2. **Annotation Layer**: Transparent Canvas overlay for non-destructive annotations
3. **Tab System**: Multiple views of the same PDF with independent page/zoom states
4. **Storage Manager**: Handles LocalStorage/IndexedDB persistence of annotations

### Data Flow

- PDF files are processed locally (no server upload)
- Annotations stored separately from PDF data
- JSON format for export/import of annotation data
- Auto-save every 5 seconds of inactivity

### Directory Structure

```
pdfmark/
├── src/
│   ├── components/     # React components
│   │   ├── PDFViewer/
│   │   ├── AnnotationLayer/
│   │   ├── Toolbar/
│   │   └── TabManager/
│   ├── tools/         # Drawing tools
│   │   ├── PenTool.ts
│   │   ├── TextTool.ts
│   │   ├── EraserTool.ts
│   │   └── LineTool.ts
│   ├── utils/         # Utilities
│   │   ├── storage.ts
│   │   └── pdfUtils.ts
│   └── types/         # TypeScript types
└── public/
    └── pdfjs/         # PDF.js library files
```

## Implementation Priorities

### Phase 1: Core Features
- Basic PDF display with PDF.js
- Simple pen and eraser annotations
- LocalStorage persistence

### Phase 2: Enhanced Tools
- Tab system for multiple views
- Complete drawing tool set
- Undo/Redo functionality

### Phase 3: Advanced Features
- Split screen views
- JSON export/import
- Keyboard shortcuts

## Important Constraints

- Maximum PDF size: 50MB
- Maximum pages: 500
- Maximum tabs: 10
- Maximum annotations per page: 1000

## Git Configuration

Repository: https://github.com/techs-targe/pdfmark

### User Configuration
```bash
# Set Git config for this project
git config user.name "techs-targe"
git config user.email "techs.targe@gmail.com"

# Or export as environment variables
export GIT_AUTHOR_NAME="techs-targe"
export GIT_AUTHOR_EMAIL="techs.targe@gmail.com"
export GIT_COMMITTER_NAME="techs-targe"
export GIT_COMMITTER_EMAIL="techs.targe@gmail.com"
```

### Initial Git Setup
```bash
# Initialize git repository (if not already done)
git init

# Set user configuration
git config user.name "techs-targe"
git config user.email "techs.targe@gmail.com"

# Add remote repository
git remote add origin https://github.com/techs-targe/pdfmark.git

# First commit and push
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

### Common Git Commands
```bash
# Add and commit changes
git add .
git commit -m "Your commit message"
git push

# Pull latest changes
git pull origin main

# Check status
git status
```

## Production Server Deployment

### Server Build Commands (IMPORTANT)

**⚠️ Use `npx vite build` NOT `npm run build`**

`npm run build` includes TypeScript checking and will show many errors. For production deployment, use:

```bash
# Correct server deployment procedure
git pull origin stable-v1
npx vite build  # NOT npm run build
sudo cp -r dist/* /var/www/pdfmark/
```

### Complete Server Deployment Procedure

```bash
# 1. Navigate to project directory on server
cd /path/to/pdfmark

# 2. Pull latest stable version
git pull origin stable-v1

# 3. Clean previous build (optional but recommended)
rm -rf dist/
rm -rf node_modules/.vite  # Clear Vite cache

# 4. Install dependencies (if needed)
npm ci

# 5. Build for production (CRITICAL: use npx vite build)
npx vite build

# 6. Deploy to web directory
sudo rm -rf /var/www/pdfmark/*  # Complete cleanup
sudo cp -r dist/* /var/www/pdfmark/

# 7. Set proper permissions
sudo chown -R www-data:www-data /var/www/pdfmark/
sudo chmod -R 755 /var/www/pdfmark/

# 8. Reload web server (if needed)
sudo systemctl reload nginx
```

### Troubleshooting

**If PDF.js worker 404 errors occur:**
1. Verify all files copied: `ls -la /var/www/pdfmark/assets/pdf.worker*`
2. Check nginx MIME types for .mjs files
3. Clear browser cache completely (Ctrl+Shift+R)
4. Check browser console for specific missing files

**Build Command Comparison:**
- ❌ `npm run build` - Includes TypeScript checking, shows errors
- ✅ `npx vite build` - Direct Vite build, skips TypeScript errors

### Current Version Checking

```bash
# Development server (shows current build number)
npm run dev
# Access: http://localhost:4567/
# Click ❓ button to see version info

# Production deployment verification
curl -I https://your-domain.com/pdfmark/
```

## GitHub Pages Deployment (CRITICAL)

### Branch Strategy

**Two branches with different purposes:**

1. **`stable-v1` branch**: Development and testing
   - Use for active development
   - GitHub Actions runs TypeScript checks
   - Does NOT deploy to GitHub Pages

2. **`main` branch**: Production deployment
   - Synchronized with `stable-v1`
   - GitHub Actions deploys to GitHub Pages
   - Protected by environment rules

### Deployment Workflow

**Standard workflow for all changes:**

```bash
# 1. Make changes and commit to stable-v1
git add .
git commit -m "Your changes"
git push origin stable-v1

# 2. Sync main branch with stable-v1
git checkout main
git reset --hard stable-v1
git push origin main --force
git checkout stable-v1
```

**One-line command (recommended):**
```bash
git push origin stable-v1 && git checkout main && git reset --hard stable-v1 && git push origin main --force && git checkout stable-v1
```

### GitHub Actions Configuration

**Workflow file:** `.github/workflows/deploy.yml`

```yaml
on:
  push:
    branches: [ main, stable-v1 ]  # Build on both branches

deploy:
  if: github.ref == 'refs/heads/main'  # Deploy ONLY from main
```

**Behavior:**
- **stable-v1 push**: Build ✓, TypeScript check ✓, Deploy ✗ (skipped)
- **main push**: Build ✓, TypeScript check ✓, Deploy ✓

### TypeScript Error Detection

**CRITICAL DIFFERENCE:**

- **Development (`npm run dev`)**: Loose type checking, fast feedback
- **Production (`npm run build`)**: Strict TypeScript compilation

**Common issues:**
1. Unused imports/variables trigger errors only in build
2. Type mismatches hidden in development
3. `import.meta.env` requires Vite type definitions

**Best practices:**
1. Always run `npm run build` before pushing to catch errors
2. Use `npm run typecheck` for quick type validation
3. Fix TypeScript errors immediately, don't suppress them

### Common Deployment Errors and Solutions

**Error: "Branch stable-v1 is not allowed to deploy"**
- **Cause**: GitHub Pages environment protection rules
- **Solution**: Deploy only from `main` branch (already configured)

**Error: "TypeScript compilation failed"**
- **Cause**: Strict type checking in production build
- **Solution**:
  ```bash
  # Run locally to see errors
  npm run build

  # Fix all TypeScript errors before pushing
  npm run typecheck
  ```

**Error: "Property 'env' does not exist on type 'ImportMeta'"**
- **Cause**: Missing Vite type definitions
- **Solution**: Add `/// <reference types="vite/client" />` to file

**Error: "Unused variable/import"**
- **Cause**: TypeScript strict mode catches unused code
- **Solution**: Remove unused code OR add suppression:
  ```typescript
  // For unused variables
  void variableName;

  // For ESLint
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ```

### Deployment Verification

After push to `main`, verify deployment:

1. Check GitHub Actions: https://github.com/techs-targe/pdfmark/actions
2. Wait for green checkmark (usually 1-2 minutes)
3. Access GitHub Pages: https://techs-targe.github.io/pdfmark/

## Key Implementation Notes

1. **All code and comments must be in English** for GitHub publication
2. Annotations must be non-destructive (separate layer from PDF)
3. Support touch devices for tablet handwriting
4. Maintain 60fps for smooth annotation drawing
5. Browser support: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+