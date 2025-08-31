# PDFMark Deployment Guide

## ✅ Completed Steps

1. **Git Repository Initialized** ✓
   - Configured user: techs-targe
   - Email: techs.targe@gmail.com
   - Branch: main

2. **Initial Commit Created** ✓
   - All source files committed
   - CLAUDE.md documentation included
   - .gitignore configured

3. **Release Tag Created** ✓
   - Tag: v1.0.0
   - Ready for release

4. **GitHub Pages Configuration** ✓
   - GitHub Actions workflow added (.github/workflows/deploy.yml)
   - Vite base path configured (/pdfmark/)
   - Auto-deployment on push to main

## 📋 Manual Steps Required

### 1. Push to GitHub

Due to authentication requirements, you need to push manually:

```bash
# Option A: Using GitHub Personal Access Token
git remote set-url origin https://YOUR_TOKEN@github.com/techs-targe/pdfmark.git
git push -u origin main
git push --tags

# Option B: Using SSH
git remote set-url origin git@github.com:techs-targe/pdfmark.git
git push -u origin main
git push --tags
```

### 2. Enable GitHub Pages

1. Go to: https://github.com/techs-targe/pdfmark/settings/pages
2. Under "Build and deployment":
   - Source: Select "GitHub Actions"
3. The workflow will automatically run on push

### 3. Access Your Site

After deployment completes, your site will be available at:
```
https://techs-targe.github.io/pdfmark/
```

## 🚀 Future Deployments

Any push to the `main` branch will automatically trigger deployment.

```bash
# Make changes
git add .
git commit -m "Your changes"
git push
```

## 📦 Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🏷️ Creating New Releases

```bash
# Create a new tag
git tag -a v1.1.0 -m "Release description"

# Push the tag
git push --tags
```

## 📝 Notes

- The app uses `/pdfmark/` as base path for GitHub Pages
- PDF files are processed locally (no server upload)
- All annotations are saved in browser's LocalStorage
- Maximum PDF size: 50MB