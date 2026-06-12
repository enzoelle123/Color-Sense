const { createClient } = require('@supabase/supabase-js');
const Store = require('electron-store');
const ws = require('ws');

// Persiste os tokens de sessão no disco para o usuário não precisar
// logar toda vez que abrir o app.
const sessionStore = new Store({ name: 'auth-session' });

const storageAdapter = {
  getItem:    (key)        => sessionStore.get(key) ?? null,
  setItem:    (key, value) => sessionStore.set(key, value),
  removeItem: (key)        => sessionStore.delete(key)
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      storage: storageAdapter,
      persistSession: true,
      autoRefreshToken: true
    },
    realtime: { transport: ws }
  }
);

module.exports = { supabase };
