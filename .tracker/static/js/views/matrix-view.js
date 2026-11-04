// ========================================================
// MATRIX VIEW (SEMESTER COMPLETION GRID - ENGLISH)
// ========================================================

import { state, notifySubscribers, showToast, getModuleColor } from '../state.js';
import * as api from '../api.js';
import { esc } from '../utils.js';
import { checkNormalizeCandidates } from '../components/modals.js';
import { calculateDueStatus } from '../components/task-card.js';

const categoryLabels = {
  'Hausaufgabe': 'Homework',
  'Homework': 'Homework',
  'Übungsblatt': 'Exercise Sheet',
  'Exercise Sheet': 'Exercise Sheet',
  'Präsenzübung': 'In-Class Lab',
  'In-Class Lab': 'In-Class Lab',
  'Praktikum': 'Lab / Project',
  'Lab / Project': 'Lab / Project',
  'Tutorium': 'Tutorial',
  'Tutorial': 'Tutorial'
};

export function triggerMatrixSlotPicker(subject, sheet) {
  state.pendingMatrixSlot = { subject, sheet };
  const picker = document.getElementById('hiddenMatrixPicker');
  if (picker) {
    picker.value = '';
    picker.click();
  }
}

export async function handleMatrixPickedFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file || !state.pendingMatrixSlot) return;

  const { subject, sheet } = state.pendingMatrixSlot;
  state.pendingMatrixSlot = null;
  await uploadMatrixFile(file, subject, sheet);
}

export function handleMatrixSlotDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.add('drag-over');
}

export function handleMatrixSlotDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('drag-over');
}

export async function handleMatrixSlotDrop(event, subject, sheet) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('drag-over');

  const overlay = document.getElementById('dropOverlay');
  if (overlay) overlay.classList.remove('active');

  const files = event.dataTransfer ? event.dataTransfer.files : null;
  if (!files || files.length === 0) return;

  const file = files[0];
  await uploadMatrixFile(file, subject, sheet);
}

