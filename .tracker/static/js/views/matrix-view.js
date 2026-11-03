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

  // Build Table Header with column metrics
  const colWidthStyle = `width: calc((100% - 165px) / ${allSheets.length});`;
  const thCols = allSheets.map(sheet => {
    const sheetTasks = filtered.filter(t => getSheetDisplay(t.sheet) === sheet);
    const sDone = sheetTasks.filter(t => t.completed).length;
    const isAllDone = sheetTasks.length > 0 && sDone === sheetTasks.length;

    return `
      <th class="matrix-th" style="${colWidthStyle}">
        <div class="matrix-col-header">
          <span>${esc(sheet)}</span>
          ${sheetTasks.length > 0 ? `
            <span class="matrix-col-pill ${isAllDone ? 'all-done' : ''}" title="${sDone}/${sheetTasks.length} completed">
              ${sDone}/${sheetTasks.length}${isAllDone ? ' ✓' : ''}
            </span>
          ` : ''}
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
      const cellTasks = modTasks.filter(t => getSheetDisplay(t.sheet) === sheet);
      const allModTasks = state.tasks.filter(t => (modules.includes(t.subject) ? t.subject === mod : mod === 'Other'));
      const hasRealTasksInSheet = allModTasks.some(t => getSheetDisplay(t.sheet) === sheet);

      if (cellTasks.length === 0) {
        if (isFilterActive || hasRealTasksInSheet) {
          return `
            <td class="matrix-td matrix-td-empty" style="${colWidthStyle}">
              <div class="matrix-cell-blank">
                <span class="matrix-blank-dash">—</span>
              </div>
            </td>
          `;
        }

        return `
          <td class="matrix-td" style="${colWidthStyle}">
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
        shortTitle = shortTitle.replace(/\bBlatt\b/gi, 'Sheet');
        shortTitle = shortTitle.replace(/\bUebungsblatt\b/gi, 'Exercise');
        shortTitle = shortTitle.replace(/\bHausaufgabe\b/gi, 'Homework');
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
                <span class="file-ext-badge" style="font-size:9px; padding:1px 3px;">${esc(assignExt)}</span>
                <span style="max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(assignSize || 'Open')}</span>
              </span>

              <span style="color:var(--text-muted); font-size:10px;">➔</span>

              ${hasSolution ? `
                <span 
                  class="matrix-file-chip sol-done" 
                  onclick="window.appActions.openTaskSolution('${t.id}')"
                  title="Open solution: ${esc(solName)} (${esc(solSize)})"
                >
                  <svg viewBox="0 0 24 24" style="width:10px;height:10px;stroke:currentColor;fill:none;stroke-width:2.5;"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style="max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Solution</span>
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
                  <span>+ Solution</span>
                </span>
              `}
            </div>
          </div>
        `;
      }).join('');

      return `
        <td class="matrix-td" style="${colWidthStyle}">
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

  return `
    <div class="matrix-wrapper">
      <table class="matrix-table">
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
  `;
}
