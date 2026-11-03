// ========================================================
// MODAL CONTROLLERS & POPUPS (ENGLISH)
// ========================================================

import { state, notifySubscribers, showToast, getActiveModules } from '../state.js';
import * as api from '../api.js';
import { esc } from '../utils.js';

// --------------------------------------------------------
// 1. CREATE CUSTOM TASK MODAL
// --------------------------------------------------------
export function openModal() {
  const modal = document.getElementById('taskModal');
  if (modal) {
    const activeMods = getActiveModules();
    const dlist = document.getElementById('mSubjectList');
    if (dlist) {
      dlist.innerHTML = activeMods.map(m => `<option value="${esc(m)}"></option>`).join('');
    }
    const subjInput = document.getElementById('mSubject');
    if (subjInput) {
      if (subjInput.tagName === 'SELECT') {
        const currentVal = subjInput.value;
        subjInput.innerHTML = activeMods.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
        if (currentVal && activeMods.includes(currentVal)) {
          subjInput.value = currentVal;
        }
      } else if (!subjInput.value && activeMods.length > 0 && activeMods[0] !== 'General') {
        subjInput.value = activeMods[0];
      }
    }

    modal.classList.add('open');
    const input = document.getElementById('mTitle');
    if (input) input.focus();
  }
}

export function closeModal() {
  const modal = document.getElementById('taskModal');
  if (modal) modal.classList.remove('open');
}

