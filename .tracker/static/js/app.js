// ========================================================
// LMU INFORMATIK HOMEWORK TRACKER - MAIN ES MODULE APP
// ========================================================

import {
  state,
  standardModules,
  getFilteredTasks,
  getActiveModules,
  getStats,
  subscribe,
  notifySubscribers,
  showToast
} from './state.js';

import * as api from './api.js';
import { esc } from './utils.js';

import {
  initCommandBar,
  setStatus,
  resetAllFilters,
  updateCommandBarUI
} from './components/command-bar.js';

import {
  initDropdowns,
  toggleDropdown,
  selectDropdown
} from './components/dropdown.js';

import {
  openModal,
  closeModal,
  createCustomTaskAction,
  openDeleteModal,
  closeDeleteModal,
  executeDeleteTaskAction,
  openIgnoredModal,
  closeIgnoredModal,
  restoreTaskAction,
  checkNormalizeCandidates,
  openNormalizeModal,
  closeNormalizeModal,
  toggleNormalizeCandidate,
  toggleAllNormalizeCandidates,
  executeNormalizeAction,
  toggleNoteDrawer
} from './components/modals.js';

import { renderListView } from './views/list-view.js';
import { renderTreeView, toggleTreeNode, expandAllTree, collapseAllTree } from './views/tree-view.js';
import {
  renderMatrixView,
  triggerMatrixSlotPicker,
  handleMatrixPickedFile,
  handleMatrixSlotDragOver,
  handleMatrixSlotDragLeave,
  handleMatrixSlotDrop
} from './views/matrix-view.js';

// ========================================================
// CORE TASK ACTIONS
// ========================================================

async function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  t.manual_status = t.completed;
  notifySubscribers();

  if (state.isOnline) {
    try {
      await api.toggleTaskStatus(id);
      showToast(t.completed ? 'Als erledigt markiert' : 'Als ausstehend markiert');
    } catch {
      showToast('Verbindungsfehler beim Status-Update');
    }
  } else {
    localStorage.setItem('lmu_tasks_de_v2', JSON.stringify(state.tasks));
  }
}

async function toggleOptional(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.is_optional = !t.is_optional;
  notifySubscribers();

  if (state.isOnline) {
    try {
      await api.toggleTaskOptional(id);
      showToast(t.is_optional ? 'Als freiwillige Übung markiert' : 'Als Pflichtaufgabe markiert');
    } catch {
      showToast('Verbindungsfehler beim Pflicht-Update');
    }
  } else {
    localStorage.setItem('lmu_tasks_de_v2', JSON.stringify(state.tasks));
    showToast(t.is_optional ? 'Als freiwillig markiert' : 'Als Pflichtaufgabe markiert');
  }
}

function openTaskFile(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  if (t.is_folder) {
    openTaskFolder(id);
    return;
  }
  if (state.isOnline) {
    window.open('/file?id=' + encodeURIComponent(id), '_blank');
  } else {
    showToast('Datei kann nur bei aktiver Serververbindung direkt geöffnet werden.');
  }
}

function openTaskSolution(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t || !t.solution_path) return;
  if (state.isOnline) {
    window.open('/file?id=' + encodeURIComponent(id) + '&type=solution', '_blank');
  } else {
    showToast('Lösung kann nur bei aktiver Serververbindung direkt geöffnet werden.');
  }
}

async function openTaskFolder(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  if (!state.isOnline) {
    showToast('Server nicht erreichbar');
    return;
  }
  try {
    await api.openFolderInExplorer(t.file_path, id);
    showToast('Im Explorer geöffnet');
  } catch {
    showToast('Ordner konnte nicht geöffnet werden');
  }
}

async function saveNote(id, text) {
  const val = text.trim();
  const t = state.tasks.find(x => x.id === id);
  if (t) t.notes = val;

  if (state.isOnline) {
    try {
      await api.saveTaskNote(id, val);
      showToast('Notiz gespeichert');
    } catch {}
  } else {
    localStorage.setItem('lmu_tasks_de_v2', JSON.stringify(state.tasks));
  }
}

