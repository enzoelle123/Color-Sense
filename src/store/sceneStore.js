const { supabase } = require('./supabase');

// Sem isto, sessão expirada virava "Cannot read properties of null (reading
// 'id')" na cara do participante.
async function usuarioAtual() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Sessão expirada. Entre novamente.');
  return user;
}

async function getScenes() {
  const { data, error } = await supabase
    .from('scenes')
    .select('*, pattern_rules(*)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function createScene({ name, filterType = 'normal', isDefault = false }) {
  const user = await usuarioAtual();

  if (isDefault) {
    await supabase.from('scenes').update({ is_default: false }).eq('user_id', user.id);
  }

  const { data, error } = await supabase
    .from('scenes')
    .insert({ user_id: user.id, name, filter_type: filterType, is_default: isDefault })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateScene(id, fields) {
  const user = await usuarioAtual();

  if (fields.is_default) {
    await supabase.from('scenes').update({ is_default: false }).eq('user_id', user.id);
  }

  const { data, error } = await supabase
    .from('scenes')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteScene(id) {
  const { error } = await supabase.from('scenes').delete().eq('id', id);
  if (error) throw error;
}

async function addPatternRule(sceneId, { label, colorHex, hueCenter, hueTolerance = 30, pattern, opacity = 0.7 }) {
  const { data, error } = await supabase
    .from('pattern_rules')
    .insert({ scene_id: sceneId, label, color_hex: colorHex, hue_center: hueCenter, hue_tolerance: hueTolerance, pattern, opacity })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updatePatternRule(id, { label, colorHex, hueCenter, hueTolerance, pattern, opacity }) {
  const { data, error } = await supabase
    .from('pattern_rules')
    .update({ label, color_hex: colorHex, hue_center: hueCenter, hue_tolerance: hueTolerance, pattern, opacity })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deletePatternRule(id) {
  const { error } = await supabase.from('pattern_rules').delete().eq('id', id);
  if (error) throw error;
}

module.exports = { getScenes, createScene, updateScene, deleteScene, addPatternRule, updatePatternRule, deletePatternRule };
