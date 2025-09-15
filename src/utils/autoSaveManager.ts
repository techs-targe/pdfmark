import {
  AutoSaveEntry,
  AutoSaveConfig,
  DEFAULT_AUTO_SAVE_CONFIG,
  Annotation,
  Tab
} from '../types';

interface AutoSaveDB extends IDBDatabase {
  // Extend IDBDatabase with our schema
}

export class AutoSaveManager {
  private static instance: AutoSaveManager;
  private db: AutoSaveDB | null = null;
  private config: AutoSaveConfig = DEFAULT_AUTO_SAVE_CONFIG;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private lastAnnotationHash: string = '';
  private isInitialized: boolean = false;

  private readonly DB_NAME = 'PDFMarkAutoSave';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'autoSaves';

  private constructor() {}

  static getInstance(): AutoSaveManager {
    if (!AutoSaveManager.instance) {
      AutoSaveManager.instance = new AutoSaveManager();
    }
    return AutoSaveManager.instance;
  }

  // Initialize IndexedDB
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB for auto-save:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result as AutoSaveDB;
        this.isInitialized = true;
        console.log('📁 AutoSaveManager: IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = () => {
        const db = request.result;

        // Create auto-saves store if it doesn't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });

          // Create indices for efficient querying
          store.createIndex('fileHash', 'fileHash', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('fileName', 'fileName', { unique: false });

          console.log('📁 AutoSaveManager: Created IndexedDB schema');
        }
      };
    });
  }

  // Configure auto-save settings
  configure(config: Partial<AutoSaveConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('⚙️ AutoSaveManager: Configuration updated', this.config);

    // Restart auto-save timer with new interval
    if (this.autoSaveTimer) {
      this.stopAutoSave();
      this.startAutoSave();
    }
  }

  // Generate hash for annotations to detect changes
  private generateAnnotationHash(annotations: Record<string, Annotation[]>): string {
    const sortedData = Object.keys(annotations)
      .sort()
      .map(key => ({
        page: key,
        annotations: annotations[key].map(ann => ({
          id: ann.id,
          type: ann.type,
          timestamp: ann.timestamp
        }))
      }));

    return btoa(JSON.stringify(sortedData));
  }

  // Generate unique ID for auto-save entry
  private generateAutoSaveId(fileHash: string): string {
    const timestamp = Date.now();
    return `autosave_${fileHash}_${timestamp}`;
  }

  // Calculate annotation count across all pages
  private calculateAnnotationCount(annotations: Record<string, Annotation[]>): number {
    return Object.values(annotations).reduce((total, pageAnnotations) => {
      return total + pageAnnotations.length;
    }, 0);
  }

  // Save auto-save entry to IndexedDB
  async saveAutoSave(
    fileHash: string,
    fileName: string,
    annotations: Record<string, Annotation[]>,
    tabs: Tab[]
  ): Promise<void> {
    if (!this.db || !this.config.enabled) return;

    try {
      const annotationHash = this.generateAnnotationHash(annotations);

      // Check if annotations have changed
      if (annotationHash === this.lastAnnotationHash) {
        console.log('📝 AutoSaveManager: No changes detected, skipping auto-save');
        return;
      }

      const autoSaveEntry: AutoSaveEntry = {
        id: this.generateAutoSaveId(fileHash),
        fileHash,
        fileName,
        timestamp: Date.now(),
        annotations,
        tabs,
        annotationCount: this.calculateAnnotationCount(annotations),
        lastModified: Date.now()
      };

      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.put(autoSaveEntry);
        request.onsuccess = () => {
          this.lastAnnotationHash = annotationHash;
          console.log(`💾 AutoSaveManager: Auto-saved ${autoSaveEntry.annotationCount} annotations for ${fileName}`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });

      // Clean up old auto-saves after successful save
      await this.cleanupOldAutoSaves(fileHash);

    } catch (error) {
      console.error('❌ AutoSaveManager: Failed to save auto-save entry:', error);
    }
  }

  // Find auto-save entries for a specific file
  async findAutoSavesForFile(fileHash: string): Promise<AutoSaveEntry[]> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) return [];

    try {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('fileHash');

      return new Promise((resolve, reject) => {
        const request = index.getAll(fileHash);
        request.onsuccess = () => {
          const entries = request.result as AutoSaveEntry[];
          // Sort by timestamp descending (newest first)
          entries.sort((a, b) => b.timestamp - a.timestamp);
          resolve(entries);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('❌ AutoSaveManager: Failed to find auto-saves for file:', error);
      return [];
    }
  }

  // Get the most recent auto-save for a file
  async getLatestAutoSave(fileHash: string): Promise<AutoSaveEntry | null> {
    const autoSaves = await this.findAutoSavesForFile(fileHash);
    return autoSaves.length > 0 ? autoSaves[0] : null;
  }

  // Delete a specific auto-save entry
  async deleteAutoSave(autoSaveId: string): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(autoSaveId);
        request.onsuccess = () => {
          console.log(`🗑️ AutoSaveManager: Deleted auto-save ${autoSaveId}`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('❌ AutoSaveManager: Failed to delete auto-save:', error);
    }
  }

  // Clean up old auto-saves based on config
  private async cleanupOldAutoSaves(fileHash: string): Promise<void> {
    if (!this.db) return;

    try {
      const autoSaves = await this.findAutoSavesForFile(fileHash);
      const now = Date.now();
      const retentionThreshold = now - (this.config.retentionDays * 24 * 60 * 60 * 1000);

      // Keep only the most recent maxAutoSaves entries and delete those older than retention days
      const toDelete = autoSaves.filter((entry, index) => {
        return index >= this.config.maxAutoSaves || entry.timestamp < retentionThreshold;
      });

      for (const entry of toDelete) {
        await this.deleteAutoSave(entry.id);
      }

      if (toDelete.length > 0) {
        console.log(`🧹 AutoSaveManager: Cleaned up ${toDelete.length} old auto-saves for ${fileHash}`);
      }
    } catch (error) {
      console.error('❌ AutoSaveManager: Failed to cleanup old auto-saves:', error);
    }
  }

  // Start automatic saving
  startAutoSave(): void {
    if (!this.config.enabled || this.autoSaveTimer) return;

    this.autoSaveTimer = setInterval(() => {
      // Auto-save will be triggered by the app calling saveAutoSave
      console.log('⏰ AutoSaveManager: Auto-save timer tick');
    }, this.config.interval);

    console.log(`🚀 AutoSaveManager: Auto-save started with ${this.config.interval}ms interval`);
  }

  // Stop automatic saving
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log('⏹️ AutoSaveManager: Auto-save stopped');
    }
  }

  // Check if auto-save should be triggered (called by app)
  shouldTriggerAutoSave(annotations: Record<string, Annotation[]>): boolean {
    if (!this.config.enabled) return false;

    const currentHash = this.generateAnnotationHash(annotations);
    return currentHash !== this.lastAnnotationHash;
  }

  // Get auto-save configuration
  getConfig(): AutoSaveConfig {
    return { ...this.config };
  }

  // Clean up resources
  destroy(): void {
    this.stopAutoSave();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.isInitialized = false;
    console.log('🗂️ AutoSaveManager: Destroyed');
  }
}

// Export singleton instance
export const autoSaveManager = AutoSaveManager.getInstance();