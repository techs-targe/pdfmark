import { StorageData, Annotation } from '../types';

const STORAGE_KEY = 'pdfmark_data';
const STORAGE_VERSION = '1.0.0';

export class StorageManager {
  private static instance: StorageManager;
  private autoSaveTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  // Save data to localStorage
  save(data: StorageData): void {
    try {
      const dataWithVersion = { ...data, version: STORAGE_VERSION };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataWithVersion));
    } catch (error) {
      console.error('Failed to save data to localStorage:', error);
    }
  }

  // Load data from localStorage
  load(): StorageData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const data = JSON.parse(stored) as StorageData;
      
      // Check version compatibility
      if (data.version !== STORAGE_VERSION) {
        console.warn('Storage version mismatch, migration may be needed');
      }

      return data;
    } catch (error) {
      console.error('Failed to load data from localStorage:', error);
      return null;
    }
  }

  // Clear storage
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Auto-save with debouncing
  autoSave(data: StorageData, delay: number = 5000): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    this.autoSaveTimer = setTimeout(() => {
      this.save(data);
      console.log('Auto-saved annotations');
    }, delay);
  }

  // Export data as JSON file
  exportToFile(data: StorageData): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pdfmark-annotations-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Import data from JSON file
  async importFromFile(file: File): Promise<StorageData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string) as StorageData;
          
          // Validate imported data structure
          if (!data.version || !data.annotations || !data.pdfInfo) {
            throw new Error('Invalid data format');
          }
          
          resolve(data);
        } catch (error) {
          reject(new Error('Failed to parse imported file'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }

  // Generate file hash for PDF identification
  async generateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  // Save annotations for specific page
  savePageAnnotations(pageNumber: number, annotations: Annotation[]): void {
    const data = this.load();
    if (!data) return;

    data.annotations[`page_${pageNumber}`] = annotations;
    this.save(data);
  }

  // Load annotations for specific page
  loadPageAnnotations(pageNumber: number): Annotation[] {
    const data = this.load();
    if (!data) return [];

    return data.annotations[`page_${pageNumber}`] || [];
  }
}