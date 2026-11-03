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

    const getSheetDisplay = (s) => (s || '').replace(/^Blatt\s*/i, 'Sheet ');

    // Group tasks inside module by normalized sheet
    const sheets = [...new Set(modTasks.map(t => getSheetDisplay(t.sheet)))].sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, '') || '0', 10);
      const nb = parseInt(b.replace(/\D/g, '') || '0', 10);
      return na - nb;
    });

    const sheetsHtml = sheets.map(sheet => {
      const sheetKey = `sheet-${mod}-${sheet.replace(/\s+/g, '_')}`;
      const isSheetOpen = !state.collapsedNodes.has(sheetKey);
      const sheetTasks = modTasks.filter(t => getSheetDisplay(t.sheet) === sheet);
      const sDone = sheetTasks.filter(t => t.completed).length;
      const sMand = sheetTasks.filter(t => !t.is_optional);
      const sMandDone = sMand.filter(t => t.completed).length;

      const cardsHtml = sheetTasks.map(t => renderTaskCard(t)).join('');
      const isSheetCleared = sMand.length > 0 && sMandDone === sMand.length;

      // Micro-sparkline for sheet
      const sSparkCount = Math.min(5, sMand.length || 3);
      const sFilled = Math.round((sMandDone / (sMand.length || 1)) * sSparkCount);
      let sDots = '';
      for (let i = 0; i < sSparkCount; i++) {
        const isF = i < sFilled;
        sDots += `<span class="chip-seg ${isF ? 'filled' : ''}" style="${isF ? `background:${col.color}; color:${col.color};` : ''}"></span>`;
      }

      return `
        <div class="tree-node-sheet">
          <div class="tree-row-sheet" onclick="window.appActions.toggleTreeNode('${sheetKey}')">
            <span class="tree-chevron ${isSheetOpen ? 'open' : ''}">▸</span>
            <span class="tree-sheet-title">${esc(sheet)}</span>
            <div class="chip-sparkline" title="${sMandDone}/${sMand.length} required completed">${sDots}</div>
            <span class="tree-badge-stat">${sMandDone}/${sMand.length} required</span>
            <span class="tree-badge-stat" style="color:var(--text-muted);">${sDone}/${sheetTasks.length} total</span>
            ${isSheetCleared ? '<span class="all-clear-badge" style="font-size:8.5px; padding:0 4px;">✓</span>' : ''}
          </div>
          <div class="tree-content-sheet ${isSheetOpen ? 'open' : ''}" id="children-${sheetKey}">
            ${cardsHtml}
          </div>
        </div>
      `;
    }).join('');

    const isModCleared = mMand.length > 0 && mMandDone === mMand.length;
    // Micro-sparkline for module
    const mSparkCount = 6;
    const mFilled = Math.round((mMandDone / (mMand.length || 1)) * mSparkCount);
    let mDots = '';
    for (let i = 0; i < mSparkCount; i++) {
      const isF = i < mFilled;
      mDots += `<span class="chip-seg ${isF ? 'filled' : ''}" style="${isF ? `background:${col.color}; color:${col.color};` : ''}"></span>`;
    }

    return `
      <div class="tree-node-module" data-module="${esc(mod)}">
        <div class="tree-row-module" onclick="window.appActions.toggleTreeNode('${modKey}')">
          <span class="tree-chevron ${isModOpen ? 'open' : ''}">▸</span>
          <span class="mod-dot" style="background: ${col.color}; box-shadow: 0 0 8px ${col.bg};"></span>
          <span class="tree-module-title">${esc(mod)}</span>
          <div class="chip-sparkline" title="${mMandDone}/${mMand.length} required completed">${mDots}</div>
          <span class="tree-badge-stat">${mMandDone}/${mMand.length} required</span>
          <span class="tree-badge-stat" style="color:var(--text-muted);">${mDone}/${modTasks.length} total</span>
          ${isModCleared ? '<span class="all-clear-badge">✓ Cleared</span>' : ''}
        </div>
        <div class="tree-content-module ${isModOpen ? 'open' : ''}" id="children-${modKey}">
          ${sheetsHtml}
        </div>
      </div>
    `;
  }).join('');

  return `<div class="tree-container">${treeHtml}</div>`;
}
