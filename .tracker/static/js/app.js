// ========================================================
// LMU INFORMATIK HOMEWORK TRACKER - MAIN ES MODULE APP
// ========================================================

import {
  state,
  getActiveModules,
  getModuleColor,
  getFilteredTasks,
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
  toggleNoteDrawer,
  openDueModal,
  closeDueModal,
  setDuePreset,
  saveCustomDueDate,
  clearDueDate,
  openThemeModal,
  closeThemeModal,
  selectThemeMode,
  selectPalette,
  toggleAuroraGlow
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
  state.justToggledTaskId = id;
  notifySubscribers();

  setTimeout(() => {
    if (state.justToggledTaskId === id) {
      state.justToggledTaskId = null;
    }
  }, 450);

  if (state.isOnline) {
    try {
      await api.toggleTaskStatus(id);
      showToast(t.completed ? 'Marked as completed' : 'Marked as pending');
    } catch {
      showToast('Connection error while updating status');
    }
  } else {
    localStorage.setItem('modulwerk_tasks', JSON.stringify(state.tasks));
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
      showToast(t.is_optional ? 'Marked as optional' : 'Marked as required');
    } catch {
      showToast('Connection error while updating requirement');
    }
  } else {
    localStorage.setItem('modulwerk_tasks', JSON.stringify(state.tasks));
    showToast(t.is_optional ? 'Marked as optional' : 'Marked as required');
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
    showToast('Files can only be opened when the Modulwerk server is active.');
  }
}

function openTaskSolution(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t || !t.solution_path) return;
  if (state.isOnline) {
    window.open('/file?id=' + encodeURIComponent(id) + '&type=solution', '_blank');
  } else {
    showToast('Solutions can only be opened when the Modulwerk server is active.');
  }
}

async function openTaskFolder(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  if (!state.isOnline) {
    showToast('Server not reachable');
    return;
  }
  try {
    await api.openFolderInExplorer(t.file_path, id);
    showToast('Opened in file explorer');
  } catch {
    showToast('Could not open folder');
  }
}

async function saveNote(id, text) {
  const val = text.trim();
  const t = state.tasks.find(x => x.id === id);
  if (t) t.notes = val;

  if (state.isOnline) {
    try {
      await api.saveTaskNote(id, val);
      showToast('Note saved');
    } catch {}
  } else {
    localStorage.setItem('modulwerk_tasks', JSON.stringify(state.tasks));
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
    showToast('Upload requires an active Modulwerk server.');
    return;
  }

  showToast(`Uploading ${file.name}...`);

  try {
    const result = await api.uploadFile(file, targetTaskId, isSolution);
    if (result.data && result.data.tasks) {
      state.tasks = result.data.tasks;
      state.ignoredTasks = Array.isArray(result.data.ignored_tasks) ? result.data.ignored_tasks : (result.data.ignored_tasks ? [result.data.ignored_tasks] : []);
      notifySubscribers();
    } else {
      await loadTasks();
    }
    showToast(`✓ ${result.message || 'File saved successfully!'}`);
    checkNormalizeCandidates();
  } catch (err) {
    showToast(`Upload error: ${err.message}`);
  }
}

async function triggerRescan() {
  if (!state.isOnline) {
    showToast('Server not active');
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
    showToast('Workspace refreshed');
  } catch {
    showToast('Scan failed');
  } finally {
    if (scanIcon) setTimeout(() => scanIcon.classList.remove('spinning'), 500);
  }
}

function setViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem('modulwerk_view_mode', mode);
  updateViewModeButtons();
  notifySubscribers();
}

function updateViewModeButtons() {
  document.querySelectorAll('#viewModeGroup .seg-btn, #sidebarViewNav .sidebar-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === state.viewMode);
  });
  const treeBar = document.getElementById('treeActionsBar');
  if (treeBar) {
    treeBar.classList.toggle('visible', state.viewMode === 'tree');
  }
  const layoutContainer = document.getElementById('mainLayoutContainer');
  if (layoutContainer) {
    layoutContainer.classList.toggle('layout-wide', state.viewMode === 'matrix');
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('appSidebar');
  const trigger = document.getElementById('sidebarOpenTrigger');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar) return;

  const isMobile = window.innerWidth <= 860;
  if (isMobile) {
    const isOpen = sidebar.classList.toggle('open-mobile');
    if (backdrop) backdrop.classList.toggle('active', isOpen);
  } else {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('modulwerk_sidebar_v2_collapsed', isCollapsed ? '1' : '0');
    if (trigger) trigger.classList.toggle('visible', isCollapsed);
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
  localStorage.setItem('modulwerk_theme', next);
  state.theme = next;
}

function updateSyncBadge(online) {
  state.isOnline = online;
  const el = document.getElementById('syncStatus');
  const txt = document.getElementById('syncText');
  if (!el || !txt) return;
  if (online) {
    el.classList.remove('offline');
    txt.textContent = 'Synchronized';
  } else {
    el.classList.add('offline');
    txt.textContent = 'Offline Mode';
  }
}

