const FILTERS = [
  { key: 'normal',         label: 'Normal',        desc: 'Sem filtro' },
  { key: 'protanopia',     label: 'Protanopia',    desc: 'Deficiência em vermelho' },
  { key: 'protanomalia',   label: 'Protanomalia',  desc: 'Leve — vermelho' },
  { key: 'deuteranopia',   label: 'Deuteranopia',  desc: 'Deficiência em verde' },
  { key: 'deuteranomalia', label: 'Deuteranomalia',desc: 'Leve — verde' },
  { key: 'tritanopia',     label: 'Tritanopia',    desc: 'Deficiência em azul' },
  { key: 'tritanomalia',   label: 'Tritanomalia',  desc: 'Leve — azul' },
  { key: 'achromatopsia',  label: 'Acromatopsia',  desc: 'Sem percepção de cor' }
];

const api = window.colorSenseAPI;
let prefs = {};

const filterToggle = document.getElementById('filter-toggle');
const statusBadge  = document.getElementById('status-badge');
const activeLabel  = document.getElementById('active-type-label');
const filterGrid   = document.getElementById('filter-grid');
const opacitySlider = document.getElementById('opacity-slider');
const opacityValue  = document.getElementById('opacity-value');

function updateUI() {
  filterToggle.checked = prefs.filterActive || false;
  statusBadge.textContent = prefs.filterActive ? 'Ativo' : 'Desativado';
  statusBadge.className = 'badge ' + (prefs.filterActive ? 'badge-on' : 'badge-off');

  const active = FILTERS.find(f => f.key === prefs.filterType);
  activeLabel.textContent = prefs.filterActive && active
    ? active.label
    : 'Nenhum filtro ativo';

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.key === prefs.filterType);
  });

  opacitySlider.value = Math.round((prefs.opacity || 1) * 100);
  opacityValue.textContent = opacitySlider.value + '%';
}

function buildGrid() {
  filterGrid.innerHTML = '';
  FILTERS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.key = f.key;
    btn.innerHTML = `<span class="btn-label">${f.label}</span><span class="btn-desc">${f.desc}</span>`;
    btn.addEventListener('click', async () => {
      prefs = await api.setFilterType(f.key);
      updateUI();
    });
    filterGrid.appendChild(btn);
  });
}

filterToggle.addEventListener('change', async () => {
  prefs = await api.toggleOverlay(filterToggle.checked);
  updateUI();
});

opacitySlider.addEventListener('input', () => {
  opacityValue.textContent = opacitySlider.value + '%';
});

opacitySlider.addEventListener('change', async () => {
  prefs = await api.savePreferences({ opacity: opacitySlider.value / 100 });
  updateUI();
});

api.onApplyFilter(({ type, active }) => {
  prefs.filterType = type;
  prefs.filterActive = active;
  updateUI();
});

async function init() {
  prefs = await api.getPreferences();
  buildGrid();
  updateUI();
}

init();
