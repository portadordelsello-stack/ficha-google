import QRCode from 'qrcode';

// Template image path
const TEMPLATE_PATH = '/ficha_google.jpg';
const GOOGLE_REVIEW_PREFIX = 'https://search.google.com/local/writereview?placeid=';

// Blue box base coordinates in 2016 x 2086 px template
const BASE_BOX = {
  x: 735,
  y: 1315,
  width: 546,
  height: 530
};

// DOM Elements
const canvas = document.getElementById('posterCanvas');
const ctx = canvas.getContext('2d');
const placeIdInput = document.getElementById('placeIdInput');
const clearUrlBtn = document.getElementById('clearUrlBtn');
const fullUrlPreview = document.getElementById('fullUrlPreview');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const printBtn = document.getElementById('printBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');

// Range and Color controls
const qrPaddingInput = document.getElementById('qrPadding');
const qrPaddingVal = document.getElementById('qrPaddingVal');
const qrColorInput = document.getElementById('qrColor');
const boxOffsetXInput = document.getElementById('boxOffsetX');
const boxOffsetXVal = document.getElementById('boxOffsetXVal');
const boxOffsetYInput = document.getElementById('boxOffsetY');
const boxOffsetYVal = document.getElementById('boxOffsetYVal');
const boxSizeAdjustInput = document.getElementById('boxSizeAdjust');
const boxSizeAdjustVal = document.getElementById('boxSizeAdjustVal');
const resetAdjustmentsBtn = document.getElementById('resetAdjustmentsBtn');

// State
let templateImage = null;
let renderTimeout = null;

// Initialize
async function init() {
  showLoading(true);
  try {
    templateImage = await loadImage(TEMPLATE_PATH);
    showLoading(false);
    renderPoster();
  } catch (error) {
    console.error('Error al cargar la plantilla:', error);
    showToast('❌ Error al cargar la plantilla ficha_google.jpg');
    showLoading(false);
  }
}

// Helper to load image
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

// Show/Hide Loading Overlay
function showLoading(show) {
  if (show) {
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

// Extract clean Place ID from input string (handling full URL or raw ID)
function getCleanPlaceId(inputVal) {
  let val = inputVal.trim();
  if (!val) return '';

  // If user pasted a full URL containing placeid=
  if (val.includes('placeid=')) {
    const match = val.match(/placeid=([a-zA-Z0-9_\-]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If user pasted a full URL like https://.../ChIJ...
  if (val.startsWith('http://') || val.startsWith('https://')) {
    const parts = val.split('/');
    const lastPart = parts[parts.length - 1].split('?')[0];
    if (lastPart) return lastPart;
  }

  return val;
}

// Render Poster
async function renderPoster() {
  if (!templateImage) return;

  // Clear & draw background template
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);

  const rawInput = placeIdInput.value;
  const cleanPlaceId = getCleanPlaceId(rawInput);

  if (!cleanPlaceId) {
    fullUrlPreview.textContent = `${GOOGLE_REVIEW_PREFIX}...`;
    return;
  }

  const fullQrUrl = `${GOOGLE_REVIEW_PREFIX}${cleanPlaceId}`;
  fullUrlPreview.textContent = fullQrUrl;

  // Calculate box geometry with user adjustments
  const offsetX = parseInt(boxOffsetXInput.value, 10) || 0;
  const offsetY = parseInt(boxOffsetYInput.value, 10) || 0;
  const sizeScale = (parseInt(boxSizeAdjustInput.value, 10) || 100) / 100;
  const padding = parseInt(qrPaddingInput.value, 10) || 0;
  const darkColor = qrColorInput.value || '#000000';

  const baseW = BASE_BOX.width * sizeScale;
  const baseH = BASE_BOX.height * sizeScale;
  
  // Center adjust when scaling
  const adjustCenterX = (BASE_BOX.width - baseW) / 2;
  const adjustCenterY = (BASE_BOX.height - baseH) / 2;

  const targetX = BASE_BOX.x + offsetX + adjustCenterX;
  const targetY = BASE_BOX.y + offsetY + adjustCenterY;

  // Generate QR Code as offscreen Canvas
  const qrCanvas = document.createElement('canvas');
  const qrSize = Math.min(baseW, baseH);
  
  try {
    await QRCode.toCanvas(qrCanvas, fullQrUrl, {
      width: qrSize,
      margin: 1, // minimal internal qr quiet zone
      color: {
        dark: darkColor,
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H' // High resilience
    });

    // Draw QR into blue box space with padding
    const innerX = targetX + padding;
    const innerY = targetY + padding;
    const innerW = baseW - (padding * 2);
    const innerH = baseH - (padding * 2);

    if (innerW > 10 && innerH > 10) {
      ctx.drawImage(qrCanvas, innerX, innerY, innerW, innerH);
    }
  } catch (err) {
    console.error('Error generando QR:', err);
  }
}

// Debounced Render for smooth dragging / typing
function triggerRender() {
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(renderPoster, 20);
}

// Show Toast Notification
function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// Event Listeners
placeIdInput.addEventListener('input', triggerRender);

clearUrlBtn.addEventListener('click', () => {
  placeIdInput.value = '';
  placeIdInput.focus();
  renderPoster();
});

// Preset Buttons
document.querySelectorAll('.preset-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const placeId = tag.getAttribute('data-placeid');
    if (placeId) {
      placeIdInput.value = placeId;
      renderPoster();
    }
  });
});

// Adjustment Sliders
qrPaddingInput.addEventListener('input', (e) => {
  qrPaddingVal.textContent = e.target.value;
  triggerRender();
});

qrColorInput.addEventListener('input', triggerRender);

boxOffsetXInput.addEventListener('input', (e) => {
  boxOffsetXVal.textContent = e.target.value;
  triggerRender();
});

boxOffsetYInput.addEventListener('input', (e) => {
  boxOffsetYVal.textContent = e.target.value;
  triggerRender();
});

boxSizeAdjustInput.addEventListener('input', (e) => {
  boxSizeAdjustVal.textContent = e.target.value;
  triggerRender();
});

resetAdjustmentsBtn.addEventListener('click', () => {
  qrPaddingInput.value = 12;
  qrPaddingVal.textContent = 12;
  qrColorInput.value = '#000000';
  boxOffsetXInput.value = 0;
  boxOffsetXVal.textContent = 0;
  boxOffsetYInput.value = 0;
  boxOffsetYVal.textContent = 0;
  boxSizeAdjustInput.value = 100;
  boxSizeAdjustVal.textContent = 100;
  renderPoster();
  showToast('Reajuste de posición restablecido');
});

// Download Button
downloadBtn.addEventListener('click', () => {
  const cleanId = getCleanPlaceId(placeIdInput.value);
  if (!cleanId) {
    showToast('⚠️ Por favor ingresa un Place ID antes de descargar');
    return;
  }
  const link = document.createElement('a');
  link.download = `afiche_google_reseñas_${cleanId}.png`;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
  showToast('✅ Afiche descargado con éxito');
});

// Copy Image Button
copyBtn.addEventListener('click', async () => {
  try {
    canvas.toBlob(async (blob) => {
      if (!blob) throw new Error('Blob indisponible');
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      showToast('📋 Imagen copiada al portapapeles');
    });
  } catch (err) {
    console.error('Error al copiar imagen:', err);
    showToast('⚠️ Tu navegador no soporta copiar imágenes directamente');
  }
});

// Print Button
printBtn.addEventListener('click', () => {
  window.print();
});

// Start app
init();