function triggerSolutionPicker(taskId) {
  state.currentSolutionTaskId = taskId;
  const input = document.getElementById('hiddenSolutionPicker');
  if (input) {
    input.value = '';
    input.click();
  }
}

async function handleSolutionFileSelect(event) {
  const files = event.target.files;
  if (!files || files.length === 0 || !state.currentSolutionTaskId) return;
  const file = files[0];
  const tId = state.currentSolutionTaskId;
  state.currentSolutionTaskId = null;
  await uploadFileToServer(file, tId, true);
}

function handleCardDragOver(event, taskId) {
  event.preventDefault();
  event.stopPropagation();
  const el = document.getElementById('sol-box-' + taskId);
  if (el) el.classList.add('drag-over');
}

function handleCardDragLeave(event, taskId) {
  event.preventDefault();
  event.stopPropagation();
  const el = document.getElementById('sol-box-' + taskId);
  if (el) el.classList.remove('drag-over');
}

async function handleCardDrop(event, taskId, isSolution) {
  event.preventDefault();
  event.stopPropagation();
  const el = document.getElementById('sol-box-' + taskId);
  if (el) el.classList.remove('drag-over');

  if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0];
    await uploadFileToServer(file, taskId, isSolution);
  }
}

async function uploadFileToServer(file, targetTaskId = null, isSolution = false) {
  if (!state.isOnline) {
    showToast('Upload erfordert aktiven Modulwerk-Server (Modulwerk.bat).');
    return;
  }

  showToast(`Lade ${file.name} hoch...`);

  try {
    const result = await api.uploadFile(file, targetTaskId, isSolution);
    if (result.data && result.data.tasks) {
      state.tasks = result.data.tasks;
      state.ignoredTasks = Array.isArray(result.data.ignored_tasks) ? result.data.ignored_tasks : (result.data.ignored_tasks ? [result.data.ignored_tasks] : []);
      notifySubscribers();
    } else {
      await loadTasks();
    }
    showToast(`✓ ${result.message || 'Datei erfolgreich gespeichert!'}`);
    checkNormalizeCandidates();
  } catch (err) {
    showToast(`Upload-Fehler: ${err.message}`);
  }
}

async function triggerRescan() {
  if (!state.isOnline) {
    showToast('Server nicht aktiv');
    return;
  }
  const scanIcon = document.getElementById('scanIcon');
  if (scanIcon) scanIcon.classList.add('spinning');
  try {
    const payload = await api.rescanWorkspace();
    state.tasks = payload.data.tasks || [];
    state.ignoredTasks = Array.isArray(payload.data.ignored_tasks) ? payload.data.ignored_tasks : (payload.data.ignored_tasks ? [payload.data.ignored_tasks] : []);
    notifySubscribers();
    checkNormalizeCandidates();
    showToast('Verzeichnis aktualisiert');
  } catch {
    showToast('Scan fehlgeschlagen');
  } finally {
    if (scanIcon) setTimeout(() => scanIcon.classList.remove('spinning'), 500);
  }
}

function setViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem('lmu_view_mode', mode);
  updateViewModeButtons();
  notifySubscribers();
}

function updateViewModeButtons() {
  document.querySelectorAll('#viewModeGroup .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === state.viewMode);
  });
  const treeBar = document.getElementById('treeActionsBar');
  if (treeBar) {
    treeBar.classList.toggle('visible', state.viewMode === 'tree');
  }
}

function setSubject(s) {
  state.filterSubject = (state.filterSubject === s) ? 'all' : s;
  notifySubscribers();
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('lmu_theme', next);
  state.theme = next;
}

function updateSyncBadge(online) {
  state.isOnline = online;
  const el = document.getElementById('syncStatus');
  const txt = document.getElementById('syncText');
  if (!el || !txt) return;
  if (online) {
    el.classList.remove('offline');
    txt.textContent = 'Synchronisiert';
  } else {
    el.classList.add('offline');
    txt.textContent = 'Lokaler Modus';
  }
}

