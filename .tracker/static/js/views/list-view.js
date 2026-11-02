// ========================================================
// LIST VIEW (MODULE GROUPINGS + TASK CARDS)
// ========================================================

import { esc } from '../utils.js';
import { renderTaskCard } from '../components/task-card.js';

const modClasses = {
  'Analysis': 'analysis',
  'EiP': 'eip',
  'Lineare Algebra': 'linalg',
  'Statistik': 'statistik'
};

/**
 * Render the full list view
 * @param {Array} filtered Tasks matching current active filters
 * @param {Array} modules List of all standard modules
 * @returns {string} HTML string
 */
export function renderListView(filtered, modules) {
  const activeModules = modules.filter(m => filtered.some(t => t.subject === m));
  const otherTasks = filtered.filter(t => !modules.includes(t.subject));
  if (otherTasks.length) activeModules.push('Sonstige');

  const groupsHtml = activeModules.map(mod => {
    const groupItems = filtered.filter(t => (modules.includes(t.subject) ? t.subject === mod : mod === 'Sonstige'));
    const gDone = groupItems.filter(t => t.completed).length;
    const gMand = groupItems.filter(t => !t.is_optional);
    const gMandDone = gMand.filter(t => t.completed).length;
    const cls = modClasses[mod] || 'analysis';

    const cardsHtml = groupItems.map(t => renderTaskCard(t)).join('');

    return `
      <section class="module-group" data-module="${esc(mod)}">
        <div class="group-header">
          <div class="group-header-left">
            <span class="mod-dot ${cls}"></span>
            <span>${esc(mod)}</span>
          </div>
          <span class="group-header-meta">${gMandDone}/${gMand.length} Pflichtaufgaben · ${gDone}/${groupItems.length} gesamt</span>
        </div>
        <div class="task-cards-list">${cardsHtml}</div>
      </section>
    `;
  }).join('');

  return `<div class="groups-container">${groupsHtml}</div>`;
}
