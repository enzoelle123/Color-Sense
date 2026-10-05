// Registro em arquivo, compartilhado pelo app.
//
// No computador de um participante não existe terminal: tudo que vai para o
// console se perde. Quando a correção de cor não liga (PowerShell bloqueado por
// política da escola ou da empresa, por exemplo), este arquivo é a única pista
// que sobra — e num estudo cada "não funcionou" sem explicação é um dado
// perdido. Para diagnosticar, basta pedir o colorsense.log da pasta de dados.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const TAMANHO_MAXIMO = 512 * 1024;   // meio MB; passou disso, vira .1

function registrar(nivel, ...partes) {
  try {
    const arquivo = path.join(app.getPath('userData'), 'colorsense.log');
    try {
      if (fs.statSync(arquivo).size > TAMANHO_MAXIMO) fs.renameSync(arquivo, arquivo + '.1');
    } catch (_) { /* ainda não existe */ }
    const texto = partes.map(p => (p && p.stack) ? p.stack : String(p)).join(' ');
    fs.appendFileSync(arquivo, `${new Date().toISOString()} ${nivel} ${texto}\n`);
  } catch (_) { /* registrar nunca pode derrubar o app */ }
  if (nivel === 'ERRO') console.error('[ColorSense]', ...partes);
}

module.exports = { registrar };
