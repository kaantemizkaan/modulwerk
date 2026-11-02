// ========================================================
// COMMAND BAR COMPONENT (SEARCH, STATUS SEGMENTS, RESET)
// ========================================================

import { state, notifySubscribers } from '../state.js';
import { syncDropdownUI } from './dropdown.js';

export function initCommandBar() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      updateCommandBarUI();
      notifySubscribers();
    });
  }

  // Segmented Status Buttons
  document.querySelectorAll('#statusFilterGroup .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filterStatus = btn.dataset.status;
      updateCommandBarUI();
      notifySubscribers();
    });
  });

  // Global Keyboard Hint for search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });
}

export function setStatus(s) {
  state.filterStatus = s;
  updateCommandBarUI();
  notifySubscribers();
}

export function resetAllFilters() {
  state.filterStatus = 'all';
  state.filterType = 'all';
  state.filterSubject = 'all';
  state.filterCategory = 'all';
  state.searchQuery = '';

  const sInput = document.getElementById('searchInput');
  if (sInput) sInput.value = '';

  updateCommandBarUI();
  notifySubscribers();
}

export function updateCommandBarUI() {
  // Update Segmented Status Active State
  document.querySelectorAll('#statusFilterGroup .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.status === state.filterStatus);
  });

  // Update Status Counts
  const cntAll = state.tasks.length;
  const cntTodo = state.tasks.filter(t => !t.completed).length;
  const cntDone = state.tasks.filter(t => t.completed).length;

  const elAll = document.getElementById('cnt-all');
  if (elAll) elAll.textContent = cntAll;
  const elTodo = document.getElementById('cnt-todo');
  if (elTodo) elTodo.textContent = cntTodo;
  const elDone = document.getElementById('cnt-done');
  if (elDone) elDone.textContent = cntDone;

  // Sync Dropdown triggers
  syncDropdownUI();

  // Reset Button Visibility
  const btnReset = document.getElementById('btnResetFilters');
  if (btnReset) {
    const hasActiveFilter = state.filterStatus !== 'all' || 
                            state.filterType !== 'all' || 
                            state.filterSubject !== 'all' || 
                            state.filterCategory !== 'all' || 
                            (state.searchQuery && state.searchQuery.length > 0);
    btnReset.style.display = hasActiveFilter ? 'inline-flex' : 'none';
  }

  // Tree View Actions Bar Visibility
  const treeActionsBar = document.getElementById('treeActionsBar');
  if (treeActionsBar) {
    treeActionsBar.classList.toggle('visible', state.viewMode === 'tree');
  }
}
