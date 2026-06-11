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

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
}

module.exports = { signUp, signIn, signOut, getSession, getUser };