export async function createCustomTaskAction() {
  const titleInput = document.getElementById('mTitle');
  const title = titleInput ? titleInput.value.trim() : '';
  if (!title) return;

  const isOpt = document.getElementById('mIsOptional') ? document.getElementById('mIsOptional').checked : false;
  const payload = {
    subject: document.getElementById('mSubject') ? document.getElementById('mSubject').value : 'General',
    category: document.getElementById('mCategory') ? document.getElementById('mCategory').value : 'Homework',
    sheet: (document.getElementById('mSheet') ? document.getElementById('mSheet').value.trim() : '') || 'Sheet 01',
    title,
    notes: document.getElementById('mNotes') ? document.getElementById('mNotes').value.trim() : '',
    is_optional: isOpt
  };

  try {
    if (state.isOnline) {
      await api.createCustomTask(payload);
      closeModal();
      if (titleInput) titleInput.value = '';
      const notesInput = document.getElementById('mNotes');
      if (notesInput) notesInput.value = '';
      const optCb = document.getElementById('mIsOptional');
      if (optCb) optCb.checked = false;

      const data = await api.fetchTasks();
      state.tasks = data.tasks || [];
      state.ignoredTasks = data.ignored_tasks || [];
      notifySubscribers();
      showToast('Task added successfully');
    } else {
      state.tasks.push({ id: 'custom-' + Date.now(), ...payload, completed: false, is_custom: true });
      localStorage.setItem('modulwerk_tasks', JSON.stringify(state.tasks));
      closeModal();
      notifySubscribers();
      showToast('Task added (offline mode)');
    }
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

// --------------------------------------------------------
// 2. PERMANENT DELETE TASK MODAL
// --------------------------------------------------------
export function openDeleteModal(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  state.pendingDeleteTaskId = id;

  const titleEl = document.getElementById('delTaskTitle');
  if (titleEl) titleEl.textContent = t.title;

  const pathEl = document.getElementById('delTaskPath');
  if (pathEl) pathEl.textContent = t.file_path ? t.file_path.replace(/\\/g, '/') : 'Custom Task';

  const chkEl = document.getElementById('delFromDisk');
  if (chkEl) chkEl.checked = false;

  const modal = document.getElementById('deleteModal');
  if (modal) modal.classList.add('open');
}

export function closeDeleteModal() {
  const modal = document.getElementById('deleteModal');
  if (modal) modal.classList.remove('open');
  state.pendingDeleteTaskId = null;
}

export async function executeDeleteTaskAction() {
  if (!state.pendingDeleteTaskId) return;
  const id = state.pendingDeleteTaskId;
  const chkEl = document.getElementById('delFromDisk');
  const deleteFromDisk = chkEl ? chkEl.checked : false;
  closeDeleteModal();

  if (state.isOnline) {
    try {
      const result = await api.deleteTask(id, deleteFromDisk);
      if (result.data && result.data.tasks) {
        state.tasks = result.data.tasks;
        state.ignoredTasks = Array.isArray(result.data.ignored_tasks) ? result.data.ignored_tasks : (result.data.ignored_tasks ? [result.data.ignored_tasks] : []);
        notifySubscribers();
      } else {
        const data = await api.fetchTasks();
        state.tasks = data.tasks || [];
        state.ignoredTasks = data.ignored_tasks || [];
        notifySubscribers();
      }
      showToast(deleteFromDisk ? 'Task and file permanently deleted' : 'Task removed from tracker');
    } catch {
      showToast('Error deleting task');
    }
  } else {
    state.tasks = state.tasks.filter(x => x.id !== id);
    localStorage.setItem('modulwerk_tasks', JSON.stringify(state.tasks));
    notifySubscribers();
    showToast('Task removed locally');
  }
}

// --------------------------------------------------------
// 3. IGNORED / DELETED TASKS RESTORE MODAL
// --------------------------------------------------------
export function openIgnoredModal() {
  const container = document.getElementById('ignoredListContainer');
  if (!container) return;

  if (!state.ignoredTasks || state.ignoredTasks.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:20px;">No ignored or deleted tasks found.</div>';
  } else {
    container.innerHTML = state.ignoredTasks.map(it => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--bg); border:1px solid var(--border); border-radius:6px; gap:8px;">
        <div style="min-width:0; flex:1;">
          <div style="font-size:12.5px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${esc(it.title || it.file_name || it.id)}
          </div>
          <div style="font-family:var(--font-mono); font-size:10.5px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${esc(it.file_path ? it.file_path.replace(/\\/g, '/') : '')}
            ${it.deleted_from_disk ? ' · <span style="color:var(--warn);">File deleted</span>' : ''}
          </div>
        </div>
        <button class="btn" style="height:25px; padding:0 8px; font-size:11.5px;" onclick="window.appActions.restoreTask('${esc(it.id)}')">
          Restore
        </button>
      </div>
    `).join('');
  }

  const modal = document.getElementById('ignoredModal');
  if (modal) modal.classList.add('open');
}

export function closeIgnoredModal() {
  const modal = document.getElementById('ignoredModal');
  if (modal) modal.classList.remove('open');
}

export async function restoreTaskAction(id) {
  if (!state.isOnline) {
    showToast('Restore requires an active server connection');
    return;
  }
  try {
    const result = await api.restoreTask(id);
    if (result.data && result.data.tasks) {
      state.tasks = result.data.tasks;
      state.ignoredTasks = Array.isArray(result.data.ignored_tasks) ? result.data.ignored_tasks : (result.data.ignored_tasks ? [result.data.ignored_tasks] : []);
      notifySubscribers();
    } else {
      const data = await api.fetchTasks();
      state.tasks = data.tasks || [];
      state.ignoredTasks = data.ignored_tasks || [];
      notifySubscribers();
    }
    openIgnoredModal();
    showToast('Task restored successfully');
  } catch {
    showToast('Server error during restore');
  }
}

// --------------------------------------------------------
// 4. FILENAME NORMALIZER MODAL
// --------------------------------------------------------
export async function checkNormalizeCandidates() {
  if (!state.isOnline) return;
  try {
    const data = await api.fetchNormalizePreview();
    if (data.success && Array.isArray(data.candidates)) {
      state.normalizeCandidates = data.candidates;
      const btn = document.getElementById('btnNormalize');
      const cnt = document.getElementById('cnt-normalize');
      if (btn && cnt) {
        cnt.textContent = state.normalizeCandidates.length;
        btn.style.display = state.normalizeCandidates.length > 0 ? 'inline-flex' : 'none';
      }
    }
  } catch (e) {
    console.warn('Normalize preview check error:', e);
  }
}

export function openNormalizeModal() {
  if (state.normalizeCandidates.length === 0) {
    showToast('All file names already follow the standard schema!');
    return;
  }

  state.pendingNormalizeSelections.clear();
  state.normalizeCandidates.forEach((_, idx) => state.pendingNormalizeSelections.add(idx));

  renderNormalizeTable();
  const modal = document.getElementById('normalizeModal');
  if (modal) modal.classList.add('open');
}

export function closeNormalizeModal() {
  const modal = document.getElementById('normalizeModal');
  if (modal) modal.classList.remove('open');
}

export function renderNormalizeTable() {
  const tbody = document.getElementById('normTableBody');
  const selAll = document.getElementById('normSelectAll');
  const sumText = document.getElementById('normSummaryText');
  const execBtn = document.getElementById('btnExecuteNormalize');

  if (!tbody) return;

  if (selAll) {
    selAll.checked = state.pendingNormalizeSelections.size === state.normalizeCandidates.length && state.normalizeCandidates.length > 0;
  }
  if (sumText) {
    sumText.textContent = `${state.pendingNormalizeSelections.size} of ${state.normalizeCandidates.length} files selected`;
  }
  if (execBtn) {
    execBtn.disabled = state.pendingNormalizeSelections.size === 0;
  }

  tbody.innerHTML = state.normalizeCandidates.map((c, idx) => {
    const isChecked = state.pendingNormalizeSelections.has(idx);
    const displayType = c.isSolution ? 'Solution' : 'Assignment';
    return `
      <tr>
        <td style="text-align:center;">
          <input 
            type="checkbox" 
            ${isChecked ? 'checked' : ''} 
            onchange="window.appActions.toggleNormalizeCandidate(${idx}, this.checked)"
          >
        </td>
        <td>
          <span style="font-weight:600; font-size:11.5px; color:var(--text);">${esc(c.subject)}</span>
          <div style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted);">${esc(c.sheet)}</div>
        </td>
        <td>
          <span class="badge ${c.isSolution ? 'badge-loesung' : 'badge-abgabe'}" style="font-size:10px;">
            ${esc(displayType)}
          </span>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="norm-old-name">${esc(c.currentName)}</span>
            <span class="norm-arrow">➔</span>
            <span class="norm-new-name">${esc(c.proposedName)}</span>
          </div>
          <div style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted); margin-top:2px;">
            ${esc(c.currentRelPath ? c.currentRelPath.replace(/\\/g, '/') : '')}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

export function toggleNormalizeCandidate(idx, checked) {
  if (checked) {
    state.pendingNormalizeSelections.add(idx);
  } else {
    state.pendingNormalizeSelections.delete(idx);
  }
  renderNormalizeTable();
}

export function toggleAllNormalizeCandidates(checked) {
  if (checked) {
    state.normalizeCandidates.forEach((_, idx) => state.pendingNormalizeSelections.add(idx));
  } else {
    state.pendingNormalizeSelections.clear();
  }
  renderNormalizeTable();
}

export async function executeNormalizeAction() {
  if (state.pendingNormalizeSelections.size === 0) return;

  const items = Array.from(state.pendingNormalizeSelections).map(idx => state.normalizeCandidates[idx]);
  closeNormalizeModal();
  showToast('Standardizing file names...');

  try {
    const result = await api.executeNormalize(items);
    if (result.success) {
      if (result.data && result.data.tasks) {
        state.tasks = result.data.tasks;
        state.ignoredTasks = Array.isArray(result.data.ignored_tasks) ? result.data.ignored_tasks : (result.data.ignored_tasks ? [result.data.ignored_tasks] : []);
        notifySubscribers();
      } else {
        const data = await api.fetchTasks();
        state.tasks = data.tasks || [];
        state.ignoredTasks = data.ignored_tasks || [];
        notifySubscribers();
      }
      showToast(`${result.renamedCount} file names standardized successfully ✓`);
      checkNormalizeCandidates();
    } else {
      showToast('Error: ' + (result.errors || []).join(', '));
    }
  } catch (e) {
    showToast('Server error during standardization');
  }
}

// --------------------------------------------------------
// 5. NOTE DRAWER HELPER
// --------------------------------------------------------
export function toggleNoteDrawer(id) {
  const drawer = document.getElementById('note-' + id);
  if (!drawer) return;
  const isOpen = drawer.classList.toggle('open');
  if (isOpen) {
    const input = drawer.querySelector('input');
    if (input) input.focus();
  }
}
