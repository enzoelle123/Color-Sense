const { supabase } = require('./supabase');

async function signUp({ name, email, password, daltonismType }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, daltonism_type: daltonismType } }
  });
  if (error) throw error;
  return data;
}

async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// scope 'local' não fala com o servidor. Com o servidor fora do ar, o signOut
// normal devolvia erro ANTES de apagar a sessão guardada: o botão Sair não
// fazia nada e a pessoa ficava presa dentro do app.
async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) console.warn('[auth] sair (local):', error.message);
}

// Devolve também se a falha foi de rede: sem isso, "não tem sessão" e "o
// servidor está fora do ar" chegavam iguais (null) e o app pedia senha a quem
// nunca ia conseguir entrar.
const PARECE_REDE = /fetch failed|Failed to fetch|NetworkError|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|Retryable/i;

async function getSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    return {
      session: session || null,
      semServidor: !!error && PARECE_REDE.test(error.message || ''),
      erro: error || null
    };
  } catch (erro) {
    return { session: null, semServidor: PARECE_REDE.test(erro.message || ''), erro };
  }
}

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id, name, daltonism_type, created_at')
    .eq('id', user.id)
    .maybeSingle();          // não estoura quando o perfil não existe
  if (error) throw error;
  if (data) return data;

  // Perfil ausente (gatilho não rodou, linha apagada à mão, banco recriado).
  // Recria a partir dos metadados do cadastro: o tipo de daltonismo é o dado
  // da pesquisa e sumia em silêncio.
  const meta = user.user_metadata || {};
  const perfil = {
    id: user.id,
    name: meta.name || '',
    daltonism_type: meta.daltonism_type || 'normal'
  };
  const { data: criado, error: erroCriar } = await supabase
    .from('users').insert(perfil).select('id, name, daltonism_type, created_at').single();
  if (erroCriar) {
    console.warn('[auth] não deu para recriar o perfil:', erroCriar.message);
    return perfil;           // o app segue funcionando com o que veio do cadastro
  }
  return criado;
}

module.exports = { signUp, signIn, signOut, getSession, getUser };
