import QRCode from 'qrcode';

// Templates definition
const TEMPLATES = {
  '10x15_native': {
    name: 'Plantilla 10×15 Estilizada',
    path: '/ficha_google_10x15.jpg',
    box: {
      x: 256,
      y: 778,
      width: 335,
      height: 336
    }
  },
  'classic': {
    name: 'Plantilla Clásica Cuadrada',
    path: '/ficha_google.jpg',
    box: {
      x: 735,
      y: 1315,
      width: 546,
      height: 530
    }
  }
};

// Formats definition (10x15 aspect ratio 2:3, original, 15x10)
const FORMATS = {
  '10x15': {
    name: '10 × 15 cm (Vertical)',
    width: 2016,
    height: 3024,
    description: '10 × 15 cm (2016 × 3024 px)'
  },
  'original': {
    name: 'Cuadrado Original',
    width: 2016,
    height: 2086,
    description: 'Cuadrado (2016 × 2086 px)'
  },
  '15x10': {
    name: '15 × 10 cm (Horizontal)',
    width: 3024,
    height: 2016,
    description: '15 × 10 cm (3024 × 2016 px)'
  }
};

// DOM Elements
const canvas = document.getElementById('posterCanvas');
const ctx = canvas.getContext('2d');
const canvasDimensions = document.getElementById('canvasDimensions');
const templateSelect = document.getElementById('templateSelect');
const formatSelect = document.getElementById('formatSelect');
const borderToggle = document.getElementById('borderToggle');
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
const templateImages = {};
let renderTimeout = null;
const GOOGLE_REVIEW_PREFIX = 'https://search.google.com/local/writereview?placeid=';

// Get or Load template image
async function getTemplateImage(key) {
  if (templateImages[key]) return templateImages[key];
  const templateConfig = TEMPLATES[key] || TEMPLATES['10x15_native'];
  const img = await loadImage(templateConfig.path);
  templateImages[key] = img;
  return img;
}

// Initialize
async function init() {
  showLoading(true);
  try {
    const currentKey = templateSelect ? templateSelect.value : '10x15_native';
    await getTemplateImage(currentKey);
    showLoading(false);
    renderPoster();
  } catch (error) {
    console.error('Error al cargar la plantilla:', error);
    showToast('❌ Error al cargar la plantilla');
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
  const templateKey = templateSelect ? templateSelect.value : '10x15_native';
  const templateConfig = TEMPLATES[templateKey] || TEMPLATES['10x15_native'];
  const templateImage = templateImages[templateKey];
  if (!templateImage) return;

  const formatKey = formatSelect ? formatSelect.value : '10x15';
  const activeFormat = FORMATS[formatKey] || FORMATS['10x15'];

  if (canvas.width !== activeFormat.width || canvas.height !== activeFormat.height) {
    canvas.width = activeFormat.width;
    canvas.height = activeFormat.height;
  }
  if (canvasDimensions) {
    canvasDimensions.textContent = activeFormat.description;
  }

  // Clear & fill with pure white background (Letterbox)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Compute scale and centering for Letterbox
  const scale = Math.min(canvas.width / templateImage.width, canvas.height / templateImage.height);
  const drawW = Math.round(templateImage.width * scale);
  const drawH = Math.round(templateImage.height * scale);
  const drawX = Math.round((canvas.width - drawW) / 2);
  const drawY = Math.round((canvas.height - drawH) / 2);

  ctx.drawImage(templateImage, drawX, drawY, drawW, drawH);

  const rawInput = placeIdInput.value;
  const cleanPlaceId = getCleanPlaceId(rawInput);

  if (!cleanPlaceId) {
    fullUrlPreview.textContent = `${GOOGLE_REVIEW_PREFIX}...`;
    return;
  }

  const fullQrUrl = `${GOOGLE_REVIEW_PREFIX}${cleanPlaceId}`;
  fullUrlPreview.textContent = fullQrUrl;

  // Calculate box geometry with letterbox offset and user adjustments
  const baseBox = templateConfig.box;
  const baseBoxX = drawX + (baseBox.x * scale);
  const baseBoxY = drawY + (baseBox.y * scale);
  const baseBoxW = baseBox.width * scale;
  const baseBoxH = baseBox.height * scale;

  const offsetX = (parseInt(boxOffsetXInput.value, 10) || 0) * scale;
  const offsetY = (parseInt(boxOffsetYInput.value, 10) || 0) * scale;
  const sizeScale = (parseInt(boxSizeAdjustInput.value, 10) || 100) / 100;
  const padding = (parseInt(qrPaddingInput.value, 10) || 0) * scale;
  const darkColor = qrColorInput.value || '#000000';

  const baseW = baseBoxW * sizeScale;
  const baseH = baseBoxH * sizeScale;
  
  // Center adjust when scaling
  const adjustCenterX = (baseBoxW - baseW) / 2;
  const adjustCenterY = (baseBoxH - baseH) / 2;

  const targetX = baseBoxX + offsetX + adjustCenterX;
  const targetY = baseBoxY + offsetY + adjustCenterY;

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

  // Draw perimeter border (default: light gray 0.25 hairline)
  const isBorderEnabled = borderToggle ? borderToggle.checked : true;
  if (isBorderEnabled) {
    // 0.25 pt stroke on high-res canvas (~2px on 2016px canvas)
    const strokeWidth = Math.max(1, Math.round(canvas.width * 0.001));
    ctx.strokeStyle = '#d5d7da'; // Subtle light gray 0.25 hairline
    ctx.lineWidth = strokeWidth;
    ctx.strokeRect(
      strokeWidth / 2,
      strokeWidth / 2,
      canvas.width - strokeWidth,
      canvas.height - strokeWidth
    );
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
if (templateSelect) {
  templateSelect.addEventListener('change', async () => {
    showLoading(true);
    try {
      await getTemplateImage(templateSelect.value);
    } catch (e) {
      console.error(e);
      showToast('❌ Error al cambiar de plantilla');
    } finally {
      showLoading(false);
      renderPoster();
    }
  });
}

if (formatSelect) {
  formatSelect.addEventListener('change', triggerRender);
}

if (borderToggle) {
  borderToggle.addEventListener('change', triggerRender);
}

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
  if (borderToggle) borderToggle.checked = true;
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
  const formatKey = formatSelect ? formatSelect.value : '10x15';
  const link = document.createElement('a');
  link.download = `afiche_google_reseñas_${formatKey}_${cleanId}.png`;
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
