const api = window.colorSenseAPI;

const FILTERS = [
  { key: 'normal',         label: 'Normal',         desc: 'Sem filtro' },
  { key: 'protanopia',     label: 'Protanopia',     desc: 'Deficiência em vermelho' },
  { key: 'protanomalia',   label: 'Protanomalia',   desc: 'Leve — vermelho' },
  { key: 'deuteranopia',   label: 'Deuteranopia',   desc: 'Deficiência em verde' },
  { key: 'deuteranomalia', label: 'Deuteranomalia', desc: 'Leve — verde' },
  { key: 'tritanopia',     label: 'Tritanopia',     desc: 'Deficiência em azul' },
  { key: 'tritanomalia',   label: 'Tritanomalia',   desc: 'Leve — azul' },
  { key: 'achromatopsia',  label: 'Acromatopsia',   desc: 'Sem percepção de cor' },
  { key: 'achromatomaly',  label: 'Acromatomalia',  desc: 'Percepção de cor reduzida' }
];

const PATTERNS = [
  { key: 'diagonal',   label: 'Diagonal'    },
  { key: 'crosshatch', label: 'Hachura'     },
  { key: 'horizontal', label: 'Horizontal'  },
  { key: 'vertical',   label: 'Vertical'    },
  { key: 'dots',       label: 'Pontos'      },
  { key: 'zigzag',     label: 'Zigzag'      }
];

// ── Estado ────────────────────────────────────────────────────────────────────

const state = {
  prefs: {},
  scenes: [],
  filterInfo: {},       // { tipo: { temCorrecao } } — vem do processo principal
  user: null,
  view: 'filter',       // 'filter' | 'scenes' | 'creator' | 'edit'
  editingScene: null,
  editingRuleId: null,  // id da regra em edição (null = formulário de nova regra)
  sim: { active: false, type: 'protanopia' }
};

// ── Refs fixos ────────────────────────────────────────────────────────────────

const contentEl    = document.getElementById('content');
const tabsEl       = document.getElementById('tabs');
const statusBadge  = document.getElementById('status-badge');
const userNameEl   = document.getElementById('user-name');
const globalToggle = document.getElementById('global-toggle');

// ── Render principal ──────────────────────────────────────────────────────────

function render() {
  tabsEl.style.display = state.view === 'edit' ? 'none' : 'flex';
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === state.view)
  );

  if (state.view === 'filter')       renderFilter();
  else if (state.view === 'scenes')  renderScenes();
  else if (state.view === 'creator') renderCreator();
  else if (state.view === 'edit')    renderEdit();

  updateGlobalControls();
}

function updateGlobalControls() {
  const on = state.prefs.filterActive;
  globalToggle.checked = on || false;

  // A simulação do Criador tem prioridade sobre o filtro e afeta a tela toda.
  // Se ela está ligada, o rodapé precisa dizer isso mesmo quando o usuário já
  // saiu daquela aba — senão o badge afirma "Ativo"/"Desativado" enquanto a
  // tela está, na verdade, simulando daltonismo.
  if (state.sim?.active) {
    const tipo = FILTERS.find(f => f.key === state.sim.type)?.label || '';
    statusBadge.textContent = 'Simulando' + (tipo ? ' · ' + tipo : '');
    statusBadge.className   = 'badge badge-sim';
    return;
  }

  statusBadge.textContent = on ? 'Ativo' : 'Desativado';
  statusBadge.className   = 'badge ' + (on ? 'badge-on' : 'badge-off');
}

// ── View: Filtro ──────────────────────────────────────────────────────────────

