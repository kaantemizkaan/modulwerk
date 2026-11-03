// ========================================================
// TASK CARD COMPONENT (DUAL-BOX FILE-PAIR LAYOUT - ENGLISH)
// ========================================================

import { esc } from '../utils.js';
import { state } from '../state.js';

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

/**
 * Calculate human-readable countdown status and badge styling
 * @param {string|null} dueDateStr 
 * @param {boolean} isDone 
 * @returns {Object|null}
 */
export function calculateDueStatus(dueDateStr, isDone) {
  if (!dueDateStr) return null;
  const target = new Date(dueDateStr);
  if (isNaN(target.getTime())) return null;

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (isDone) {
    const formatted = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      status: 'completed',
      cssClass: 'due-completed',
      label: `Due ${formatted}`,
      hasPulse: false,
      title: `Completed (Deadline: ${target.toLocaleString()})`
    };
  }

  // Overdue
  if (diffMs < 0) {
    const overdueHours = Math.abs(diffHours);
    const overdueDays = Math.abs(diffDays);
    const label = overdueHours < 24 ? `${overdueHours}h overdue` : `${overdueDays}d overdue`;
    return {
      status: 'overdue',
      cssClass: 'due-overdue',
      label,
      hasPulse: false,
      title: `Overdue since ${target.toLocaleString()}`
    };
  }

  // Urgent (< 24 hours)
  if (diffHours < 24) {
    const h = diffHours;
    const m = Math.max(0, diffMin % 60);
    const label = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
    return {
      status: 'urgent',
      cssClass: 'due-urgent',
      label,
      hasPulse: true,
      title: `Urgent deadline: ${target.toLocaleString()}`
    };
  }

  // Soon (1 - 3 days)
  if (diffDays < 4) {
    const weekday = target.toLocaleDateString('en-US', { weekday: 'short' });
    const time = target.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return {
      status: 'soon',
      cssClass: 'due-soon',
      label: `${diffDays}d left (${weekday} ${time})`,
      hasPulse: false,
      title: `Due on ${target.toLocaleString()}`
    };
  }

  // Normal (> 3 days)
  const monthDay = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return {
    status: 'normal',
    cssClass: 'due-normal',
    label: `${diffDays}d left (${monthDay})`,
    hasPulse: false,
    title: `Due on ${target.toLocaleString()}`
  };
}

/**
 * Render single task card HTML in English
 * @param {Object} t 
 * @returns {string}
 */
