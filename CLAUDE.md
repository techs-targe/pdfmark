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

## Key Implementation Notes

1. **All code and comments must be in English** for GitHub publication
2. Annotations must be non-destructive (separate layer from PDF)
3. Support touch devices for tablet handwriting
4. Maintain 60fps for smooth annotation drawing
5. Browser support: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+