export async function uploadMatrixFile(file, subject, sheet) {
  showToast(`Adding ${file.name} to ${subject} (${sheet})...`);

  try {
    const result = await api.uploadFile(file, null, false, subject, sheet);
    if (result.success) {
      if (result.data && result.data.tasks) {
        state.tasks = result.data.tasks;
        notifySubscribers();
      } else {
        const data = await api.fetchTasks();
        state.tasks = data.tasks || [];
        state.ignoredTasks = data.ignored_tasks || [];
        notifySubscribers();
      }
      showToast(`File added to ${subject} (${sheet}) successfully`);
      checkNormalizeCandidates();
    } else {
      showToast('Upload failed: ' + (result.error || ''));
    }
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

export function isSheetCollapsed(sheet) {
  if (state.matrixExpandedSheets && state.matrixExpandedSheets.has(sheet)) return false;
  if (state.matrixCollapsedSheets && state.matrixCollapsedSheets.has(sheet)) return true;
  if (!state.matrixAutoCollapse) return false;

  const getSheetDisplay = (s) => (s || '').replace(/^Blatt\s*/i, 'Sheet ');
  const sheetTasks = state.tasks.filter(t => getSheetDisplay(t.sheet) === sheet);
  const sDone = sheetTasks.filter(t => t.completed).length;
  return sheetTasks.length > 0 && sDone === sheetTasks.length;
}

export function toggleMatrixColumn(sheet) {
  if (!state.matrixExpandedSheets) state.matrixExpandedSheets = new Set();
  if (!state.matrixCollapsedSheets) state.matrixCollapsedSheets = new Set();

  const isCurrentlyCollapsed = isSheetCollapsed(sheet);
  if (isCurrentlyCollapsed) {
    state.matrixExpandedSheets.add(sheet);
    state.matrixCollapsedSheets.delete(sheet);
  } else {
    state.matrixCollapsedSheets.add(sheet);
    state.matrixExpandedSheets.delete(sheet);
  }
  notifySubscribers();
}

export function toggleMatrixAutoCollapse() {
  state.matrixAutoCollapse = !state.matrixAutoCollapse;
  localStorage.setItem('modulwerk_matrix_auto_collapse', state.matrixAutoCollapse ? 'true' : 'false');
  if (state.matrixExpandedSheets) state.matrixExpandedSheets.clear();
  if (state.matrixCollapsedSheets) state.matrixCollapsedSheets.clear();
  notifySubscribers();
  showToast(state.matrixAutoCollapse ? 'Auto-collapse enabled for completed columns' : 'Auto-collapse disabled (All columns expanded)');
}

export function expandAllMatrixColumns() {
  state.matrixAutoCollapse = false;
  localStorage.setItem('modulwerk_matrix_auto_collapse', 'false');
  if (state.matrixCollapsedSheets) state.matrixCollapsedSheets.clear();
  if (state.matrixExpandedSheets) state.matrixExpandedSheets.clear();
  notifySubscribers();
  showToast('All columns expanded');
}

export function collapseCompletedMatrixColumns() {
  state.matrixAutoCollapse = true;
  localStorage.setItem('modulwerk_matrix_auto_collapse', 'true');
  if (state.matrixCollapsedSheets) state.matrixCollapsedSheets.clear();
  if (state.matrixExpandedSheets) state.matrixExpandedSheets.clear();
  notifySubscribers();
  showToast('Completed columns collapsed');
}

export function renderMatrixView(filtered, modules) {
  const activeModules = modules.filter(m => state.tasks.some(t => t.subject === m));
  const otherTasks = state.tasks.filter(t => !modules.includes(t.subject));
  if (otherTasks.length) activeModules.push('Other');

  const getSheetDisplay = (s) => (s || '').replace(/^Blatt\s*/i, 'Sheet ');

  // Collect all distinct sheet numbers across all tasks
  const sheetSet = new Set();
  state.tasks.forEach(t => {
    if (t.sheet) sheetSet.add(getSheetDisplay(t.sheet));
  });

  const allSheets = [...sheetSet].sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, '') || '0', 10);
    const nb = parseInt(b.replace(/\D/g, '') || '0', 10);
    return na - nb;
  });

  if (allSheets.length === 0) {
    allSheets.push('Sheet 01');
  }

  // Calculate column widths and collapse states
  const minColWidth = 220;
  const collapsedColWidth = 46;
  const modColWidth = 165;

  const sheetMeta = {};
  let collapsedCount = 0;

  allSheets.forEach(sheet => {
    const sheetTasks = filtered.filter(t => getSheetDisplay(t.sheet) === sheet);
    const totalSheetTasks = state.tasks.filter(t => getSheetDisplay(t.sheet) === sheet);
    const sDone = sheetTasks.filter(t => t.completed).length;
    const totalDone = totalSheetTasks.filter(t => t.completed).length;
    const isAllDone = totalSheetTasks.length > 0 && totalDone === totalSheetTasks.length;
    const isCollapsed = isSheetCollapsed(sheet);

    if (isCollapsed) collapsedCount++;

    sheetMeta[sheet] = {
      sheetTasks,
      totalSheetTasks,
      sDone,
      totalDone,
      isAllDone,
      isCollapsed
    };
  });

  const expandedCount = allSheets.length - collapsedCount;
  const totalTableMinWidth = modColWidth + (expandedCount * minColWidth) + (collapsedCount * collapsedColWidth);
  const expandedColWidthStyle = `min-width:${minColWidth}px; width:max(${minColWidth}px, calc((100% - ${modColWidth}px - ${collapsedCount * collapsedColWidth}px) / ${expandedCount || 1}));`;
  const collapsedColWidthStyle = `width:${collapsedColWidth}px; min-width:${collapsedColWidth}px; max-width:${collapsedColWidth}px;`;

  // Build Table Header with column metrics
  const thCols = allSheets.map(sheet => {
    const meta = sheetMeta[sheet];
    const { sheetTasks, sDone, isAllDone, isCollapsed } = meta;

    if (isCollapsed) {
      return `
        <th 
          class="matrix-th matrix-col-collapsed" 
          style="${collapsedColWidthStyle}"
          onclick="window.appActions.toggleMatrixColumn('${esc(sheet)}')"
          title="${esc(sheet)} (${sDone}/${sheetTasks.length} completed) · Click to expand"
        >
          <div class="matrix-col-header-collapsed">
            <span class="matrix-col-expand-icon" title="Expand column">
              <svg viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            </span>
            <span class="matrix-col-vertical-label">${esc(sheet)}</span>
            <span class="matrix-col-mini-pill ${isAllDone ? 'all-done' : ''}">
              ${isAllDone ? '✓' : `${sDone}/${sheetTasks.length}`}
            </span>
          </div>
        </th>
      `;
    }

    return `
      <th class="matrix-th" style="${expandedColWidthStyle}">
        <div class="matrix-col-header">
          <div class="matrix-col-title-wrap">
            <span>${esc(sheet)}</span>
          </div>
          <div class="matrix-col-actions-wrap">
            ${sheetTasks.length > 0 ? `
              <span 
                class="matrix-col-pill ${isAllDone ? 'all-done clickable' : ''}" 
                ${isAllDone ? `onclick="window.appActions.toggleMatrixColumn('${esc(sheet)}')" title="${sDone}/${sheetTasks.length} completed · Click to collapse"` : `title="${sDone}/${sheetTasks.length} completed"`}
              >
                ${sDone}/${sheetTasks.length}${isAllDone ? ' ✓' : ''}
              </span>
            ` : ''}
            <button 
              type="button" 
              class="matrix-col-collapse-btn" 
              onclick="window.appActions.toggleMatrixColumn('${esc(sheet)}')" 
              title="Collapse ${esc(sheet)}"
            >
              <svg viewBox="0 0 24 24"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            </button>
          </div>
        </div>
      </th>
    `;
  }).join('');

  // Check if user is currently filtering
  const isFilterActive = state.filterStatus !== 'all' || 
                         state.filterType !== 'all' || 
                         state.filterSubject !== 'all' || 
                         state.filterCategory !== 'all' || 
                         (state.searchQuery && state.searchQuery.length > 0);

  // Build Module Rows
  const rowsHtml = activeModules.map(mod => {
    const modTasks = filtered.filter(t => (modules.includes(t.subject) ? t.subject === mod : mod === 'Other'));
    const mMand = modTasks.filter(t => !t.is_optional);
    const mMandDone = mMand.filter(t => t.completed).length;
    const mTotalDone = modTasks.filter(t => t.completed).length;
    const col = getModuleColor(mod);

    const cellsHtml = allSheets.map(sheet => {
      const meta = sheetMeta[sheet];
      const { isCollapsed } = meta;
      const cellTasks = modTasks.filter(t => getSheetDisplay(t.sheet) === sheet);
      const allModTasks = state.tasks.filter(t => (modules.includes(t.subject) ? t.subject === mod : mod === 'Other'));
      const hasRealTasksInSheet = allModTasks.some(t => getSheetDisplay(t.sheet) === sheet);
      const cellDoneCount = cellTasks.filter(t => t.completed).length;
      const isAllCellDone = cellTasks.length > 0 && cellDoneCount === cellTasks.length;

      if (isCollapsed) {
        return `
          <td 
            class="matrix-td matrix-td-collapsed" 
            style="${collapsedColWidthStyle}"
            onclick="window.appActions.toggleMatrixColumn('${esc(sheet)}')"
            title="${esc(mod)} · ${esc(sheet)} (${cellDoneCount}/${cellTasks.length} completed) · Click to expand"
          >
            <div class="matrix-collapsed-cell">
              ${cellTasks.length > 0 ? `
                <div class="matrix-collapsed-indicator ${isAllCellDone ? 'done' : ''}">
                  <span class="matrix-collapsed-stripe" style="background:${col.color};"></span>
                  ${isAllCellDone ? `
                    <svg viewBox="0 0 24 24" class="matrix-collapsed-check"><polyline points="20 6 9 17 4 12"/></svg>
                  ` : `
                    <span class="matrix-collapsed-fraction">${cellDoneCount}/${cellTasks.length}</span>
                  `}
                </div>
              ` : `
                <span class="matrix-blank-dash" style="opacity:0.25; font-size:11px;">—</span>
              `}
            </div>
          </td>
        `;
      }

      if (cellTasks.length === 0) {
        if (isFilterActive || hasRealTasksInSheet) {
          return `
            <td class="matrix-td matrix-td-empty" style="${expandedColWidthStyle}">
              <div class="matrix-cell-blank">
                <span class="matrix-blank-dash">—</span>
              </div>
            </td>
          `;
        }

        return `
          <td class="matrix-td" style="${expandedColWidthStyle}">
            <div 
              class="matrix-empty-slot"
              onclick="window.appActions.triggerMatrixSlotPicker('${esc(mod)}', '${esc(sheet)}')"
              ondragover="window.appActions.handleMatrixSlotDragOver(event)"
              ondragleave="window.appActions.handleMatrixSlotDragLeave(event)"
              ondrop="window.appActions.handleMatrixSlotDrop(event, '${esc(mod)}', '${esc(sheet)}')"
              title="${esc(mod)} ${esc(sheet)}: Pending (click or drop file here)"
            >
              <div class="slot-quiet">
                <span style="opacity:0.4; font-weight:600;">—</span>
                <span style="font-size:10.5px; opacity:0.6;">Pending</span>
              </div>
              <div class="slot-hover">
                <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2.5;"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                <span>Add Sheet</span>
              </div>
            </div>
          </td>
        `;
      }

      const cardsHtml = cellTasks.map(t => {
        const isDone = !!t.completed;
        const isAbgabe = (t.category === 'Hausaufgabe' || t.category === 'Homework') && !isDone;
        const isOpt = !!t.is_optional;
        const hasSolution = !!(t.solution_path || t.solution_note);

        const assignName = t.file_name || (t.file_path ? t.file_path.split(/[\\\/]/).pop() : 'Assignment');
        const assignSize = t.file_size ? t.file_size.replace('Java-Dateien', 'Java Files').replace('Dateien', 'Files') : '';
        const assignExt = (t.file_ext || 'PDF').toUpperCase();

        const solName = t.solution_name || (t.solution_path ? t.solution_path.split(/[\\\/]/).pop() : 'Solution');
        const solSize = t.solution_size || '';

        const displayCategory = categoryLabels[t.category] || t.category;

        let catClass = '';
        if (t.category === 'Hausaufgabe' || t.category === 'Homework') catClass = 'badge-abgabe';
        else if (t.category.includes('Präsenz') || t.category.includes('In-Class')) catClass = 'badge-praesenz';
        else if (t.category === 'Praktikum' || t.category.includes('Lab')) catClass = 'badge-praktikum';
        else if (t.category === 'Tutorium' || t.category === 'Tutorial') catClass = 'badge-tutorium';

        let shortTitle = t.title || '';
        shortTitle = shortTitle.replace(/\b[UÜ]bungsblatt\b/gi, 'Exercise');
        shortTitle = shortTitle.replace(/\bBlatt\b/gi, 'Sheet');
        shortTitle = shortTitle.replace(/\bHausaufgabe\b/gi, 'Homework');
        shortTitle = shortTitle.replace(/\bPr[äa]senz[üu]bung\b/gi, 'In-Class');
        shortTitle = shortTitle.replace(/\bLoesung\b/gi, 'Solution');
        const subjRegex = new RegExp('^' + t.subject.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*', 'i');
        shortTitle = shortTitle.replace(subjRegex, '');
        shortTitle = shortTitle.replace(/\s*\((?:(?:blatt|sheet)\s*)?0*(\d+)\)/i, ' $1').trim();
        if (!shortTitle) shortTitle = t.title;

        const dueInfo = calculateDueStatus(t.due_date, isDone);

        return `
          <div class="matrix-card ${isDone ? 'done' : ''} ${isAbgabe ? 'card-pending-abgabe' : ''} ${isOpt ? 'card-optional' : ''}">
            <div class="matrix-card-top">
              <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1;">
                <button class="cb-btn ${state.justToggledTaskId === t.id ? 'cb-pop' : ''}" style="width:17px;height:17px;min-width:17px;" onclick="window.appActions.toggleTask('${t.id}')" title="${isDone ? 'Mark as pending' : 'Mark as completed'}">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
                <span class="matrix-card-title" onclick="window.appActions.toggleTask('${t.id}')" title="${esc(t.title)}">${esc(shortTitle)}</span>
              </div>
              <span class="badge ${catClass}" style="font-size:9.5px; padding:1px 5px;">${esc(displayCategory)}</span>
            </div>

            ${dueInfo ? `
              <div style="margin-top:2px; margin-bottom:4px; display:flex;">
                <span 
                  class="due-pill ${dueInfo.cssClass}" 
                  style="font-size:9.5px; padding:1px 5px; gap:3px;" 
                  onclick="event.stopPropagation(); window.appActions.openDueModal('${t.id}')"
                  title="${esc(dueInfo.title)} (Click to edit deadline)"
                >
                  ${dueInfo.hasPulse ? '<span class="due-pulse-dot" style="width:4px;height:4px;"></span>' : ''}
                  <svg viewBox="0 0 24 24" style="width:9px;height:9px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>${esc(dueInfo.label)}</span>
                </span>
              </div>
            ` : ''}

            <div class="matrix-pair-row">
              <span 
                class="matrix-file-chip" 
                onclick="window.appActions.openTaskFile('${t.id}')"
                title="Open assignment: ${esc(assignName)} (${esc(assignSize)})"
              >
                <span class="file-ext-badge" style="font-size:9px; padding:1px 3px; flex-shrink:0;">${esc(assignExt)}</span>
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(assignSize || 'Open')}</span>
              </span>

              <span class="matrix-pair-arrow">➔</span>

              ${hasSolution ? `
                <span 
                  class="matrix-file-chip sol-done" 
                  onclick="window.appActions.openTaskSolution('${t.id}')"
                  title="Open solution: ${esc(solName)} (${esc(solSize)})"
                >
                  <svg viewBox="0 0 24 24" style="width:10px;height:10px;stroke:currentColor;fill:none;stroke-width:2.5;flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Solution</span>
                </span>
              ` : `
                <span 
                  class="matrix-file-chip sol-missing"
                  onclick="window.appActions.triggerSolutionPicker('${t.id}')"
                  ondragover="window.appActions.handleCardDragOver(event, '${t.id}')"
                  ondragleave="window.appActions.handleCardDragLeave(event, '${t.id}')"
                  ondrop="window.appActions.handleCardDrop(event, '${t.id}', true)"
                  title="No solution attached! Click or drop file here"
                >
                  <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">+ Solution</span>
                </span>
              `}
            </div>
          </div>
        `;
      }).join('');

      return `
        <td class="matrix-td" style="${expandedColWidthStyle}">
          <div class="matrix-cell-stack">
            ${cardsHtml}
          </div>
        </td>
      `;
    }).join('');

    const isModCleared = mMand.length > 0 && mMandDone === mMand.length;
    const mSparkCount = 6;
    const mFilled = Math.round((mMandDone / (mMand.length || 1)) * mSparkCount);
    let mDots = '';
    for (let i = 0; i < mSparkCount; i++) {
      const isF = i < mFilled;
      mDots += `<span class="chip-seg ${isF ? 'filled' : ''}" style="${isF ? `background:${col.color}; color:${col.color};` : ''}"></span>`;
    }

    return `
      <tr class="matrix-tr">
        <td class="matrix-td-mod" data-module="${esc(mod)}">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span class="mod-dot" style="background: ${col.color}; box-shadow: 0 0 8px ${col.bg};"></span>
            <span style="font-size:13px; font-weight:600; color:var(--text);">${esc(mod)}</span>
            ${isModCleared ? '<span class="all-clear-badge" style="font-size:8.5px; padding:0 4px;">✓</span>' : ''}
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <div class="chip-sparkline" title="${mMandDone}/${mMand.length} required completed">${mDots}</div>
          </div>
          <div style="font-family:var(--font-mono); font-size:10.5px; color:var(--text-secondary);">
            ${mMandDone}/${mMand.length} required · ${mTotalDone}/${modTasks.length} total
          </div>
        </td>
        ${cellsHtml}
      </tr>
    `;
  }).join('');

  const toolbarHtml = `
    <div class="matrix-toolbar">
      <div class="matrix-toolbar-left">
        <span class="matrix-toolbar-badge">
          <strong>${allSheets.length}</strong> Sheets
          ${collapsedCount > 0 ? `<span class="matrix-collapsed-tag">${collapsedCount} collapsed</span>` : ''}
        </span>
        <span class="matrix-toolbar-sep">•</span>
        <span class="matrix-toolbar-hint">Click any completed column to expand / collapse</span>
      </div>
      <div class="matrix-toolbar-right">
        <button 
          type="button" 
          class="matrix-toggle-btn ${state.matrixAutoCollapse ? 'active' : ''}" 
          onclick="window.appActions.toggleMatrixAutoCollapse()" 
          title="Toggle auto-collapsing 100% completed columns"
        >
          <span class="matrix-toggle-switch"></span>
          <span>Auto-collapse completed</span>
        </button>
        ${collapsedCount > 0 ? `
          <button 
            type="button" 
            class="matrix-link-btn" 
            onclick="window.appActions.expandAllMatrixColumns()" 
            title="Expand all collapsed columns"
          >
            <svg viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            <span>Expand all</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;

  return `
    <div class="matrix-wrapper">
      ${toolbarHtml}
      <div class="matrix-scroll-container">
        <table class="matrix-table" style="min-width: ${totalTableMinWidth}px;">
          <thead>
            <tr>
              <th class="matrix-th matrix-th-mod">Module</th>
              ${thCols}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
