// ========================================================
// API CLIENT (SERVER COMMUNICATION)
// ========================================================

import { readFileAsBase64 } from './utils.js';

/**
 * Fetch all tasks and ignored tasks from the backend
 */
export async function fetchTasks() {
  const res = await fetch('/api/tasks');
  if (!res.ok) throw new Error('Fehler beim Laden der Aufgaben');
  return await res.json();
}

/**
 * Toggle completed status of a task
 */
export async function toggleTaskStatus(id) {
  const res = await fetch('/api/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error('Status konnte nicht aktualisiert werden');
  return await res.json();
}

/**
 * Toggle mandatory / optional status of a task
 */
export async function toggleTaskOptional(id) {
  const res = await fetch('/api/toggle-optional', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error('Pflichtstatus konnte nicht aktualisiert werden');
  return await res.json();
}

/**
 * Save user note on a task
 */
export async function saveTaskNote(id, notes) {
  const res = await fetch('/api/note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, notes })
  });
  if (!res.ok) throw new Error('Notiz konnte nicht gespeichert werden');
  return await res.json();
}

/**
 * Delete task (logical ignore or permanent disk removal)
 */
export async function deleteTask(id, deleteFromDisk = false) {
  const res = await fetch('/api/delete-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, deleteFromDisk })
  });
  if (!res.ok) throw new Error('Löschen fehlgeschlagen');
  return await res.json();
}

/**
 * Restore an ignored task
 */
export async function restoreTask(id) {
  const res = await fetch('/api/restore-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error('Wiederherstellung fehlgeschlagen');
  return await res.json();
}

/**
 * Trigger filesystem rescan on the server
 */
export async function rescanWorkspace() {
  const res = await fetch('/api/rescan', { method: 'POST' });
  if (!res.ok) throw new Error('Scan fehlgeschlagen');
  return await res.json();
}

/**
 * Open folder in local OS file explorer
 */
export async function openFolderInExplorer(path, id = null) {
  const res = await fetch('/api/open-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, id })
  });
  if (!res.ok) throw new Error('Ordner konnte nicht geöffnet werden');
  return await res.json();
}

/**
 * Upload a file with optional target task or matrix slot parameters
 */
export async function uploadFile(file, targetTaskId = null, isSolution = false, targetSubject = null, targetSheet = null, targetCategory = null) {
  const base64 = await readFileAsBase64(file);
  const payload = {
    filename: file.name,
    dataBase64: base64,
    targetTaskId,
    isSolution,
    targetSubject,
    targetSheet,
    targetCategory
  };

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Upload fehlgeschlagen');
  }
  return data;
}

/**
 * Fetch normalization preview candidates
 */
export async function fetchNormalizePreview() {
  const res = await fetch('/api/normalize-preview');
  if (!res.ok) throw new Error('Normalisierungs-Vorschau fehlgeschlagen');
  return await res.json();
}

/**
 * Execute renaming of selected candidate items
 */
export async function executeNormalize(items) {
  const res = await fetch('/api/normalize-execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!res.ok) throw new Error('Umbenennung fehlgeschlagen');
  return await res.json();
}

/**
 * Create a custom task manually
 */
export async function createCustomTask(payload) {
  const res = await fetch('/api/add-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Aufgabe konnte nicht erstellt werden');
  return await res.json();
}