async function loadTasks(isBackground = false) {
  try {
    const data = await api.fetchTasks();
    state.tasks = data.tasks || [];
    state.ignoredTasks = Array.isArray(data.ignored_tasks) ? data.ignored_tasks : (data.ignored_tasks ? [data.ignored_tasks] : []);
    updateSyncBadge(true);
    notifySubscribers();
    if (!isBackground) checkNormalizeCandidates();
    return;
  } catch (e) {
    // Offline or server not yet ready
  }

  updateSyncBadge(false);
  const cached = localStorage.getItem('lmu_tasks_de_v2');
  if (cached) {
    try { state.tasks = JSON.parse(cached); } catch {}
  }
  notifySubscribers();
}

// ========================================================
// GLOBAL EVENT HANDLERS (DRAG & DROP, SHORTCUTS)
// ========================================================

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
      closeIgnoredModal();
      closeNormalizeModal();
      const overlay = document.getElementById('dropOverlay');
      if (overlay) overlay.classList.remove('active');
    }
  });
}

function setupGlobalDragAndDrop() {
  let dragCounter = 0;
  const overlay = document.getElementById('dropOverlay');
  if (!overlay) return;

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      overlay.classList.add('active');
    }
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      overlay.classList.remove('active');
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.remove('active');

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await uploadFileToServer(file, null, false);
    }
  });
}

// ========================================================
// RENDER DISPATCHER
// ========================================================

export function render() {
  // 1. Calculate and update stats strip
  const stats = getStats();

  const elPct = document.getElementById('statPct');
  if (elPct) elPct.textContent = stats.pct + '%';

  const elFraction = document.getElementById('statFraction');
  if (elFraction) elFraction.textContent = `${stats.mandDone} von ${stats.mandTasks} Pflichtaufgaben erledigt`;

  const elOptFraction = document.getElementById('statOptFraction');
  if (elOptFraction) elOptFraction.textContent = `(+ ${stats.optDone} von ${stats.optTasks} freiwilligen Übungen)`;

  // Dynamic progress bar
  const progressFill = document.getElementById('progressFill');
  if (progressFill) {
    progressFill.style.width = stats.pct + '%';
    if (stats.pct >= 80) {
      progressFill.style.background = 'linear-gradient(90deg, #009640, #10b981)';
    } else if (stats.pct >= 40) {
      progressFill.style.background = 'linear-gradient(90deg, #d97706, #f59e0b)';
    } else {
      progressFill.style.background = 'linear-gradient(90deg, #dc2626, #f87171)';
    }
  }

  // 2. Command bar counts and filter UI sync
  updateCommandBarUI();

  // 3. Ignored Button Visibility
  const btnIgn = document.getElementById('btnIgnored');
  const cntIgn = document.getElementById('cnt-ignored');
  if (btnIgn && cntIgn) {
    if (state.ignoredTasks && state.ignoredTasks.length > 0) {
      btnIgn.style.display = 'inline-flex';
      cntIgn.textContent = state.ignoredTasks.length;
    } else {
      btnIgn.style.display = 'none';
    }
  }

  // 4. Module chips in Top Summary Strip
  const modClasses = {
    'Analysis': 'analysis',
    'EiP': 'eip',
    'Lineare Algebra': 'linalg',
    'Statistik': 'statistik'
  };

  const moduleStatsEl = document.getElementById('moduleStats');
  if (moduleStatsEl) {
    moduleStatsEl.innerHTML = standardModules.map(m => {
      const cls = modClasses[m] || 'analysis';
      const mTasks = state.tasks.filter(t => t.subject === m);
      const mMandTasks = mTasks.filter(t => !t.is_optional);
      const mMandDone = mMandTasks.filter(t => t.completed).length;
      const mPct = mMandTasks.length ? Math.round((mMandDone / mMandTasks.length) * 100) : 0;
      const isAct = state.filterSubject === m;

      return `
        <span class="module-stat-chip ${cls} ${isAct ? 'active' : ''}" onclick="window.appActions.setSubject('${m}')" title="${m}: ${mMandDone}/${mMandTasks.length} Pflichtaufgaben (${mPct}%) ${isAct ? '· Filter aktiv' : '· Klicken zum Filtern'}">
          <span class="mod-dot ${cls}"></span>
          <span class="mod-name">${m}</span>
          <strong class="mod-fraction">${mMandDone}/${mMandTasks.length}</strong>
        </span>
      `;
    }).join('');
  }

  // 5. Filter tasks
  const filtered = getFilteredTasks();
  const container = document.getElementById('viewContainer');
  const emptyEl = document.getElementById('emptyState');

  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  // 6. View delegation
  if (state.viewMode === 'tree') {
    container.innerHTML = renderTreeView(filtered, standardModules);
  } else if (state.viewMode === 'matrix') {
    container.innerHTML = renderMatrixView(filtered, standardModules);
  } else {
    container.innerHTML = renderListView(filtered, standardModules);
  }
}

