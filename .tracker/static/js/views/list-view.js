// ========================================================
// LIST VIEW (DYNAMIC MODULE GROUPINGS + TASK CARDS - ENGLISH)
// ========================================================

import { esc } from '../utils.js';
import { getModuleColor } from '../state.js';
import { renderTaskCard } from '../components/task-card.js';

/**
 * Render the full list view dynamically adapting to any subject
 * @param {Array} filtered Tasks matching current active filters
 * @param {Array} modules List of all detected modules
 * @returns {string} HTML string
 */
export function renderListView(filtered, modules) {
  const activeModules = modules.filter(m => filtered.some(t => t.subject === m));
  const otherTasks = filtered.filter(t => !modules.includes(t.subject));
  if (otherTasks.length) activeModules.push('Other');

  const groupsHtml = activeModules.map(mod => {
    const groupItems = filtered.filter(t => (modules.includes(t.subject) ? t.subject === mod : mod === 'Other'));
    groupItems.sort((a, b) => {
      const sa = parseInt((a.sheet || '').replace(/\D/g, '') || '0', 10);
      const sb = parseInt((b.sheet || '').replace(/\D/g, '') || '0', 10);
      if (sa !== sb) return sa - sb;
      return (a.title || '').localeCompare(b.title || '');
    });

    const gDone = groupItems.filter(t => t.completed).length;
    const gMand = groupItems.filter(t => !t.is_optional);
    const gMandDone = gMand.filter(t => t.completed).length;
    const col = getModuleColor(mod);

    const cardsHtml = groupItems.map(t => renderTaskCard(t)).join('');

    return `
      <section class="module-group" data-module="${esc(mod)}" style="border-left: 2px solid ${col.border};">
        <div class="group-header">
          <div class="group-header-left">
            <span class="mod-dot" style="background: ${col.color}; box-shadow: 0 0 8px ${col.bg};"></span>
            <span>${esc(mod)}</span>
          </div>
          <span class="group-header-meta">${gMandDone}/${gMand.length} required · ${gDone}/${groupItems.length} total</span>
        </div>
        <div class="task-cards-list">${cardsHtml}</div>
      </section>
    `;
  }).join('');

  return `<div class="groups-container">${groupsHtml}</div>`;
}
