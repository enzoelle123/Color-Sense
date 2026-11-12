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

// Confere a senha atual antes de trocar: sem isso, quem achasse o computador
// de alguém aberto no ColorSense trocava a senha da conta sem saber a antiga.
async function changePassword({ senhaAtual, novaSenha }) {
  const { data: { user }, error: erroUser } = await supabase.auth.getUser();
  if (erroUser) throw erroUser;
  if (!user || !user.email) throw new Error('not authenticated');

  const { error: erroConferir } = await supabase.auth.signInWithPassword({
    email: user.email, password: senhaAtual
  });
  if (erroConferir) {
    if (/Invalid login credentials/i.test(erroConferir.message || ''))
      throw new Error('SENHA_ATUAL_ERRADA');
    throw erroConferir;
  }

  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) throw error;
}

// Esqueci a senha: o Supabase manda um e-mail com um código de 6 dígitos
// (modelo "Reset Password" com {{ .Token }}). Código em vez de link porque o
// link abriria o navegador, e o navegador não tem como devolver a sessão para
// um programa instalado no Windows.
async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

// O código vira uma sessão de recuperação; com ela a senha nova é gravada e a
// pessoa já fica dentro do app.
async function resetPasswordWithCode({ email, codigo, novaSenha }) {
  const { error: erroCodigo } = await supabase.auth.verifyOtp({
    email, token: codigo, type: 'recovery'
  });
  if (erroCodigo) throw erroCodigo;

  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) throw error;
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

module.exports = {
  signUp, signIn, signOut, changePassword, requestPasswordReset, resetPasswordWithCode,
  getSession, getUser
};
