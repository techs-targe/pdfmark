# PDFMark - Study PDF Viewer with Annotations

A web-based PDF viewer with non-destructive annotation capabilities, designed for study purposes such as IPA exams and educational materials.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9%2B-blue)
![React](https://img.shields.io/badge/React-18.3-61DAFB)

## Features

### Core Functionality
- 📄 **PDF Viewing** - High-quality PDF rendering using PDF.js
- ✏️ **Non-destructive Annotations** - Draw over PDFs without modifying the original file
- 💾 **Auto-save** - Annotations automatically saved to browser storage
- 📥 **Export/Import** - Save and share annotations as JSON files
- ⌨️ **Keyboard Shortcuts** - Efficient workflow with hotkeys

### Drawing Tools
- **Pen Tool** - Freehand drawing with customizable colors and line widths
- **Line Tool** - Draw straight lines with preview
- **Text Tool** - Add text annotations at any position
- **Eraser Tool** - Remove annotations with adjustable eraser sizes

### Advanced Features
- 🔍 **Zoom Controls** - Multiple zoom levels including fit-to-width and fit-to-page
- ↩️ **Undo/Redo** - Up to 50 operations history
- 🎨 **Color Presets** - 8 preset colors plus custom color picker
- 📱 **Touch Support** - Works on tablets for handwritten notes

## Installation

### Prerequisites
- Node.js 18.0 or higher
- npm 9.0 or higher

### Setup
```bash
# Clone the repository
git clone https://github.com/techs-targe/pdfmark.git
cd pdfmark

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will open at `http://localhost:3000`

## Usage

### Basic Workflow

1. **Load a PDF**
   - Click the folder icon (📂) or drag and drop a PDF file
   - Maximum file size: 50MB
   - Maximum pages: 500

2. **Select a Tool**
   - Press 1-5 or click toolbar icons:
     - `1` or ✏️ - Pen Tool
     - `2` or 🧹 - Eraser Tool
     - `3` or 📝 - Text Tool
     - `4` or 📏 - Line Tool
     - `5` or 👆 - Select Tool

3. **Annotate**
   - Draw directly on the PDF
   - Annotations are saved automatically every 5 seconds

4. **Save/Export**
   - Click 💾 to export annotations as JSON
   - Click 📥 to import previously saved annotations

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open PDF |
| `Ctrl+S` | Save annotations |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `1-5` | Switch tools |
| `←/→` | Previous/Next page |

## Development

### Project Structure
```
pdfmark/
├── src/
│   ├── components/       # React components
│   │   ├── PDFViewer/   # PDF rendering component
│   │   ├── AnnotationLayer/ # Canvas overlay for annotations
│   │   └── Toolbar/     # Tool selection and settings
│   ├── tools/           # Drawing tool implementations
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   └── types/           # TypeScript type definitions
├── public/              # Static assets
└── tmp/                 # Temporary files (git-ignored)
```

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Technical Details

### Technologies Used
- **React 18.3** - UI framework
- **TypeScript** - Type safety
- **PDF.js** - PDF rendering
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Canvas API** - Annotation layer

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Performance
- 60fps annotation drawing
- Efficient canvas rendering
- Debounced auto-save
- Optimized for large PDFs

## Data Storage

### LocalStorage Format
Annotations are stored in browser LocalStorage with the following structure:

```json
{
  "version": "1.0.0",
  "pdfInfo": {
    "fileName": "document.pdf",
    "fileHash": "sha256_hash",
    "totalPages": 100
  },
  "annotations": {
    "page_1": [...],
    "page_2": [...]
  }
}
```

### Privacy
- All processing happens locally in your browser
- No data is sent to external servers
- PDFs and annotations remain private

## Limitations

- Maximum PDF size: 50MB
- Maximum pages: 500
- Maximum annotations per page: 1000
- Concurrent tabs: 10 (when tab feature is implemented)

## Future Enhancements

- [ ] Tab system for multiple PDF views
- [ ] Split screen view
- [ ] Cloud synchronization
- [ ] Collaborative annotations
- [ ] OCR text search
- [ ] Voice notes
- [ ] Annotation categories/tags
- [ ] PDF form filling

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (all code must be in English)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/techs-targe/pdfmark/issues) page.

## Acknowledgments

- PDF.js team for the excellent PDF rendering library
- React team for the robust UI framework
- All contributors and users of this project

---

Made with ❤️ for students and learners worldwide