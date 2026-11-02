// ========================================================
// TREE VIEW (BAUMSTRUKTUR: MODULE -> BLATT -> TASK CARDS)
// ========================================================

import { state, notifySubscribers } from '../state.js';
import { esc } from '../utils.js';
import { renderTaskCard } from '../components/task-card.js';

const modClasses = {
  'Analysis': 'analysis',
  'EiP': 'eip',
  'Lineare Algebra': 'linalg',
  'Statistik': 'statistik'
};

/**
 * Toggle collapsed/expanded state of a tree node
 * @param {string} key 
 */
export function toggleTreeNode(key) {
  if (state.collapsedNodes.has(key)) {
    state.collapsedNodes.delete(key);
  } else {
    state.collapsedNodes.add(key);
  }
  notifySubscribers();
}

/**
 * Expand all tree nodes
 */
export function expandAllTree() {
  state.collapsedNodes.clear();
  notifySubscribers();
}

/**
 * Collapse all tree nodes
 */
export function collapseAllTree() {
  const modules = ['Analysis', 'EiP', 'Lineare Algebra', 'Statistik', 'Sonstige'];
  modules.forEach(m => {
    state.collapsedNodes.add(`mod-${m}`);
    state.tasks.filter(t => t.subject === m).forEach(t => {
      state.collapsedNodes.add(`sheet-${m}-${t.sheet}`);
    });
  });
  notifySubscribers();
}

/**
 * Render the full tree view
 * @param {Array} filtered 
 * @param {Array} modules 
 * @returns {string} HTML string
 */
export function renderTreeView(filtered, modules) {
  const activeModules = modules.filter(m => filtered.some(t => t.subject === m));
  const otherTasks = filtered.filter(t => !modules.includes(t.subject));
  if (otherTasks.length) activeModules.push('Sonstige');

  const treeHtml = activeModules.map(mod => {
    const modKey = `mod-${mod}`;
    const isModOpen = !state.collapsedNodes.has(modKey);
    const modTasks = filtered.filter(t => (modules.includes(t.subject) ? t.subject === mod : mod === 'Sonstige'));

    const mDone = modTasks.filter(t => t.completed).length;
    const mMand = modTasks.filter(t => !t.is_optional);
    const mMandDone = mMand.filter(t => t.completed).length;
    const cls = modClasses[mod] || 'analysis';

    // Group tasks inside module by sheet
    const sheets = [...new Set(modTasks.map(t => t.sheet))].sort();

    const sheetsHtml = sheets.map(sheet => {
      const sheetKey = `sheet-${mod}-${sheet}`;
      const isSheetOpen = !state.collapsedNodes.has(sheetKey);
      const sheetTasks = modTasks.filter(t => t.sheet === sheet);
      const sDone = sheetTasks.filter(t => t.completed).length;
      const sMand = sheetTasks.filter(t => !t.is_optional);
      const sMandDone = sMand.filter(t => t.completed).length;

      const cardsHtml = sheetTasks.map(t => renderTaskCard(t)).join('');

      return `
        <div class="tree-node-sheet">
          <div class="tree-row-sheet" onclick="window.appActions.toggleTreeNode('${sheetKey}')">
            <span class="tree-chevron ${isSheetOpen ? 'open' : ''}">▸</span>
            <span class="tree-sheet-title">${esc(sheet)}</span>
            <span class="tree-badge-stat">${sMandDone}/${sMand.length} Pflicht</span>
            <span class="tree-badge-stat" style="color:var(--text-muted);">${sDone}/${sheetTasks.length}</span>
          </div>
          <div class="tree-content-sheet ${isSheetOpen ? 'open' : ''}" id="children-${sheetKey}">
            ${cardsHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="tree-node-module" data-module="${esc(mod)}">
        <div class="tree-row-module" onclick="window.appActions.toggleTreeNode('${modKey}')">
          <span class="tree-chevron ${isModOpen ? 'open' : ''}">▸</span>
          <span class="mod-dot ${cls}"></span>
          <span class="tree-module-title">${esc(mod)}</span>
          <span class="tree-badge-stat">${mMandDone}/${mMand.length} Pflicht</span>
          <span class="tree-badge-stat" style="color:var(--text-muted);">${mDone}/${modTasks.length} gesamt</span>
        </div>
        <div class="tree-content-module ${isModOpen ? 'open' : ''}" id="children-${modKey}">
          ${sheetsHtml}
        </div>
      </div>
    `;
  }).join('');

  return `<div class="tree-container">${treeHtml}</div>`;
}
