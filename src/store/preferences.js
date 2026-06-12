const Store = require('electron-store');

const schema = {
  filterActive: { type: 'boolean', default: false },
  filterType: { type: 'string', default: 'normal' },
  opacity: { type: 'number', default: 1.0, minimum: 0, maximum: 1 },
  userId: { type: ['string', 'null'], default: null },
  userName: { type: ['string', 'null'], default: null },
  activeSceneId: { type: ['string', 'null'], default: null },
  theme: { type: 'string', default: 'dark' }
};

const store = new Store({ schema });

function getPreferences() {
  return {
    filterActive: store.get('filterActive'),
    filterType: store.get('filterType'),
    opacity: store.get('opacity'),
    userId: store.get('userId'),
    userName: store.get('userName'),
    activeSceneId: store.get('activeSceneId'),
    theme: store.get('theme')
  };
}

function savePreferences(partial) {
  Object.entries(partial).forEach(([key, value]) => {
    if (key in schema) store.set(key, value);
  });
}

function resetPreferences() {
  store.clear();
}

module.exports = { getPreferences, savePreferences, resetPreferences };