function renderFilter() {
  const activeScene = state.scenes.find(s => s.id === state.prefs.activeSceneId);
  const filterLabel = FILTERS.find(f => f.key === state.prefs.filterType)?.label || 'Normal';
  const opPct       = Math.round((state.prefs.opacity ?? 1) * 100);

  contentEl.innerHTML = `
    ${activeScene ? `
    <div class="card profile-banner">
      <div class="profile-banner-row">
        <div>
          <p class="label">${esc(activeScene.name)}</p>
          <p class="sublabel">Cena ativa · ${filterLabel}</p>
        </div>
        <button class="btn-sm" id="btn-switch">Trocar cena</button>
      </div>
    </div>` : ''}

    <section class="card">
      <p class="section-title">Tipo de Daltonismo</p>
      <div class="filter-grid" id="filter-grid"></div>
    </section>

    <section class="card">
      <p class="section-title">Intensidade do Filtro</p>
      <div class="slider-row">
        <input type="range" id="opacity-slider" min="0" max="100" value="${opPct}">
        <span id="opacity-value">${opPct}%</span>
      </div>
    </section>
  `;

  const grid = document.getElementById('filter-grid');
  FILTERS.forEach(f => {
    // Acromatopsia não tem correção possível por matriz linear: não sobra
    // canal funcional para onde realocar a cor perdida. Dizer isso é melhor
    // que oferecer um botão que não faz nada.
    const semCorrecao = f.key !== 'normal' && state.filterInfo[f.key]?.temCorrecao === false;

    const btn = document.createElement('button');
    btn.className = 'filter-btn'
      + (f.key === state.prefs.filterType ? ' active' : '')
      + (semCorrecao ? ' filter-btn-indisponivel' : '');
    btn.dataset.key = f.key;
    btn.disabled = semCorrecao;
    if (semCorrecao) btn.title = 'Sem correção possível por filtro de cor';
    btn.innerHTML = `<span class="btn-label">${esc(f.label)}</span>`
      + `<span class="btn-desc">${semCorrecao ? 'Sem correção disponível' : esc(f.desc)}</span>`;
    btn.addEventListener('click', async () => {
      if (semCorrecao) return;
      state.prefs = await api.setFilterType(f.key);
      render();
    });
    grid.appendChild(btn);
  });

  document.getElementById('btn-switch')?.addEventListener('click', () => switchTab('scenes'));

  const slider  = document.getElementById('opacity-slider');
  const opLabel = document.getElementById('opacity-value');
  slider.addEventListener('input', () => { opLabel.textContent = slider.value + '%'; });
  slider.addEventListener('change', async () => {
    state.prefs = await api.savePreferences({ opacity: slider.value / 100 });
  });
}

// ── View: Cenas ───────────────────────────────────────────────────────────────

function renderScenes() {
  const activeId = state.prefs.activeSceneId;

  contentEl.innerHTML = `
    <div class="profiles-header">
      <p class="section-title" style="margin:0">Minhas Cenas</p>
      <button class="btn-sm btn-primary" id="btn-new">+ Nova</button>
    </div>
    <div id="scene-list">
      ${state.scenes.length === 0
        ? '<p class="empty-state">Nenhuma cena ainda.<br>Clique em "+ Nova" para criar.</p>'
        : state.scenes.map(s => sceneCardHTML(s, activeId)).join('')}
    </div>
  `;

  document.getElementById('btn-new').addEventListener('click', () => openEdit(null));

  state.scenes.forEach(s => {
    document.getElementById(`btn-activate-${s.id}`)
      ?.addEventListener('click', () => activateScene(s));
    document.getElementById(`btn-edit-${s.id}`)
      .addEventListener('click', () => openEdit(s));
    document.getElementById(`btn-delete-${s.id}`)
      ?.addEventListener('click', () => removeScene(s));
  });
}

function sceneCardHTML(s, activeId) {
  const isActive    = s.id === activeId;
  const filterLabel = FILTERS.find(f => f.key === s.filter_type)?.label || s.filter_type;
  const rulesCount  = s.pattern_rules?.length ?? 0;

  return `
    <div class="card profile-card ${isActive ? 'profile-active' : ''}">
      <div class="profile-card-top">
        <div class="profile-card-info">
          <p class="profile-name">${esc(s.name)}</p>
          <div class="profile-meta">
            <span class="chip">${esc(filterLabel)}</span>
            ${rulesCount > 0 ? `<span class="chip chip-rules">${rulesCount} regra${rulesCount > 1 ? 's' : ''}</span>` : ''}
            ${isActive ? '<span class="chip chip-active">Ativa</span>' : ''}
          </div>
        </div>
      </div>
      <div class="profile-card-actions">
        ${!isActive ? `<button class="btn-sm btn-primary" id="btn-activate-${s.id}">Ativar</button>` : ''}
        <button class="btn-sm" id="btn-edit-${s.id}">Editar</button>
        ${!s.is_default ? `<button class="btn-sm btn-danger" id="btn-delete-${s.id}">Excluir</button>` : ''}
      </div>
    </div>
  `;
}

