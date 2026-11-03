/**
 * Autosave to localStorage. Everything stays in this browser; nothing is
 * sent anywhere. Storage can be unavailable (private mode, blocked site data),
 * so every access is guarded and failures are reported, never thrown.
 */
import { parseProject, serializeProject } from '../io/project';
import type { Score } from '../model/types';

const KEY = 'clefhanger:autosave:v1';
const NAME_KEY = 'clefhanger:autosave-name:v1';

export function loadAutosave(): { score: Score; fileName: string | null } | null {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    return { score: parseProject(text), fileName: localStorage.getItem(NAME_KEY) };
  } catch {
    return null;
  }
}

export function writeAutosave(score: Score, fileName: string | null): boolean {
  try {
    localStorage.setItem(KEY, serializeProject(score));
    if (fileName) localStorage.setItem(NAME_KEY, fileName);
    else localStorage.removeItem(NAME_KEY);
    return true;
  } catch {
    return false;
  }
}

export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(`clefhanger:${key}`);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(`clefhanger:${key}`, value);
  } catch {
    // Preferences are a convenience; ignore storage failures.
  }
}
