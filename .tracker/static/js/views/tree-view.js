// ========================================================
// TREE VIEW (HIERARCHICAL FOLDER TREE - ENGLISH)
// ========================================================

import { state, notifySubscribers, getModuleColor } from '../state.js';
import { esc } from '../utils.js';
import { renderTaskCard } from '../components/task-card.js';

export function toggleTreeNode(key) {
  if (state.collapsedNodes.has(key)) {
    state.collapsedNodes.delete(key);
  } else {
    state.collapsedNodes.add(key);
  }
  notifySubscribers();
}

export function expandAllTree() {
  state.collapsedNodes.clear();
  notifySubscribers();
}

export function collapseAllTree() {
  const allModules = [...new Set(state.tasks.map(t => t.subject).filter(Boolean))];
  allModules.forEach(m => {
    state.collapsedNodes.add(`mod-${m}`);
    state.tasks.filter(t => t.subject === m).forEach(t => {
      state.collapsedNodes.add(`sheet-${m}-${t.sheet}`);
    });
  });
  notifySubscribers();
}

export function renderTreeView(filtered, modules) {
  const activeModules = modules.filter(m => filtered.some(t => t.subject === m));
  const otherTasks = filtered.filter(t => !modules.includes(t.subject));
  if (otherTasks.length) activeModules.push('Other');

  const treeHtml = activeModules.map(mod => {
    const modKey = `mod-${mod}`;
    const isModOpen = !state.collapsedNodes.has(modKey);
    const modTasks = filtered.filter(t => (modules.includes(t.subject) ? t.subject === mod : mod === 'Other'));

    const mDone = modTasks.filter(t => t.completed).length;
    const mMand = modTasks.filter(t => !t.is_optional);
    const mMandDone = mMand.filter(t => t.completed).length;
    const col = getModuleColor(mod);

    // Group tasks inside module by sheet
    const sheets = [...new Set(modTasks.map(t => t.sheet))].sort();

    const sheetsHtml = sheets.map(sheet => {
      const sheetKey = `sheet-${mod}-${sheet}`;
      const isSheetOpen = !state.collapsedNodes.has(sheetKey);
      const sheetTasks = modTasks.filter(t => t.sheet === sheet);
      const sDone = sheetTasks.filter(t => t.completed).length;
      const sMand = sheetTasks.filter(t => !t.is_optional);
      const sMandDone = sMand.filter(t => t.completed).length;

      const displaySheet = sheet.replace(/^Blatt\s*/i, 'Sheet ');
      const cardsHtml = sheetTasks.map(t => renderTaskCard(t)).join('');

      return `
        <div class="tree-node-sheet">
          <div class="tree-row-sheet" onclick="window.appActions.toggleTreeNode('${sheetKey}')">
            <span class="tree-chevron ${isSheetOpen ? 'open' : ''}">▸</span>
            <span class="tree-sheet-title">${esc(displaySheet)}</span>
            <span class="tree-badge-stat">${sMandDone}/${sMand.length} required</span>
            <span class="tree-badge-stat" style="color:var(--text-muted);">${sDone}/${sheetTasks.length} total</span>
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
          <span class="mod-dot" style="background: ${col.color}; box-shadow: 0 0 8px ${col.bg};"></span>
          <span class="tree-module-title">${esc(mod)}</span>
          <span class="tree-badge-stat">${mMandDone}/${mMand.length} required</span>
          <span class="tree-badge-stat" style="color:var(--text-muted);">${mDone}/${modTasks.length} total</span>
        </div>
        <div class="tree-content-module ${isModOpen ? 'open' : ''}" id="children-${modKey}">
          ${sheetsHtml}
        </div>
      </div>
    `;
  }).join('');

  return `<div class="tree-container">${treeHtml}</div>`;
}
