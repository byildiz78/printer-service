import fs from 'fs';
import path from 'path';
import { AppSettings } from '@/types';

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  PRINTER_API_URL: '',
  PRINTER_IP: '192.168.2.214',
  PRINTER_PORT: 9100,
};

export function loadSettings(): AppSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      // Create settings file with defaults
      saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }

    const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const settings = JSON.parse(data) as AppSettings;

    // Validate and merge with defaults
    return {
      PRINTER_API_URL: settings.PRINTER_API_URL || '',
      PRINTER_IP: settings.PRINTER_IP || DEFAULT_SETTINGS.PRINTER_IP,
      PRINTER_PORT: settings.PRINTER_PORT || DEFAULT_SETTINGS.PRINTER_PORT,
    };
  } catch (error) {
    console.error('Settings load error:', error);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): boolean {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Settings save error:', error);
    return false;
  }
}

export function isSettingsConfigured(): boolean {
  const settings = loadSettings();
  return settings.PRINTER_API_URL.trim() !== '';
}