// ========================================================
// GLOBAL BINDINGS (window.appActions)
// ========================================================

window.appActions = {
  toggleTask,
  toggleOptional,
  openTaskFile,
  openTaskSolution,
  openTaskFolder,
  saveNote,
  triggerSolutionPicker,
  handleSolutionFileSelect,
  handleCardDragOver,
  handleCardDragLeave,
  handleCardDrop,
  toggleNoteDrawer,
  promptDeleteTask: openDeleteModal,
  openDeleteModal,
  closeDeleteModal,
  executeDeleteTask: executeDeleteTaskAction,
  openIgnoredModal,
  closeIgnoredModal,
  restoreTask: restoreTaskAction,
  openNormalizeModal,
  closeNormalizeModal,
  toggleNormalizeCandidate,
  toggleAllNormalizeCandidates,
  executeNormalize: executeNormalizeAction,
  triggerMatrixSlotPicker,
  handleMatrixPickedFile,
  handleMatrixSlotDragOver,
  handleMatrixSlotDragLeave,
  handleMatrixSlotDrop,
  setSubject,
  setStatus,
  setViewMode,
  toggleTheme,
  triggerRescan,
  openModal,
  closeModal,
  createCustomTask: createCustomTaskAction,
  expandAllTree,
  collapseAllTree,
  toggleTreeNode,
  resetAllFilters,
  toggleDropdown,
  selectDropdown,
  onSearch: () => {
    const sInput = document.getElementById('searchInput');
    if (sInput) {
      state.searchQuery = sInput.value.trim().toLowerCase();
      updateCommandBarUI();
      notifySubscribers();
    }
  }
};

// Mirror all actions directly on global window for inline HTML onclick/onchange handlers
Object.assign(window, window.appActions);

// ========================================================
// APP INITIALIZATION
// ========================================================

export async function init() {
  const savedTheme = localStorage.getItem('lmu_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  state.theme = savedTheme;

  state.viewMode = localStorage.getItem('lmu_view_mode') || 'list';
  updateViewModeButtons();

  initCommandBar();
  initDropdowns();
  setupKeyboardShortcuts();
  setupGlobalDragAndDrop();

  // Attach input event for solution file picker
  const solPicker = document.getElementById('hiddenSolutionPicker');
  if (solPicker) {
    solPicker.addEventListener('change', handleSolutionFileSelect);
  }

  // Attach input event for matrix slot file picker
  const matPicker = document.getElementById('hiddenMatrixPicker');
  if (matPicker) {
    matPicker.addEventListener('change', handleMatrixPickedFile);
  }

  // Attach view mode segmented buttons
  document.querySelectorAll('#viewModeGroup .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setViewMode(btn.dataset.view);
    });
  });

  // Subscribe main render to reactive store
  subscribe(render);

  // Initial load
  await loadTasks();

  // Background polling every 4.5 seconds
  setInterval(() => {
    if (state.isOnline && document.visibilityState === 'visible') {
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      if (activeTag !== 'TEXTAREA' && activeTag !== 'INPUT') {
        loadTasks(true);
      }
    }
  }, 4500);
}

// Auto-boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