export function renderTaskCard(t) {
  const isDone = !!t.completed;
  const isAbgabe = (t.category === 'Hausaufgabe' || t.category === 'Homework') && !isDone;
  const isOpt = !!t.is_optional;
  const cleanNote = (t.notes || '').trim();

  // Category in English
  const displayCategory = categoryLabels[t.category] || t.category;

  // Sheet in English
  const displaySheet = t.sheet ? t.sheet.replace(/^Blatt\s*/i, 'Sheet ') : 'Sheet 01';

  // Folder breadcrumb display
  const dirPath = t.file_path ? t.file_path.replace(/\\/g, '/').replace(/\/[^\/]+$/, '') : (t.subject + ' / ' + displaySheet);

  // Assignment file info
  const assignName = t.file_name || (t.file_path ? t.file_path.split(/[\\\/]/).pop() : 'Assignment File');
  const assignSize = t.file_size ? t.file_size.replace('Java-Dateien', 'Java Files').replace('Dateien', 'Files') : '';
  const assignExt = (t.file_ext || 'PDF').toUpperCase();

  // Solution file info
  const hasSolution = !!(t.solution_path || t.solution_note);
  const solName = t.solution_name || (t.solution_path ? t.solution_path.split(/[\\\/]/).pop() : 'Solution File');
  const solSize = t.solution_size || '';
  const solExt = (t.solution_ext || 'PDF').toUpperCase();

  // Category badge class
  let catClass = '';
  if (t.category === 'Hausaufgabe' || t.category === 'Homework') catClass = 'badge-abgabe';
  else if (t.category.includes('Präsenz') || t.category.includes('In-Class')) catClass = 'badge-praesenz';
  else if (t.category === 'Praktikum' || t.category.includes('Lab')) catClass = 'badge-praktikum';
  else if (t.category === 'Tutorium' || t.category === 'Tutorial') catClass = 'badge-tutorium';

  // Extension classes
  const assignExtClass = assignExt === 'PDF' ? 'pdf' : (assignExt === 'JAVA' ? 'java' : '');
  const solExtClass = hasSolution ? 'sol' : (solExt === 'PDF' ? 'pdf' : '');

  // Format title (replace Blatt with Sheet, Uebungsblatt with Exercise)
  let cleanTitle = t.title || '';
  cleanTitle = cleanTitle.replace(/\bBlatt\b/gi, 'Sheet');
  cleanTitle = cleanTitle.replace(/\bUebungsblatt\b/gi, 'Exercise');
  cleanTitle = cleanTitle.replace(/\bHausaufgabe\b/gi, 'Homework');
  cleanTitle = cleanTitle.replace(/\bLoesung\b/gi, 'Solution');

  // Calculate Due Date Status
  const dueInfo = calculateDueStatus(t.due_date, isDone);
  const dueBadgeHtml = dueInfo ? `
    <span 
      class="due-pill ${dueInfo.cssClass}" 
      onclick="event.stopPropagation(); window.appActions.openDueModal('${t.id}')"
      title="${esc(dueInfo.title)} (Click to edit deadline)"
    >
      ${dueInfo.hasPulse ? '<span class="due-pulse-dot"></span>' : ''}
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span>${esc(dueInfo.label)}</span>
    </span>
  ` : '';

  const isJustToggled = state.justToggledTaskId === t.id;

  return `
    <article 
      class="task-card ${isDone ? 'done' : ''} ${isAbgabe ? 'card-pending-abgabe' : ''} ${isOpt ? 'card-optional' : ''}" 
      id="card-${t.id}"
      data-subject="${esc(t.subject)}"
      data-category="${esc(displayCategory)}"
    >
      <!-- Top Row: Checkbox, Sheet, Title, Tags, Breadcrumb & Actions -->
      <div class="card-top">
        <div class="card-title-group">
          <button 
            class="cb-btn ${isJustToggled ? 'cb-pop' : ''}" 
            onclick="window.appActions.toggleTask('${t.id}')"
            title="${isDone ? 'Mark as pending' : 'Mark as completed'}"
          >
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </button>

          <span class="sheet-badge">${esc(displaySheet)}</span>

          <h2 class="card-title" onclick="window.appActions.toggleTask('${t.id}')" title="${esc(cleanTitle)}">
            ${esc(cleanTitle)}
          </h2>

          <span class="badge ${catClass}">${esc(displayCategory)}</span>

          <button 
            class="opt-tag ${isOpt ? 'optional' : 'mandatory'}"
            onclick="window.appActions.toggleOptional('${t.id}')"
            title="${isOpt ? 'Optional (click to mark as required)' : 'Required (click to mark as optional)'}"
          >
            ${isOpt ? 'Optional' : 'Required'}
          </button>

          ${dueBadgeHtml}
        </div>

        <div class="card-meta-right">
          <span 
            class="folder-crumb" 
            onclick="window.appActions.openTaskFolder('${t.id}')"
            title="Open folder in file explorer: ${esc(dirPath)}"
          >
            <svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>${esc(dirPath)}</span>
          </span>

          <button 
            class="btn btn-icon ${t.due_date ? 'btn-due-active' : ''}" 
            onclick="window.appActions.openDueModal('${t.id}')"
            title="${t.due_date ? 'Deadline: ' + esc(t.due_date) + ' (click to change)' : 'Set deadline'}"
          >
            <svg viewBox="0 0 24 24" style="width:13px;height:13px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>

          <button 
            class="btn btn-icon" 
            onclick="window.appActions.toggleNoteDrawer('${t.id}')"
            title="${cleanNote ? 'View/edit note' : 'Add note'}"
            style="${cleanNote ? 'color: var(--done); border-color: var(--done-border); background: var(--done-bg);' : ''}"
          >
            <svg viewBox="0 0 24 24" style="width:13px;height:13px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>

          <button 
            class="btn btn-icon btn-delete" 
            onclick="window.appActions.promptDeleteTask('${t.id}')"
            title="Permanently delete task"
          >
            <svg viewBox="0 0 24 24" style="width:12px;height:12px;"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      <!-- The File-Pair Section: Left (Assignment) & Right (Solution) Tiles -->
      <div class="file-pair-grid">
        <!-- Left Box: Assignment File -->
        <div 
          class="file-box assignment" 
          ondragover="window.appActions.handleCardDragOver(event, '${t.id}')"
          ondragleave="window.appActions.handleCardDragLeave(event, '${t.id}')"
          ondrop="window.appActions.handleCardDrop(event, '${t.id}', false)"
        >
          <div class="file-main">
            <div class="file-icon-wrap ${assignExt === 'PDF' ? 'pdf-type' : (assignExt === 'JAVA' ? 'java-type' : '')}" title="${t.is_folder ? 'Folder' : 'Document'}">
              ${t.is_folder ? `
                <svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              ` : `
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              `}
            </div>
            <div class="file-texts">
              <span class="file-label">Assignment</span>
              <span class="file-name" title="${esc(assignName)}">${esc(assignName)}</span>
              <div class="file-meta-row">
                <span class="file-ext-badge ${assignExtClass}">${esc(assignExt)}</span>
                ${assignSize ? `<span>${esc(assignSize)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="file-actions">
            ${t.file_path ? `
              <button class="file-btn" onclick="window.appActions.openTaskFile('${t.id}')" title="Open file">
                ${t.is_folder ? 'Folder' : 'Open'}
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Connector Arrow -->
        <div class="pair-connector">
          <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>

        <!-- Right Box: Solution File (Attached or Interactive Drop Zone) -->
        ${hasSolution ? `
          <div 
            class="file-box solution-present" 
            id="sol-box-${t.id}"
            ondragover="window.appActions.handleCardDragOver(event, '${t.id}')"
            ondragleave="window.appActions.handleCardDragLeave(event, '${t.id}')"
            ondrop="window.appActions.handleCardDrop(event, '${t.id}', true)"
            title="Solution attached (drop file here to replace)"
          >
            <div class="file-main">
              <div class="file-icon-wrap" title="Solution attached">
                <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div class="file-texts">
                <span class="file-label" style="color:var(--done);">Solution Linked</span>
                <span class="file-name" title="${esc(solName)}">${esc(solName)}</span>
                <div class="file-meta-row">
                  <span class="file-ext-badge ${solExtClass}">${esc(solExt)}</span>
                  ${solSize ? `<span>${esc(solSize)}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="file-actions">
              <button class="file-btn file-btn-primary" onclick="window.appActions.openTaskSolution('${t.id}')" title="Open solution in browser">
                Solution
              </button>
            </div>
          </div>
        ` : `
          <div 
            class="file-box solution-missing ${!isOpt ? 'mandatory-missing' : ''}" 
            id="sol-box-${t.id}"
            onclick="window.appActions.triggerSolutionPicker('${t.id}')"
            ondragover="window.appActions.handleCardDragOver(event, '${t.id}')"
            ondragleave="window.appActions.handleCardDragLeave(event, '${t.id}')"
            ondrop="window.appActions.handleCardDrop(event, '${t.id}', true)"
            title="Click or drop solution file here"
          >
            <div class="file-main">
              <div class="file-icon-wrap">
                <svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              </div>
              <div class="file-texts">
                <span class="file-label" style="${!isOpt ? 'color:var(--opt);' : ''}">No solution attached</span>
                <span class="file-name" style="color:var(--text-muted); font-size:11.5px;">+ Drop solution file here or browse</span>
              </div>
            </div>
            <div class="file-actions">
              <button class="file-btn" onclick="event.stopPropagation(); window.appActions.triggerSolutionPicker('${t.id}')">
                Browse
              </button>
            </div>
          </div>
        `}
      </div>

      <!-- Collapsible Note Drawer -->
      <div class="note-drawer ${cleanNote ? 'open' : ''}" id="note-${t.id}">
        <input 
          type="text" 
          class="note-input" 
          placeholder="Add personal note (Press Enter to save)..." 
          value="${esc(t.notes || '')}"
          onblur="window.appActions.saveNote('${t.id}', this.value)"
          onkeydown="if(event.key==='Enter') this.blur()"
        >
      </div>
    </article>
  `;
}