async function activateScene(scene) {
  state.prefs = await api.activateScene(scene.id, scene.filter_type, scene.pattern_rules || []);
  render();
}

async function removeScene(scene) {
  if (!confirm(`Excluir a cena "${scene.name}"?`)) return;
  await api.deleteScene(scene.id);
  if (state.prefs.activeSceneId === scene.id)
    state.prefs = await api.savePreferences({ activeSceneId: null });
  state.scenes = await api.getScenes();
  render();
}

// ── View: Criador (simulação para designers/devs) ─────────────────────────────

function renderCreator() {
  const simTypes = FILTERS.filter(f => f.key !== 'normal');
  const active   = state.sim.active;
  const curLabel = FILTERS.find(f => f.key === state.sim.type)?.label || '';

  contentEl.innerHTML = `
    <section class="card creator-intro">
      <p class="label">Modo Criador</p>
      <p class="sublabel">
        Simule como pessoas com daltonismo enxergam sua tela.
        Ative a simulação e abra seu design, site ou app para validar as cores.
      </p>
    </section>

    <section class="card">
      <div class="toggle-row">
        <div>
          <p class="label">Simulação de daltonismo</p>
          <p class="sublabel" id="sim-status">
            ${active ? `Simulando: ${curLabel}` : 'Desativada'}
          </p>
        </div>
        <label class="switch">
          <input type="checkbox" id="sim-toggle" ${active ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
    </section>

    <section class="card">
      <p class="section-title">Tipo de daltonismo a simular</p>
      <div class="filter-grid" id="sim-grid"></div>
    </section>

    <p class="creator-hint">
      A simulação afeta toda a tela e tem prioridade sobre o filtro de correção.
      Os padrões visuais ficam ocultos enquanto ela está ativa.
    </p>
  `;

  const grid = document.getElementById('sim-grid');
  simTypes.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (f.key === state.sim.type ? ' active' : '');
    btn.dataset.key = f.key;
    btn.innerHTML = `<span class="btn-label">${f.label}</span><span class="btn-desc">${f.desc}</span>`;
    btn.addEventListener('click', async () => {
      state.sim = await api.setSimType(f.key);
      renderCreator();
      updateGlobalControls();
    });
    grid.appendChild(btn);
  });

  document.getElementById('sim-toggle').addEventListener('change', async (e) => {
    state.sim = await api.toggleSim(e.target.checked);
    renderCreator();
    updateGlobalControls();
  });
}

// ── View: Editar cena ─────────────────────────────────────────────────────────

function openEdit(scene) {
  state.editingScene  = scene ? JSON.parse(JSON.stringify(scene)) : null;
  state.editingRuleId = null;
  state.view = 'edit';
  render();
}

function renderEdit() {
  const s     = state.editingScene;
  const isNew = !s;

  contentEl.innerHTML = `
    <div class="edit-header">
      <button class="btn-back" id="btn-back">← Cenas</button>
      <p class="edit-title">${isNew ? 'Nova Cena' : 'Editar Cena'}</p>
    </div>

    <div class="card">
      <p class="section-title">Informações</p>
      <div class="field">
        <label>Nome da cena</label>
        <input type="text" id="s-name" class="input"
          placeholder="Ex: Trabalho, Dev - VSCode, Casual..."
          value="${esc(s?.name ?? '')}">
      </div>
      <div class="field" style="margin-top:10px">
        <label>Filtro base de daltonismo</label>
        <select id="s-filter" class="input">
          ${FILTERS.map(f =>
            `<option value="${f.key}" ${f.key === (s?.filter_type ?? 'normal') ? 'selected' : ''}>${f.label} — ${f.desc}</option>`
          ).join('')}
        </select>
      </div>
      <button class="btn-primary" id="btn-save" style="margin-top:12px;width:100%;padding:9px">
        ${isNew ? 'Criar Cena' : 'Salvar Alterações'}
      </button>
    </div>

    ${!isNew ? `
    <div class="card" id="rules-card">
      <div class="rules-header">
        <p class="section-title" style="margin:0">Regras de Padrão Visual</p>
        <button class="btn-sm btn-primary" id="btn-add-rule">+ Regra</button>
      </div>

      <div id="rules-list">
        ${(s.pattern_rules ?? []).length === 0
          ? '<p class="empty-state" style="padding:8px 0 4px">Nenhuma regra. Adicione uma cor para substituir por padrão visual.</p>'
          : (s.pattern_rules ?? []).map(ruleItemHTML).join('')}
      </div>

      <div id="rule-form" style="display:none"></div>
    </div>` : ''}
  `;

  document.getElementById('btn-back').addEventListener('click', () => {
    state.view = 'scenes';
    render();
  });

  document.getElementById('btn-save').addEventListener('click', saveScene);

  if (!isNew) {
    document.getElementById('btn-add-rule').addEventListener('click', () => openRuleForm(null));

    (s.pattern_rules ?? []).forEach(r => {
      document.getElementById(`edit-rule-${r.id}`)
        ?.addEventListener('click', () => openRuleForm(r));
      document.getElementById(`del-rule-${r.id}`)
        ?.addEventListener('click', () => deleteRule(r.id));
    });
  }
}

