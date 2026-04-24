import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '@/src/types';

const STORAGE_KEY = 'nexuscode_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  username:    '',
  displayName: '',
  avatarUrl:   '',
  editorTheme: 'vs-dark',
  fontSize:    13,
  tabSize:     2,
  showCursors: true,
  liveSync:    true,
};

/** Load settings from localStorage, merging with defaults */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persist settings to localStorage */
export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** React hook — returns [settings, updateSettings] */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  // Persist on every change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return [settings, updateSettings] as const;
}