async function loadTasks(isBackground = false) {
  try {
    const data = await api.fetchTasks();
    const newTasks = data.tasks || [];
    const newIgnored = Array.isArray(data.ignored_tasks) ? data.ignored_tasks : (data.ignored_tasks ? [data.ignored_tasks] : []);

    // If background polling, only re-render if data has ACTUALLY changed on disk!
    if (isBackground) {
      const isTasksSame = JSON.stringify(newTasks) === JSON.stringify(state.tasks);
      const isIgnoredSame = JSON.stringify(newIgnored) === JSON.stringify(state.ignoredTasks);
      if (isTasksSame && isIgnoredSame) {
        updateSyncBadge(true);
        return;
      }
    }

    state.tasks = newTasks;
    state.ignoredTasks = newIgnored;
    updateSyncBadge(true);
    localStorage.setItem('modulwerk_tasks', JSON.stringify(state.tasks));
    notifySubscribers();
    if (!isBackground) checkNormalizeCandidates();
    return;
  } catch (e) {
    // Offline or server not yet ready
  }

  updateSyncBadge(false);
  const cached = localStorage.getItem('modulwerk_tasks') || localStorage.getItem('lmu_tasks_de_v2');
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
      closeThemeModal();
      const overlay = document.getElementById('dropOverlay');
      if (overlay) overlay.classList.remove('active');
      const searchInput = document.getElementById('searchInput');
      if (searchInput && document.activeElement === searchInput) {
        searchInput.blur();
      }
    }
    // Toggle Sidebar: Ctrl+B or Cmd+B
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleSidebar();
    }
    // New Task: N (when not inside input/textarea)
    if (e.key.toLowerCase() === 'n' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      openModal();
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
  if (elFraction) elFraction.textContent = `${stats.mandDone}/${stats.mandTasks}`;

  const elOptFraction = document.getElementById('statOptFraction');
  if (elOptFraction) elOptFraction.textContent = `(+ ${stats.optDone} of ${stats.optTasks} optional exercises)`;

  // Milestone Seal
  const sealEl = document.getElementById('statMilestoneSeal');
  if (sealEl) {
    if (stats.mandDone > 0 && stats.mandDone === stats.mandTasks) {
      sealEl.innerHTML = `
        <span class="all-clear-badge" title="All mandatory coursework for the semester is complete!">
          <svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2.5;"><polyline points="20 6 9 17 4 12"/></svg>
          Semester Target Cleared
        </span>
      `;
    } else {
      sealEl.innerHTML = '';
    }
  }

  // Segmented Sparkline Track
  if (stats.total > 0) {
    const wMand = ((stats.mandDone / stats.total) * 100);
    const wOpt = ((stats.optDone / stats.total) * 100);
    const wUrgent = ((stats.urgentCount / stats.total) * 100);
    const wOverdue = ((stats.overdueCount / stats.total) * 100);
    const wPending = Math.max(0, 100 - (wMand + wOpt + wUrgent + wOverdue));

    const segMand = document.getElementById('segDoneMand');
    if (segMand) segMand.style.width = wMand.toFixed(1) + '%';
    const segOpt = document.getElementById('segDoneOpt');
    if (segOpt) segOpt.style.width = wOpt.toFixed(1) + '%';
    const segUrg = document.getElementById('segUrgent');
    if (segUrg) segUrg.style.width = wUrgent.toFixed(1) + '%';
    const segOver = document.getElementById('segOverdue');
    if (segOver) segOver.style.width = wOverdue.toFixed(1) + '%';
    const segPend = document.getElementById('segPending');
    if (segPend) segPend.style.width = wPending.toFixed(1) + '%';

    // Tooltip / Title on hover
    const track = document.getElementById('sparklineTrack');
    if (track) {
      track.title = `${stats.mandDone} Required Done · ${stats.optDone} Optional Done · ${stats.urgentCount} Due Soon · ${stats.overdueCount} Overdue · ${stats.remaining} Remaining (${stats.pct}%)`;
    }

    // Legend Counts
    const lMand = document.getElementById('cntLegendDoneMand');
    if (lMand) lMand.textContent = stats.mandDone;
    const lOpt = document.getElementById('cntLegendDoneOpt');
    if (lOpt) lOpt.textContent = stats.optDone;
    const lUrg = document.getElementById('cntLegendUrgent');
    if (lUrg) lUrg.textContent = stats.urgentCount;
    const lOver = document.getElementById('cntLegendOverdue');
    if (lOver) lOver.textContent = stats.overdueCount;
    const lPend = document.getElementById('cntLegendPending');
    if (lPend) lPend.textContent = stats.remaining;

    const quickStatus = document.getElementById('sparklineQuickStatus');
    if (quickStatus) {
      quickStatus.textContent = stats.overdueCount > 0 ? `${stats.overdueCount} Overdue Action Needed` : (stats.urgentCount > 0 ? `${stats.urgentCount} Due Within 24h` : `On Track · ${stats.pct}% Complete`);
      quickStatus.style.color = stats.overdueCount > 0 ? 'var(--warn)' : (stats.urgentCount > 0 ? '#ea580c' : 'var(--done)');
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

  // 4. Update Header Breadcrumb Title & Active Filter Badge
  const titleEl = document.getElementById('activeViewTitle');
  const badgeEl = document.getElementById('activeFilterBadge');
  if (titleEl) {
    if (state.filterSubject !== 'all') {
      titleEl.textContent = state.filterSubject;
    } else if (state.viewMode === 'matrix') {
      titleEl.textContent = 'Semester Matrix';
    } else if (state.viewMode === 'tree') {
      titleEl.textContent = 'Folder Tree';
    } else {
      titleEl.textContent = state.filterStatus === 'todo' ? 'Pending Tasks' : (state.filterStatus === 'done' ? 'Completed Tasks' : 'All Tasks');
    }
  }
  if (badgeEl) {
    if (state.filterSubject !== 'all') {
      badgeEl.style.display = 'inline-block';
      badgeEl.textContent = state.filterStatus === 'todo' ? 'To Do' : (state.filterStatus === 'done' ? 'Done' : 'All Tasks');
    } else {
      badgeEl.style.display = 'none';
    }
  }

  // 5. Dynamic Module list in Sidebar
  const activeModules = getActiveModules();
  const sbModuleList = document.getElementById('sidebarModuleList');
  const sbResetMod = document.getElementById('sbBtnResetMod');
  if (sbResetMod) {
    sbResetMod.style.display = state.filterSubject !== 'all' ? 'inline-block' : 'none';
  }
  if (sbModuleList) {
    sbModuleList.innerHTML = activeModules.map(m => {
      const col = getModuleColor(m);
      const mTasks = state.tasks.filter(t => t.subject === m);
      const mMandTasks = mTasks.filter(t => !t.is_optional);
      const mMandDone = mMandTasks.filter(t => t.completed).length;
      const isAct = state.filterSubject === m;
      const isCleared = mMandTasks.length > 0 && mMandDone === mMandTasks.length;

      const sparkCount = Math.min(5, mMandTasks.length || 3);
      const filledCount = Math.round((mMandDone / (mMandTasks.length || 1)) * sparkCount);
      let dotsHtml = '';
      for (let i = 0; i < sparkCount; i++) {
        const isFilled = i < filledCount;
        dotsHtml += `<span class="chip-seg ${isFilled ? 'filled' : ''}" style="${isFilled ? `background:${col.color}; color:${col.color};` : ''}"></span>`;
      }

      return `
        <button 
          class="sidebar-mod-item ${isAct ? 'active' : ''}" 
          onclick="window.appActions.setSubject('${m}')"
          title="${m}: ${mMandDone}/${mMandTasks.length} required completed"
        >
          <div class="mod-item-left">
            <span class="mod-dot" style="background:${col.color}; box-shadow:0 0 6px ${col.bg};"></span>
            <span class="mod-item-name">${m}</span>
          </div>
          <div class="mod-item-right">
            <div class="chip-sparkline">${dotsHtml}</div>
            <span class="mod-item-count">${mMandDone}/${mMandTasks.length}</span>
            ${isCleared ? '<span class="all-clear-badge" style="font-size:8px; padding:0 3px;">✓</span>' : ''}
          </div>
        </button>
      `;
    }).join('');
  }

  // 6. Filter tasks
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
    container.innerHTML = renderTreeView(filtered, activeModules);
  } else if (state.viewMode === 'matrix') {
    container.innerHTML = renderMatrixView(filtered, activeModules);
  } else {
    container.innerHTML = renderListView(filtered, activeModules);
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
  toggleSidebar,
  toggleTheme,
  triggerRescan,
  openModal,
  closeModal,
  createCustomTask: createCustomTaskAction,
  openDueModal,
  closeDueModal,
  setDuePreset,
  saveCustomDueDate,
  clearDueDate,
  openThemeModal,
  closeThemeModal,
  selectThemeMode,
  selectPalette,
  toggleAuroraGlow,
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
  const savedTheme = localStorage.getItem('modulwerk_theme') || localStorage.getItem('lmu_theme') || 'dark';
  const savedPalette = localStorage.getItem('modulwerk_palette') || 'emerald';
  const auroraActive = localStorage.getItem('modulwerk_aurora') !== '0';

  document.documentElement.setAttribute('data-theme', savedTheme);
  document.documentElement.setAttribute('data-palette', savedPalette);
  state.theme = savedTheme;

  const bg = document.getElementById('proceduralBg');
  if (bg) bg.style.display = auroraActive ? 'block' : 'none';

  state.viewMode = localStorage.getItem('modulwerk_view_mode') || localStorage.getItem('lmu_view_mode') || 'list';
  updateViewModeButtons();

  // Clear legacy broken state if present
  localStorage.removeItem('modulwerk_sidebar_collapsed');

  // Restore sidebar collapsed state (default is open)
  const isMobile = window.innerWidth <= 860;
  if (!isMobile && localStorage.getItem('modulwerk_sidebar_v2_collapsed') === '1') {
    const sb = document.getElementById('appSidebar');
    const tr = document.getElementById('sidebarOpenTrigger');
    if (sb) sb.classList.add('collapsed');
    if (tr) tr.classList.add('visible');
  }

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
