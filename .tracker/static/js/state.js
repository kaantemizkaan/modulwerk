// ========================================================
// CENTRAL REACTIVE APPLICATION STATE STORE (DYNAMIC & UNIVERSAL)
// ========================================================

const listeners = new Set();

export const state = {
  tasks: [],
  ignoredTasks: [],
  isOnline: false,
  viewMode: localStorage.getItem('modulwerk_view_mode') || localStorage.getItem('lmu_view_mode') || 'list',
  theme: localStorage.getItem('modulwerk_theme') || localStorage.getItem('lmu_theme') || 'dark',

  // Filters
  filterStatus: 'all',      // 'all' | 'todo' | 'done'
  filterType: 'all',        // 'all' | 'mandatory' | 'optional'
  filterSubject: 'all',     // 'all' | any dynamic subject name
  filterCategory: 'all',    // 'all' | any category
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

// Beautiful, accessible, distinct palette for arbitrary subjects
export const modulePalette = [
  { name: 'indigo',  color: '#818cf8', bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.32)' },
  { name: 'emerald', color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.32)' },
  { name: 'amber',   color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.32)' },
  { name: 'sky',     color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.32)' },
  { name: 'rose',    color: '#fb7185', bg: 'rgba(251, 113, 133, 0.12)', border: 'rgba(251, 113, 133, 0.32)' },
  { name: 'violet',  color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.32)' },
  { name: 'teal',    color: '#2dd4bf', bg: 'rgba(45, 212, 191, 0.12)', border: 'rgba(45, 212, 191, 0.32)' },
  { name: 'orange',  color: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)', border: 'rgba(251, 146, 60, 0.32)' }
];

/**
 * Generate a consistent, stable color palette entry for ANY subject name
 * @param {string} subject 
 * @returns {Object}
 */
export function getModuleColor(subject) {
  if (!subject) return modulePalette[0];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % modulePalette.length;
  return modulePalette[idx];
}

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
 * Normalize category name for resilient comparison across German & English
 */
export function normalizeCategory(cat) {
  if (!cat) return '';
  const c = cat.toLowerCase();
  if (c.includes('hausaufgabe') || c.includes('homework')) return 'homework';
  if (c.includes('uebung') || c.includes('übung') || c.includes('exercise')) return 'exercise';
  if (c.includes('praesenz') || c.includes('präsenz') || c.includes('in-class')) return 'in-class';
  if (c.includes('praktikum') || c.includes('lab') || c.includes('project')) return 'lab';
  if (c.includes('tutorium') || c.includes('tutorial')) return 'tutorial';
  return c;
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

    // 3. Module Filter (Dynamic subject matching)
    if (state.filterSubject !== 'all' && t.subject !== state.filterSubject) return false;

    // 4. Category Filter (Resilient bilingual match)
    if (state.filterCategory !== 'all') {
      if (normalizeCategory(t.category) !== normalizeCategory(state.filterCategory)) {
        return false;
      }
    }

    // 5. Search Text Filter
    if (query) {
      const matchTitle = (t.title || '').toLowerCase().includes(query);
      const matchFile = (t.file_name || '').toLowerCase().includes(query);
      const matchSol = (t.solution_name || '').toLowerCase().includes(query);
      const matchNotes = (t.notes || '').toLowerCase().includes(query);
      const displaySheet = (t.sheet || '').replace(/^Blatt\s*/i, 'Sheet ');
      const matchSheet = (t.sheet || '').toLowerCase().includes(query) || displaySheet.toLowerCase().includes(query);
      const matchSubj = (t.subject || '').toLowerCase().includes(query);
      if (!matchTitle && !matchFile && !matchSol && !matchNotes && !matchSheet && !matchSubj) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Dynamically extract all active modules present in current tasks
 * Adapts automatically to ANY university course structure
 */
export function getActiveModules() {
  const detected = [...new Set(state.tasks.map(t => t.subject).filter(Boolean))].sort();
  if (detected.length > 0) return detected;
  return ['General'];
}

/**
 * Dynamically extract all unique categories
 */
export function getActiveCategories() {
  const detected = [...new Set(state.tasks.map(t => t.category).filter(Boolean))].sort();
  return detected.length > 0 ? detected : ['Hausaufgabe', 'Übungsblatt', 'Präsenzübung', 'Praktikum', 'Tutorium'];
}

/**
 * Calculate progress statistics (mandatory vs optional, segmented sparklines)
 */
export function getStats() {
  const mandTasks = state.tasks.filter(t => !t.is_optional);
  const mandDone = mandTasks.filter(t => t.completed).length;
  const optTasks = state.tasks.filter(t => t.is_optional);
  const optDone = optTasks.filter(t => t.completed).length;

  const now = Date.now();
  const overdueTasks = state.tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date).getTime() < now);
  const urgentTasks = state.tasks.filter(t => {
    if (t.completed || !t.due_date) return false;
    const diff = new Date(t.due_date).getTime() - now;
    return diff >= 0 && diff < 24 * 3600 * 1000;
  });

  const total = state.tasks.length;
  const totalDone = mandDone + optDone;
  const overdueCount = overdueTasks.length;
  const urgentCount = urgentTasks.length;
  const remaining = Math.max(0, total - totalDone - overdueCount - urgentCount);

  const pct = mandTasks.length > 0 
    ? Math.round((mandDone / mandTasks.length) * 100) 
    : (total > 0 ? Math.round((totalDone / total) * 100) : 0);

  return {
    mandTasks: mandTasks.length,
    mandDone,
    optTasks: optTasks.length,
    optDone,
    pct,
    total,
    totalDone,
    overdueCount,
    urgentCount,
    remaining
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
