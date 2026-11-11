// Seletor de cor da tela: mostra um retrato do monitor (tirado com o ColorSense
// escondido) e devolve a cor do pixel clicado. Esc, botão direito ou
// "Cancelar" saem sem escolher nada.

const tela  = document.getElementById('tela');
const ctx   = tela.getContext('2d', { willReadFrequently: true });
const zoom  = document.getElementById('zoom').getContext('2d');
const lupa  = document.getElementById('lupa');
const hexEl = document.getElementById('hex');
const amostra = document.getElementById('amostra');

let pronto = false;

function hexDoPixel(x, y) {
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Coordenada da janela → pixel do retrato (o retrato vem na resolução real do
// monitor, que com escala do Windows em 125% é maior que a janela).
function pixelEm(e) {
  return {
    x: Math.min(tela.width  - 1, Math.max(0, Math.floor(e.clientX * tela.width  / window.innerWidth))),
    y: Math.min(tela.height - 1, Math.max(0, Math.floor(e.clientY * tela.height / window.innerHeight)))
  };
}

window.seletor.aoReceberRetrato((dataUrl) => {
  const img = new Image();
  img.onload = () => {
    tela.width = img.naturalWidth;
    tela.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    zoom.imageSmoothingEnabled = false;
    pronto = true;
  };
  img.src = dataUrl;
});

window.addEventListener('mousemove', (e) => {
  if (!pronto) return;
  const { x, y } = pixelEm(e);
  zoom.clearRect(0, 0, 11, 11);
  zoom.drawImage(tela, x - 5, y - 5, 11, 11, 0, 0, 11, 11);
  const hex = hexDoPixel(x, y);
  hexEl.textContent = hex;
  amostra.style.background = hex;

  // A lupa fica ao lado do cursor e muda de lado perto da borda.
  const lx = e.clientX + 150 > window.innerWidth  ? e.clientX - 150 : e.clientX + 18;
  const ly = e.clientY + 170 > window.innerHeight ? e.clientY - 170 : e.clientY + 18;
  lupa.style.left = lx + 'px';
  lupa.style.top  = ly + 'px';
  lupa.style.display = 'block';
});

tela.addEventListener('click', (e) => {
  if (!pronto) return;
  const { x, y } = pixelEm(e);
  window.seletor.escolher(hexDoPixel(x, y));
});

const cancelar = () => window.seletor.escolher(null);
document.getElementById('cancelar').addEventListener('click', cancelar);
window.addEventListener('contextmenu', (e) => { e.preventDefault(); cancelar(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancelar(); });
