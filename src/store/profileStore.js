const { supabase } = require('./supabase');

async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, pattern_rules(*)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function createProfile({ name, filterType = 'normal', isDefault = false }) {
  const { data: { user } } = await supabase.auth.getUser();

  if (isDefault) {
    await supabase.from('profiles').update({ is_default: false }).eq('user_id', user.id);
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({ user_id: user.id, name, filter_type: filterType, is_default: isDefault })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateProfile(id, fields) {
  const { data: { user } } = await supabase.auth.getUser();

  if (fields.is_default) {
    await supabase.from('profiles').update({ is_default: false }).eq('user_id', user.id);
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteProfile(id) {
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw error;
}

async function addPatternRule(profileId, { label, colorHex, hueCenter, hueTolerance = 30, pattern, opacity = 0.7 }) {
  const { data, error } = await supabase
    .from('pattern_rules')
    .insert({ profile_id: profileId, label, color_hex: colorHex, hue_center: hueCenter, hue_tolerance: hueTolerance, pattern, opacity })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deletePatternRule(id) {
  const { error } = await supabase.from('pattern_rules').delete().eq('id', id);
  if (error) throw error;
}

module.exports = { getProfiles, createProfile, updateProfile, deleteProfile, addPatternRule, deletePatternRule };
