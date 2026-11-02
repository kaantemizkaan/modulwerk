// ========================================================
// CUSTOM FLOATING DROPDOWN COMPONENT (ENGLISH)
// ========================================================

import { state, getActiveModules, getActiveCategories, getModuleColor, notifySubscribers } from '../state.js';
import { esc } from '../utils.js';

const categoryLabels = {
  'Hausaufgabe': 'Homework',
  'Übungsblatt': 'Exercise Sheet',
  'Präsenzübung': 'In-Class Lab',
  'Praktikum': 'Lab / Project',
  'Tutorium': 'Tutorial'
};

export function initDropdowns() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown')) {
      closeAllDropdowns();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
    }
  });
}

export function toggleDropdown(name, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const dd = document.getElementById('dropdown' + name);
  if (!dd) return;
  const wasOpen = dd.classList.contains('open');
  closeAllDropdowns();
  if (!wasOpen) {
    dd.classList.add('open');
  }
}

export function closeAllDropdowns() {
  document.querySelectorAll('.custom-dropdown.open').forEach(el => el.classList.remove('open'));
}

export function selectDropdown(name, val) {
  if (name === 'Subject') {
    state.filterSubject = val;
  } else if (name === 'Type') {
    state.filterType = val;
  } else if (name === 'Category') {
    state.filterCategory = val;
  }
  closeAllDropdowns();
  notifySubscribers();
}

/**
 * Re-render dropdown items dynamically based on current modules & categories
 */
export function syncDropdownUI() {
  const activeModules = getActiveModules();
  const activeCategories = getActiveCategories();

  // 1. Sync Subject Dropdown
  const lblSubj = document.getElementById('labelSubject');
  const menuSubj = document.getElementById('menuSubject');
  if (lblSubj) {
    lblSubj.textContent = state.filterSubject === 'all' ? 'All Modules' : state.filterSubject;
    const trig = lblSubj.closest('.dropdown-trigger');
    if (trig) trig.classList.toggle('active-filter', state.filterSubject !== 'all');
  }

  if (menuSubj) {
    const isAll = state.filterSubject === 'all';
    let html = `
      <div class="dropdown-item ${isAll ? 'selected' : ''}" data-value="all" onclick="window.appActions.selectDropdown('Subject', 'all')">
        <span>All Modules</span>
        <svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    `;

    activeModules.forEach(mod => {
      const isSel = state.filterSubject === mod;
      const col = getModuleColor(mod);
      html += `
        <div class="dropdown-item ${isSel ? 'selected' : ''}" data-value="${esc(mod)}" onclick="window.appActions.selectDropdown('Subject', '${esc(mod)}')">
          <span class="dropdown-opt-label">
            <span class="mod-dot" style="background:${col.color}; width:7px; height:7px; border-radius:50%; display:inline-block;"></span>
            ${esc(mod)}
          </span>
          <svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      `;
    });
    menuSubj.innerHTML = html;
  }

  // 2. Sync Type Dropdown
  const lblType = document.getElementById('labelType');
  const typeLabels = {
    'all': 'All Types',
    'mandatory': 'Required Only',
    'optional': 'Optional Only'
  };
  if (lblType) {
    lblType.textContent = typeLabels[state.filterType] || state.filterType;
    const trig = lblType.closest('.dropdown-trigger');
    if (trig) trig.classList.toggle('active-filter', state.filterType !== 'all');
    syncDropdownMenuSelected('Type', state.filterType);
  }

  // 3. Sync Category Dropdown
  const lblCat = document.getElementById('labelCategory');
  const menuCat = document.getElementById('menuCategory');
  if (lblCat) {
    const currentCatDisplay = state.filterCategory === 'all' ? 'All Categories' : (categoryLabels[state.filterCategory] || state.filterCategory);
    lblCat.textContent = currentCatDisplay;
    const trig = lblCat.closest('.dropdown-trigger');
    if (trig) trig.classList.toggle('active-filter', state.filterCategory !== 'all');
  }

  if (menuCat && activeCategories.length > 0) {
    const isCatAll = state.filterCategory === 'all';
    let catHtml = `
      <div class="dropdown-item ${isCatAll ? 'selected' : ''}" data-value="all" onclick="window.appActions.selectDropdown('Category', 'all')">
        <span>All Categories</span>
        <svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    `;
    activeCategories.forEach(cat => {
      const isSel = state.filterCategory === cat;
      const displayLabel = categoryLabels[cat] || cat;
      catHtml += `
        <div class="dropdown-item ${isSel ? 'selected' : ''}" data-value="${esc(cat)}" onclick="window.appActions.selectDropdown('Category', '${esc(cat)}')">
          <span>${esc(displayLabel)}</span>
          <svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      `;
    });
    menuCat.innerHTML = catHtml;
  }
}

function syncDropdownMenuSelected(name, val) {
  const menu = document.getElementById('menu' + name);
  if (!menu) return;
  menu.querySelectorAll('.dropdown-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.value === val);
  });
}
