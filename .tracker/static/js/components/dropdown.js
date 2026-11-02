// ========================================================
// CUSTOM FLOATING DROPDOWN COMPONENT (Linear / Raycast UI)
// ========================================================

import { state, notifySubscribers } from '../state.js';

const dropdownLabels = {
  Subject: {
    'all': 'Alle Module',
    'Analysis': 'Analysis',
    'EiP': 'EiP',
    'Lineare Algebra': 'Lineare Algebra',
    'Statistik': 'Statistik'
  },
  Type: {
    'all': 'Pflicht & Freiwillig',
    'mandatory': 'Nur Pflicht',
    'optional': 'Freiwillig'
  },
  Category: {
    'all': 'Alle Kategorien',
    'Hausaufgabe': 'Hausaufgabe',
    'Übungsblatt': 'Übungsblatt',
    'Präsenzübung': 'Präsenzübung',
    'Praktikum': 'Praktikum',
    'Tutorium': 'Tutorium'
  }
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

export function syncDropdownUI() {
  // Sync Subject
  const lblSubj = document.getElementById('labelSubject');
  if (lblSubj) {
    lblSubj.textContent = dropdownLabels.Subject[state.filterSubject] || state.filterSubject;
    const trig = lblSubj.closest('.dropdown-trigger');
    if (trig) trig.classList.toggle('active-filter', state.filterSubject !== 'all');
    syncDropdownMenuSelected('Subject', state.filterSubject);
  }

  // Sync Type
  const lblType = document.getElementById('labelType');
  if (lblType) {
    lblType.textContent = dropdownLabels.Type[state.filterType] || state.filterType;
    const trig = lblType.closest('.dropdown-trigger');
    if (trig) trig.classList.toggle('active-filter', state.filterType !== 'all');
    syncDropdownMenuSelected('Type', state.filterType);
  }

  // Sync Category
  const lblCat = document.getElementById('labelCategory');
  if (lblCat) {
    lblCat.textContent = dropdownLabels.Category[state.filterCategory] || state.filterCategory;
    const trig = lblCat.closest('.dropdown-trigger');
    if (trig) trig.classList.toggle('active-filter', state.filterCategory !== 'all');
    syncDropdownMenuSelected('Category', state.filterCategory);
  }
}

function syncDropdownMenuSelected(name, val) {
  const menu = document.getElementById('menu' + name);
  if (!menu) return;
  menu.querySelectorAll('.dropdown-item').forEach(item => {
    item.classList.toggle('selected', item.getAttribute('data-value') === val);
  });
}
