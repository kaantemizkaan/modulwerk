// ========================================================
// CENTRAL REACTIVE APPLICATION STATE STORE
// ========================================================

const listeners = new Set();

export const state = {
  tasks: [],
  ignoredTasks: [],
  isOnline: false,
  viewMode: localStorage.getItem('lmu_view_mode') || 'list',
  theme: localStorage.getItem('lmu_theme') || 'dark',

  // Filters
  filterStatus: 'all',      // 'all' | 'todo' | 'done'
  filterType: 'all',        // 'all' | 'mandatory' | 'optional'
  filterSubject: 'all',     // 'all' | 'Analysis' | 'EiP' | 'Lineare Algebra' | 'Statistik'
  filterCategory: 'all',    // 'all' | 'Hausaufgabe' | 'Übungsblatt' | 'Präsenzübung' | 'Praktikum' | 'Tutorium'
  searchQuery: '',

  // Tree View State
  collapsedNodes: new Set(),

  // Modals & Temp Selection State
  currentSolutionTaskId: null,
  pendingDeleteTaskId: null,
  normalizeCandidates: [],
  pendingNormalizeSelections: new Set(),
  pendingMatrixSlot: null
};

export const standardModules = ['Analysis', 'EiP', 'Lineare Algebra', 'Statistik'];

/**
 * Subscribe to state changes
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Notify all subscribers of state mutation
 */
export function notifySubscribers() {
  listeners.forEach(fn => {
    try { fn(state); } catch (e) { console.error('Subscriber error:', e); }
  });
}

/**
 * Filter tasks based on all active criteria
 */
export function getFilteredTasks() {
  const query = state.searchQuery.trim().toLowerCase();

  return state.tasks.filter(t => {
    // 1. Status Filter
    if (state.filterStatus === 'todo' && t.completed) return false;
    if (state.filterStatus === 'done' && !t.completed) return false;

    // 2. Type Filter (Mandatory vs Optional)
    if (state.filterType === 'mandatory' && t.is_optional) return false;
    if (state.filterType === 'optional' && !t.is_optional) return false;

    // 3. Module Filter
    if (state.filterSubject !== 'all' && t.subject !== state.filterSubject) return false;

    // 4. Category Filter
    if (state.filterCategory !== 'all' && t.category !== state.filterCategory) return false;

    // 5. Search Text Filter
    if (query) {
      const matchTitle = (t.title || '').toLowerCase().includes(query);
      const matchFile = (t.file_name || '').toLowerCase().includes(query);
      const matchSol = (t.solution_name || '').toLowerCase().includes(query);
      const matchNotes = (t.notes || '').toLowerCase().includes(query);
      const matchSheet = (t.sheet || '').toLowerCase().includes(query);
      const matchSubj = (t.subject || '').toLowerCase().includes(query);
      if (!matchTitle && !matchFile && !matchSol && !matchNotes && !matchSheet && !matchSubj) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get active modules present in current tasks
 */
export function getActiveModules() {
  const active = standardModules.filter(m => state.tasks.some(t => t.subject === m));
  const hasOther = state.tasks.some(t => !standardModules.includes(t.subject));
  if (hasOther) active.push('Sonstige');
  return active;
}

/**
 * Calculate progress statistics (mandatory vs optional)
 */
export function getStats() {
  const mandTasks = state.tasks.filter(t => !t.is_optional);
  const mandDone = mandTasks.filter(t => t.completed).length;
  const optTasks = state.tasks.filter(t => t.is_optional);
  const optDone = optTasks.filter(t => t.completed).length;

  const pct = mandTasks.length > 0 ? Math.round((mandDone / mandTasks.length) * 100) : 0;

  return {
    mandTasks: mandTasks.length,
    mandDone,
    optTasks: optTasks.length,
    optDone,
    pct,
    total: state.tasks.length,
    totalDone: state.tasks.filter(t => t.completed).length
  };
}

/**
 * Toast Notification Helper
 */
export function showToast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.remove('visible');
  }, 2600);
}
