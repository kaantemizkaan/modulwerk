// ========================================================
// TASK CARD COMPONENT (DUAL-BOX FILE-PAIR LAYOUT)
// ========================================================

import { esc } from '../utils.js';

/**
 * Render single task card HTML
 * @param {Object} t 
 * @returns {string}
 */
export function renderTaskCard(t) {
  const isDone = !!t.completed;
  const isAbgabe = t.category === 'Hausaufgabe' && !isDone;
  const isOpt = !!t.is_optional;
  const cleanNote = (t.notes || '').trim();

  // Folder breadcrumb display
  const dirPath = t.file_path ? t.file_path.replace(/\\/g, '/').replace(/\/[^\/]+$/, '') : (t.subject + ' / ' + t.sheet);

  // Aufgabendatei information
  const assignName = t.file_name || (t.file_path ? t.file_path.split(/[\\\/]/).pop() : 'Aufgabendatei');
  const assignSize = t.file_size || '';
  const assignExt = (t.file_ext || 'PDF').toUpperCase();

  // Lösungsdatei information
  const hasSolution = !!(t.solution_path || t.solution_note);
  const solName = t.solution_name || (t.solution_path ? t.solution_path.split(/[\\\/]/).pop() : 'Lösungsdatei');
  const solSize = t.solution_size || '';
  const solExt = (t.solution_ext || 'PDF').toUpperCase();

  // Category badge class
  let catClass = '';
  if (t.category === 'Hausaufgabe') catClass = 'badge-abgabe';
  else if (t.category.includes('Präsenz')) catClass = 'badge-praesenz';
  else if (t.category === 'Praktikum') catClass = 'badge-praktikum';
  else if (t.category === 'Tutorium') catClass = 'badge-tutorium';

  // Extension classes
  const assignExtClass = assignExt === 'PDF' ? 'pdf' : (assignExt === 'JAVA' ? 'java' : '');
  const solExtClass = hasSolution ? 'sol' : (solExt === 'PDF' ? 'pdf' : '');

  return `
    <article 
      class="task-card ${isDone ? 'done' : ''} ${isAbgabe ? 'card-pending-abgabe' : ''} ${isOpt ? 'card-optional' : ''}" 
      id="card-${t.id}"
      data-subject="${esc(t.subject)}"
      data-category="${esc(t.category)}"
    >
      <!-- Top Row: Checkbox, Sheet, Title, Tags, Breadcrumb & Actions -->
      <div class="card-top">
        <div class="card-title-group">
          <button 
            class="cb-btn" 
            onclick="window.appActions.toggleTask('${t.id}')"
            title="${isDone ? 'Als offen markieren' : 'Als erledigt markieren'}"
          >
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </button>

          <span class="sheet-badge">${esc(t.sheet)}</span>

          <h2 class="card-title" onclick="window.appActions.toggleTask('${t.id}')" title="${esc(t.title)}">
            ${esc(t.title)}
          </h2>

          <span class="badge ${catClass}">${esc(t.category)}</span>

          <button 
            class="opt-tag ${isOpt ? 'optional' : 'mandatory'}"
            onclick="window.appActions.toggleOptional('${t.id}')"
            title="${isOpt ? 'Freiwillig (klicken, um zur Pflichtaufgabe zu machen)' : 'Pflichtaufgabe (klicken, um als freiwillig zu markieren)'}"
          >
            ${isOpt ? 'Freiwillig' : 'Pflicht'}
          </button>
        </div>

        <div class="card-meta-right">
          <span 
            class="folder-crumb" 
            onclick="window.appActions.openTaskFolder('${t.id}')"
            title="Ordner im Explorer öffnen: ${esc(dirPath)}"
          >
            <svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>${esc(dirPath)}</span>
          </span>

          <button 
            class="btn btn-icon" 
            onclick="window.appActions.toggleNoteDrawer('${t.id}')"
            title="${cleanNote ? 'Notiz anzeigen/bearbeiten' : 'Notiz hinzufügen'}"
            style="${cleanNote ? 'color: var(--lmu-green); border-color: var(--lmu-green-border); background: var(--lmu-green-bg);' : ''}"
          >
            <svg viewBox="0 0 24 24" style="width:13px;height:13px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>

          <button 
            class="btn btn-icon btn-delete" 
            onclick="window.appActions.promptDeleteTask('${t.id}')"
            title="Aufgabe dauerhaft löschen"
          >
            <svg viewBox="0 0 24 24" style="width:12px;height:12px;"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      <!-- The File-Pair Section: Distinct Left (Aufgabe) & Right (Lösung) Tiles -->
      <div class="file-pair-grid">
        <!-- Left Box: Aufgabendatei -->
        <div 
          class="file-box assignment" 
          ondragover="window.appActions.handleCardDragOver(event, '${t.id}')"
          ondragleave="window.appActions.handleCardDragLeave(event, '${t.id}')"
          ondrop="window.appActions.handleCardDrop(event, '${t.id}', false)"
        >
          <div class="file-main">
            <div class="file-icon-wrap ${assignExt === 'PDF' ? 'pdf-type' : (assignExt === 'JAVA' ? 'java-type' : '')}" title="${t.is_folder ? 'Ordner' : 'Dokument'}">
              ${t.is_folder ? `
                <svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              ` : `
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              `}
            </div>
            <div class="file-texts">
              <span class="file-label">Aufgabe</span>
              <span class="file-name" title="${esc(assignName)}">${esc(assignName)}</span>
              <div class="file-meta-row">
                <span class="file-ext-badge ${assignExtClass}">${esc(assignExt)}</span>
                ${assignSize ? `<span>${esc(assignSize)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="file-actions">
            ${t.file_path ? `
              <button class="file-btn" onclick="window.appActions.openTaskFile('${t.id}')" title="Datei öffnen">
                ${t.is_folder ? 'Ordner' : 'Öffnen'}
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Connector Arrow -->
        <div class="pair-connector">
          <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>

        <!-- Right Box: Lösungsdatei (Present or Interactive Drop Zone) -->
        ${hasSolution ? `
          <div 
            class="file-box solution-present" 
            id="sol-box-${t.id}"
            ondragover="window.appActions.handleCardDragOver(event, '${t.id}')"
            ondragleave="window.appActions.handleCardDragLeave(event, '${t.id}')"
            ondrop="window.appActions.handleCardDrop(event, '${t.id}', true)"
            title="Lösung vorhanden (Datei hier ablegen, um Lösung zu ersetzen)"
          >
            <div class="file-main">
              <div class="file-icon-wrap" title="Lösung verknüpft">
                <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div class="file-texts">
                <span class="file-label" style="color:var(--done);">Lösung verknüpft</span>
                <span class="file-name" title="${esc(solName)}">${esc(solName)}</span>
                <div class="file-meta-row">
                  <span class="file-ext-badge ${solExtClass}">${esc(solExt)}</span>
                  ${solSize ? `<span>${esc(solSize)}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="file-actions">
              <button class="file-btn file-btn-primary" onclick="window.appActions.openTaskSolution('${t.id}')" title="Lösung im Browser öffnen">
                Lösung
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
            title="Klicken veya Lösungs-PDF hier ablegen"
          >
            <div class="file-main">
              <div class="file-icon-wrap">
                <svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              </div>
              <div class="file-texts">
                <span class="file-label" style="${!isOpt ? 'color:var(--opt);' : ''}">Keine Lösung hinterlegt</span>
                <span class="file-name" style="color:var(--text-muted); font-size:11.5px;">+ Lösungsdatei hier ablegen oder wählen</span>
              </div>
            </div>
            <div class="file-actions">
              <button class="file-btn" onclick="event.stopPropagation(); window.appActions.triggerSolutionPicker('${t.id}')">
                Wählen
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
          placeholder="Eigene Notiz hinzufügen (Enter zum Speichern)..." 
          value="${esc(t.notes || '')}"
          onblur="window.appActions.saveNote('${t.id}', this.value)"
          onkeydown="if(event.key==='Enter') this.blur()"
        >
      </div>
    </article>
  `;
}