function ruleItemHTML(r) {
  const patLabel = PATTERNS.find(pt => pt.key === r.pattern)?.label ?? r.pattern;
  return `
    <div class="rule-item">
      <span class="rule-swatch" style="background:${/^#[0-9a-f]{6}$/i.test(r.color_hex) ? r.color_hex : '#888888'}"></span>
      <div class="rule-info">
        <span class="rule-label">${esc(r.label || r.color_hex)}</span>
        <span class="rule-sub">${esc(patLabel)} · tolerância ±${Number(r.hue_tolerance)}° · ${Math.round(r.opacity * 100)}% opacidade</span>
      </div>
      <button class="btn-icon" id="edit-rule-${r.id}" title="Editar">✎</button>
      <button class="btn-icon btn-danger" id="del-rule-${r.id}" title="Remover">×</button>
    </div>
  `;
}

// ── Formulário de regra (criar/editar) ────────────────────────────────────────

function openRuleForm(rule) {
  state.editingRuleId = rule?.id ?? null;

  const formEl = document.getElementById('rule-form');
  formEl.innerHTML = ruleFormHTML(rule);
  formEl.style.display = 'block';
  document.getElementById('btn-add-rule').style.display = 'none';

  bindRuleFormEvents();
}

function ruleFormHTML(r) {
  const hex = r?.color_hex ?? '#ff0000';
  const tol = r?.hue_tolerance ?? 30;
  const op  = r?.opacity ?? 0.7;

  return `
    <div class="add-rule-form">
      <div class="field-row">
        <div class="field">
          <label>Cor alvo</label>
          <div class="color-input-row">
            <input type="color" id="r-color" value="${hex}">
            <input type="text"  id="r-hex" class="input input-sm" value="${hex}" maxlength="7">
          </div>
        </div>
        <div class="field">
          <label>Padrão visual</label>
          <select id="r-pattern" class="input">
            ${PATTERNS.map(p =>
              `<option value="${p.key}" ${p.key === r?.pattern ? 'selected' : ''}>${p.label}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label>Rótulo (opcional)</label>
        <input type="text" id="r-label" class="input"
          placeholder="Ex: Vermelho de alerta, Botões de erro..."
          value="${esc(r?.label && r.label !== r?.color_hex ? r.label : '')}">
      </div>
      <div class="field">
        <label>Tolerância de matiz: <span id="r-tol-val">±${tol}°</span></label>
        <input type="range" id="r-tolerance" min="5" max="90" value="${tol}">
      </div>
      <div class="field">
        <label>Opacidade do padrão: <span id="r-op-val">${Math.round(op * 100)}%</span></label>
        <input type="range" id="r-opacity" min="0.1" max="1" step="0.05" value="${op}">
      </div>
      <div class="form-actions">
        <button class="btn-sm" id="btn-cancel-rule">Cancelar</button>
        <button class="btn-sm btn-primary" id="btn-confirm-rule">${state.editingRuleId ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </div>
  `;
}

function bindRuleFormEvents() {
  const colorPicker = document.getElementById('r-color');
  const hexInput    = document.getElementById('r-hex');

  colorPicker.addEventListener('input', (e) => { hexInput.value = e.target.value; });

  hexInput.addEventListener('change', (e) => {
    if (/^#[0-9a-f]{6}$/i.test(e.target.value))
      colorPicker.value = e.target.value;
  });

  document.getElementById('r-tolerance').addEventListener('input', (e) => {
    document.getElementById('r-tol-val').textContent = '±' + e.target.value + '°';
  });

  document.getElementById('r-opacity').addEventListener('input', (e) => {
    document.getElementById('r-op-val').textContent = Math.round(e.target.value * 100) + '%';
  });

  document.getElementById('btn-cancel-rule').addEventListener('click', () => {
    state.editingRuleId = null;
    document.getElementById('rule-form').style.display = 'none';
    document.getElementById('btn-add-rule').style.display = '';
  });

  document.getElementById('btn-confirm-rule').addEventListener('click', submitRule);
}

async function saveScene() {
  const name       = document.getElementById('s-name').value.trim();
  const filterType = document.getElementById('s-filter').value;
  if (!name) { alert('Dê um nome à cena.'); return; }

  if (!state.editingScene) {
    const created = await api.createScene({ name, filterType });
    state.scenes = await api.getScenes();
    state.editingScene = state.scenes.find(s => s.id === created.id);
    render();
  } else {
    await api.updateScene(state.editingScene.id, { name, filter_type: filterType });
    if (state.prefs.activeSceneId === state.editingScene.id)
      state.prefs = await api.setFilterType(filterType);
    state.scenes = await api.getScenes();
    state.editingScene = state.scenes.find(s => s.id === state.editingScene.id);
    render();
  }
}

async function submitRule() {
  const hex = document.getElementById('r-hex').value.trim();
  if (!/^#[0-9a-f]{6}$/i.test(hex)) { alert('Cor inválida. Use o formato #rrggbb.'); return; }

  const payload = {
    colorHex:     hex,
    hueCenter:    hexToHue(hex),
    hueTolerance: parseInt(document.getElementById('r-tolerance').value),
    pattern:      document.getElementById('r-pattern').value,
    label:        document.getElementById('r-label').value.trim() || hex,
    opacity:      parseFloat(document.getElementById('r-opacity').value)
  };

  if (state.editingRuleId) {
    await api.updatePatternRule(state.editingRuleId, payload);
  } else {
    await api.addPatternRule(state.editingScene.id, payload);
  }

  state.editingRuleId = null;
  state.scenes = await api.getScenes();
  state.editingScene = state.scenes.find(s => s.id === state.editingScene.id);
  render();
}

async function deleteRule(ruleId) {
  await api.deletePatternRule(ruleId);
  state.scenes = await api.getScenes();
  state.editingScene = state.scenes.find(s => s.id === state.editingScene.id);
  render();
}

// ── Utilitários ───────────────────────────────────────────────────────────────

// Nomes de cena e rótulos de regra são digitados pelo usuário e entram em
// innerHTML. Sem escapar, uma cena chamada <img src=x onerror=...> quebra o
// painel.
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function hexToHue(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0)
        : max === g ? (b - r) / d + 2
                    : (r - g) / d + 4;
  return Math.round(h * 60);
}

function switchTab(tab) {
  state.view = tab;
  render();
}

// ── Listeners globais ─────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab =>
  tab.addEventListener('click', () => switchTab(tab.dataset.tab))
);

// Toggle universal — liga/desliga filtro de cor + padrões visuais
globalToggle.addEventListener('change', async () => {
  state.prefs = await api.toggleOverlay(globalToggle.checked);
  render();
});

document.getElementById('btn-logout').addEventListener('click', () => api.signOut());

// O toggle universal desliga a simulação no processo principal; a aba Criador
// precisa saber disso para não exibir um estado que já não é verdade.
api.onSimChange?.((sim) => {
  state.sim = sim;
  updateGlobalControls();
  if (state.view === 'creator') renderCreator();
});

api.onApplyFilter(({ type, active }) => {
  state.prefs.filterType   = type;
  state.prefs.filterActive = active;
  updateGlobalControls();
  if (state.view === 'filter') renderFilter();
});

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const [prefs, user, scenes, sim, filterInfo] = await Promise.all([
    api.getPreferences(),
    api.getUser().catch(() => null),
    api.getScenes().catch(() => []),
    api.getSimState().catch(() => ({ active: false, type: 'protanopia' })),
    api.getFilterInfo().catch(() => ({}))
  ]);

  state.prefs      = prefs;
  state.user       = user;
  state.scenes     = scenes;
  state.sim        = sim;
  state.filterInfo = filterInfo;

  if (user?.name) userNameEl.textContent = user.name;  // textContent já escapa

  render();
}

init();
