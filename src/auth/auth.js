const api = window.colorSenseAPI;

// ── Abas ─────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('form-' + tab.dataset.tab).classList.add('active');
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');
  err.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    await api.signIn({
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value
    });
    // Notifica o main process que o login foi bem-sucedido
    api.notifyAuthSuccess();
  } catch (error) {
    err.textContent = traduzirErro(error.message);
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

// ── Cadastro ──────────────────────────────────────────────────────────────────

document.getElementById('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('reg-btn');
  const err = document.getElementById('reg-error');
  err.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Criando conta...';

  try {
    const dados = await api.signUp({
      name: document.getElementById('reg-name').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
      daltonismType: document.getElementById('reg-daltonism').value
    });

    // Se o projeto Supabase exigir confirmação de email, o signUp devolve
    // session = null. Seguir para o painel nesse caso abre a janela principal
    // sem sessão e o getScenes() estoura. Hoje a confirmação está desligada,
    // mas isto evita a surpresa caso alguém ligue depois.
    if (!dados?.session) {
      err.textContent = 'Conta criada. Confirme seu email e depois entre.';
      btn.disabled = false;
      btn.textContent = 'Criar conta';
      return;
    }

    api.notifyAuthSuccess();
  } catch (error) {
    err.textContent = traduzirErro(error.message);
    btn.disabled = false;
    btn.textContent = 'Criar conta';
  }
});

// ── Esqueci a senha ───────────────────────────────────────────────────────────

const formRec   = document.getElementById('form-recover');
const recEtapa2 = document.getElementById('rec-etapa2');
const recBtn    = document.getElementById('rec-btn');
const recErr    = document.getElementById('rec-error');
const recHint   = document.getElementById('rec-hint');
const recReenviar = document.getElementById('rec-reenviar');
let codigoEnviado = false;

function mostrarForm(id) {
  document.querySelectorAll('.form').forEach(f => f.classList.toggle('active', f.id === id));
  // As abas só fazem sentido para entrar/cadastrar.
  document.querySelector('.tabs').hidden = id === 'form-recover';
}

function etapaRecuperacao(segunda) {
  codigoEnviado = segunda;
  recEtapa2.hidden = !segunda;
  recReenviar.hidden = !segunda;
  document.getElementById('rec-email').readOnly = segunda;
  recBtn.textContent = segunda ? 'Trocar senha e entrar' : 'Enviar código';
  recHint.textContent = segunda
    ? 'Se esse e-mail tiver conta, o código chega em alguns minutos. Olhe também o spam.'
    : 'Digite o e-mail da sua conta. Vamos mandar um código de 6 dígitos para você criar uma senha nova.';
}

document.getElementById('btn-esqueci').addEventListener('click', () => {
  document.getElementById('rec-email').value = document.getElementById('login-email').value.trim();
  recErr.textContent = '';
  etapaRecuperacao(false);
  mostrarForm('form-recover');
  document.getElementById('rec-email').focus();
});

document.getElementById('rec-voltar').addEventListener('click', () => {
  recErr.textContent = '';
  mostrarForm('form-login');
});

async function enviarCodigo() {
  const email = document.getElementById('rec-email').value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) { recErr.textContent = 'Digite um e-mail válido.'; return; }
  recBtn.disabled = true;
  recErr.textContent = '';
  try {
    await api.requestPasswordReset(email);
    etapaRecuperacao(true);
    document.getElementById('rec-code').focus();
  } catch (error) {
    recErr.textContent = traduzirErro(error.message);
  } finally {
    recBtn.disabled = false;
  }
}

recReenviar.addEventListener('click', () => {
  etapaRecuperacao(false);
  enviarCodigo();
});

formRec.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!codigoEnviado) return enviarCodigo();

  const email     = document.getElementById('rec-email').value.trim();
  const codigo    = document.getElementById('rec-code').value.replace(/\s/g, '');
  const novaSenha = document.getElementById('rec-pass').value;
  const confirma  = document.getElementById('rec-pass2').value;

  if (!/^\d{6,10}$/.test(codigo))  { recErr.textContent = 'Digite o código de 6 dígitos que chegou no e-mail.'; return; }
  if (novaSenha.length < 6)         { recErr.textContent = 'A nova senha deve ter ao menos 6 caracteres.'; return; }
  if (novaSenha !== confirma)       { recErr.textContent = 'As duas senhas não são iguais.'; return; }

  recBtn.disabled = true;
  recBtn.textContent = 'Trocando...';
  recErr.textContent = '';
  try {
    await api.resetPasswordWithCode({ email, codigo, novaSenha });
    api.notifyAuthSuccess();
  } catch (error) {
    recErr.textContent = traduzirErro(error.message);
    recBtn.disabled = false;
    recBtn.textContent = 'Trocar senha e entrar';
  }
});

// Quando o app abre sem conseguir falar com o servidor, não adianta pedir
// senha: o aviso aparece antes de a pessoa tentar e errar três vezes.
if (new URLSearchParams(location.search).get('semServidor') === '1') {
  const alvo = document.getElementById('login-error');
  if (alvo) alvo.textContent = 'O servidor do ColorSense não está respondendo agora. ' +
    'A correção de cor continua funcionando; entrar e salvar cenas volta quando o servidor voltar.';
}

function traduzirErro(msg) {
  msg = String(msg || '');
  if (msg.includes('Invalid login credentials')) return 'Email ou senha incorretos.';
  if (msg.includes('Email not confirmed'))       return 'Confirme seu email antes de entrar.';
  if (msg.includes('already registered'))        return 'Este email já está cadastrado.';
  if (msg.includes('Password should be'))        return 'A senha deve ter ao menos 6 caracteres.';
  // Sem este ramo, quando o servidor está fora do ar a tela de entrada mostrava
  // "fetch failed" em inglês — foi o que o participante do estudo viu quando o
  // projeto do Supabase foi pausado.
  if (/fetch failed|Failed to fetch|NetworkError|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|AuthRetryableFetchError/i.test(msg))
    return 'Não foi possível falar com o servidor do ColorSense. Confira a sua internet; ' +
           'se ela estiver boa, o servidor pode estar fora do ar — tente mais tarde e avise ' +
           'a equipe pelo site colorsense-guia.vercel.app.';
  if (/Token has expired or is invalid|otp_expired|invalid.*(otp|token)/i.test(msg))
    return 'Código errado ou vencido. Confira o e-mail mais recente ou peça um código novo.';
  if (/different from the old|same_password/i.test(msg))
    return 'A nova senha precisa ser diferente da antiga.';
  if (/security purposes|after \d+ seconds/i.test(msg))
    return 'Espere um minuto antes de pedir outro código.';
  if (/rate limit|too many requests/i.test(msg))
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  return 'Não deu certo: ' + msg;
}
