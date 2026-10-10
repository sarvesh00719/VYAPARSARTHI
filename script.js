// ========================================================
// Vyapar Sarthi - High Performance Frame Scroll Engine
// Pure Direct Scroll Animation + Creative Hero + AI Dashboard
// ========================================================

const TOTAL_FRAMES = 206;
const FRAMES_DIR = './ezgif-4c890d0568fbd737-jpg/';
const FRAME_PREFIX = 'ezgif-frame-';
const FRAME_EXT = '.jpg';

function getFrameSrc(index) {
  const padded = String(index).padStart(3, '0');
  return `${FRAMES_DIR}${FRAME_PREFIX}${padded}${FRAME_EXT}`;
}

// DOM Elements
const loaderOverlay = document.getElementById('loaderOverlay');

const mainCanvas = document.getElementById('mainCanvas');
const ambientCanvas = document.getElementById('ambientCanvas');
const mainCtx = mainCanvas.getContext('2d');
const ambientCtx = ambientCanvas.getContext('2d');

const scrollTrack = document.getElementById('scrollTrack');
const creativeHero = document.getElementById('creativeHero');

const audioToggle = document.getElementById('audioToggle');
const fsToggle = document.getElementById('fsToggle');
const spotlight = document.getElementById('spotlight');

// State
const images = new Array(TOTAL_FRAMES + 1);
const imageLoaded = new Array(TOTAL_FRAMES + 1).fill(false);
let loadedCount = 0;

let currentFrameFloat = 1;
let currentRenderedFrame = 1;
let targetFrame = 1;
let isAudioEnabled = false;
let audioCtx = null;

// Audio tick sound on frame change
function playFrameTick() {
  if (!isAudioEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(130, audioCtx.currentTime + 0.025);

    gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.025);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.03);
  } catch (e) {}
}

// --------------------------------------------------------
// Preloading
// --------------------------------------------------------
function preloadImage(index) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = getFrameSrc(index);
    img.onload = () => {
      images[index] = img;
      imageLoaded[index] = true;
      loadedCount++;
      updateLoaderUI();
      resolve(img);
    };
    img.onerror = () => {
      loadedCount++;
      updateLoaderUI();
      resolve(null);
    };
  });
}

function updateLoaderUI() {

  if (loadedCount >= 18 && loaderOverlay && !loaderOverlay.classList.contains('ready')) {
    loaderOverlay.classList.add('ready');
    setTimeout(() => {
      loaderOverlay.classList.add('hidden');
      renderFrame(1);
    }, 250);
  }
}

async function loadAllFrames() {
  const priorityIndices = [1, 2, 3, 4, 5, 25, 52, 75, 103, 130, 155, 180, 206];
  await Promise.all(priorityIndices.map(idx => preloadImage(idx)));

  if (images[1]) renderFrame(1);

  const remaining = [];
  for (let i = 1; i <= TOTAL_FRAMES; i++) {
    if (!imageLoaded[i]) remaining.push(i);
  }

  const CHUNK_SIZE = 16;
  for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
    const chunk = remaining.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(idx => preloadImage(idx)));
  }

  if (loaderOverlay) loaderOverlay.classList.add('hidden');
  renderFrame(currentRenderedFrame);
}

// --------------------------------------------------------
// Canvas Drawing & Aspect Ratio
// --------------------------------------------------------
function resizeCanvases() {
  const baseWidth = 1920;
  const baseHeight = 1080;
  mainCanvas.width = baseWidth;
  mainCanvas.height = baseHeight;

  ambientCanvas.width = Math.floor(baseWidth / 4);
  ambientCanvas.height = Math.floor(baseHeight / 4);

  renderFrame(currentRenderedFrame, true);
}

window.addEventListener('resize', resizeCanvases);

function getBestFrame(index) {
  if (imageLoaded[index] && images[index]) return images[index];
  
  for (let i = index - 1; i >= 1; i--) {
    if (imageLoaded[i] && images[i]) return images[i];
  }
  for (let i = index + 1; i <= TOTAL_FRAMES; i++) {
    if (imageLoaded[i] && images[i]) return images[i];
  }
  return null;
}

function renderFrame(frameIndex, forceRedraw = false) {
  if (!forceRedraw && frameIndex === currentRenderedFrame && images[frameIndex]) {
    return;
  }

  const img = getBestFrame(frameIndex);
  if (!img) return;

  mainCtx.drawImage(img, 0, 0, mainCanvas.width, mainCanvas.height);
  ambientCtx.drawImage(img, 0, 0, ambientCanvas.width, ambientCanvas.height);

  currentRenderedFrame = frameIndex;
}

// --------------------------------------------------------
// Direct Scroll Calculation (Relative to scrollTrack)
// --------------------------------------------------------
function getScrollFraction() {
  const trackScrollable = scrollTrack.offsetHeight - window.innerHeight;
  if (trackScrollable <= 0) return 0;
  return Math.max(0, Math.min(1, window.scrollY / trackScrollable));
}

function updateCreativeHero(fraction) {
  if (!creativeHero) return;
  const fadeOut = Math.max(0, 1 - fraction * 3.2);
  creativeHero.style.opacity = fadeOut;
  creativeHero.style.transform = `translate(-50%, calc(-50% - ${fraction * 70}px)) scale(${1 - fraction * 0.08})`;
  creativeHero.style.pointerEvents = fadeOut < 0.05 ? 'none' : 'auto';
}

window.addEventListener('scroll', () => {
  const fraction = getScrollFraction();
  targetFrame = Math.floor(fraction * (TOTAL_FRAMES - 1)) + 1;
  updateCreativeHero(fraction);
});

// Master Animation Loop (Fast, snappy LERP)
function animationTick() {
  const prevInt = Math.round(currentFrameFloat);
  const diff = targetFrame - currentFrameFloat;

  if (Math.abs(diff) > 0.05) {
    currentFrameFloat += diff * 0.45;
  } else {
    currentFrameFloat = targetFrame;
  }

  const currentInt = Math.round(currentFrameFloat);
  if (currentInt !== prevInt) {
    playFrameTick();
  }

  const renderTarget = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(currentFrameFloat)));
  renderFrame(renderTarget);

  requestAnimationFrame(animationTick);
}

// --------------------------------------------------------
// Audio & Fullscreen
// --------------------------------------------------------
if (audioToggle) {
  audioToggle.addEventListener('click', () => {
    isAudioEnabled = !isAudioEnabled;
    if (isAudioEnabled) {
      audioToggle.style.color = 'var(--accent-saffron)';
      audioToggle.style.borderColor = 'rgba(255, 87, 34, 0.4)';
      playFrameTick();
    } else {
      audioToggle.style.color = '';
      audioToggle.style.borderColor = '';
    }
  });
}

if (fsToggle) {
  fsToggle.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  });
}

// Mouse Spotlight Movement
window.addEventListener('mousemove', (e) => {
  if (!spotlight) return;
  const x = e.clientX;
  const y = e.clientY;
  spotlight.style.background = `radial-gradient(circle 500px at ${x}px ${y}px, rgba(255, 87, 34, 0.06), transparent 70%)`;
});

// --------------------------------------------------------
// Init Animation Stage
// --------------------------------------------------------
resizeCanvases();
loadAllFrames();
requestAnimationFrame(animationTick);

// ========================================================
// SHOWCASE & VYAPAR SARTHI AI DASHBOARD INTERACTIVE CONTROLLERS
// ========================================================
let gstMode = 'composition';
let currentVoiceIdx = 0;

let billItems = [
  { name: 'Fortune Sunlite Oil 1L', cat: 'Edible Oil', qty: 2, unit: 'pkts', rate: 135.00, gstPct: 5, total: 270.00 },
  { name: 'Jeera (Cumin) Loose', cat: 'Spices', qty: 0.25, unit: 'kg', rate: 340.00, gstPct: 12, total: 85.00 }
];

const voicePresets = [
  {
    transcription: '"2 packet fortune oil aur 250g jeera do"',
    items: [
      { name: 'Fortune Sunlite Oil 1L', cat: 'Edible Oil', qty: 2, unit: 'pkts', rate: 135.00, gstPct: 5, total: 270.00 },
      { name: 'Jeera (Cumin) Loose', cat: 'Spices', qty: 0.25, unit: 'kg', rate: 340.00, gstPct: 12, total: 85.00 }
    ]
  },
  {
    transcription: '"1.5 kilo sugar aur teen Parle G"',
    items: [
      { name: 'Madhur Sugar (Loose)', cat: 'Staples', qty: 1.5, unit: 'kg', rate: 44.00, gstPct: 5, total: 66.00 },
      { name: 'Parle-G Gold 100g', cat: 'Biscuits', qty: 3, unit: 'pkts', rate: 10.00, gstPct: 18, total: 30.00 }
    ]
  },
  {
    transcription: '"Rahul cha khata kiti aahe?"',
    items: [
      { name: 'Khata Due: Rahul Deshmukh', cat: 'Credit Ledger', qty: 1, unit: 'balance', rate: 376.00, gstPct: 0, total: 376.00 }
    ]
  }
];

function renderBill() {
  const tbody = document.getElementById('bill-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  let subtotal = 0;
  let totalTax = 0;

  billItems.forEach((item) => {
    subtotal += item.total;
    
    let taxDisplay = '';
    if (gstMode === 'composition') {
      taxDisplay = '<span class="text-on-surface-variant font-mono">Incl.</span>';
    } else {
      const itemTax = (item.total * item.gstPct) / 100;
      totalTax += itemTax;
      taxDisplay = `<span class="font-mono text-indigo-midnight font-semibold">${item.gstPct}% (₹${itemTax.toFixed(2)})</span>`;
    }

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low transition-colors';
    tr.innerHTML = `
      <td class="py-2.5 px-3">
        <span class="font-bold text-indigo-midnight block">${item.name}</span>
        <span class="text-[10px] text-on-surface-variant">${item.cat}</span>
      </td>
      <td class="py-2.5 px-2 font-mono font-bold text-indigo-midnight">${item.qty} ${item.unit}</td>
      <td class="py-2.5 px-2 text-on-surface-variant font-mono">₹${item.rate.toFixed(2)}</td>
      <td class="py-2.5 px-2">${taxDisplay}</td>
      <td class="py-2.5 px-3 text-right font-mono font-bold text-indigo-midnight">₹${item.total.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  let grandTotal = subtotal;
  const taxRow = document.getElementById('tax-row');
  const taxValEl = document.getElementById('tax-val');

  if (taxRow && taxValEl) {
    if (gstMode === 'composition') {
      const compTax = (subtotal * 0.01);
      taxRow.children[0].innerText = 'Composition Scheme Levy (1%):';
      taxValEl.innerText = `₹${compTax.toFixed(2)}`;
      grandTotal = subtotal;
    } else {
      taxRow.children[0].innerText = 'CGST + SGST Breakdown:';
      taxValEl.innerText = `+₹${totalTax.toFixed(2)}`;
      grandTotal = subtotal + totalTax;
    }
  }

  const subtotalEl = document.getElementById('subtotal-val');
  const grandtotalEl = document.getElementById('grandtotal-val');
  const qrTagEl = document.getElementById('qr-amount-tag');

  if (subtotalEl) subtotalEl.innerText = `₹${subtotal.toFixed(2)}`;
  if (grandtotalEl) grandtotalEl.innerText = `₹${grandTotal.toFixed(2)}`;
  if (qrTagEl) qrTagEl.innerText = `Exact: ₹${grandTotal.toFixed(2)}`;
}

function setVoiceInput(idx) {
  currentVoiceIdx = idx;
  [0, 1, 2].forEach(i => {
    const btn = document.getElementById(`voice-btn-${i}`);
    if (!btn) return;
    if (i === idx) {
      btn.className = 'p-2.5 rounded-xl bg-saffron-subtle border border-saffron-glow/30 text-left transition-all flex items-center justify-between';
      btn.querySelector('.material-symbols-outlined').className = 'material-symbols-outlined text-saffron-primary text-base';
    } else {
      btn.className = 'p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-left transition-all flex items-center justify-between';
      btn.querySelector('.material-symbols-outlined').className = 'material-symbols-outlined text-on-surface-variant text-base';
    }
  });

  const preset = voicePresets[idx];
  const simTrans = document.getElementById('sim-transcription');
  if (simTrans) simTrans.innerText = preset.transcription;
  billItems = JSON.parse(JSON.stringify(preset.items));
  renderBill();
  
  const confirmBtnLabel = document.getElementById('confirm-btn-label');
  const confirmBtn = document.getElementById('confirm-bill-btn');
  if (confirmBtnLabel) confirmBtnLabel.innerText = 'Confirm Bill & Post to SQL Ledger';
  if (confirmBtn) {
    confirmBtn.classList.remove('bg-indigo-depth');
    confirmBtn.classList.add('bg-emerald-credit');
  }
}

function addLooseItem(name, qty, ratePerKg) {
  const total = qty * ratePerKg;
  billItems.push({
    name: name,
    cat: 'Loose Staple',
    qty: qty,
    unit: 'kg',
    rate: ratePerKg,
    gstPct: 5,
    total: total
  });
  renderBill();
}

function setGstMode(mode) {
  gstMode = mode;
  const compBtn = document.getElementById('tax-toggle-comp');
  const regBtn = document.getElementById('tax-toggle-reg');
  const note = document.getElementById('tax-mode-note');
  const gstTh = document.getElementById('gst-th-header');

  if (mode === 'composition') {
    if (compBtn) compBtn.className = 'px-2 py-1 rounded-md text-[11px] font-bold bg-saffron-primary text-white transition-all';
    if (regBtn) regBtn.className = 'px-2 py-1 rounded-md text-[11px] font-bold text-on-surface-variant hover:text-indigo-midnight transition-all';
    if (note) note.innerHTML = '✓ <strong>Composition Scheme Mode:</strong> Single combined price displayed. Zero GST filing overhead for stores under ₹1.5 Cr turnover.';
    if (gstTh) gstTh.innerText = 'Tax';
  } else {
    if (regBtn) regBtn.className = 'px-2 py-1 rounded-md text-[11px] font-bold bg-saffron-primary text-white transition-all';
    if (compBtn) compBtn.className = 'px-2 py-1 rounded-md text-[11px] font-bold text-on-surface-variant hover:text-indigo-midnight transition-all';
    if (note) note.innerHTML = '✓ <strong>Supermarket GST Mode:</strong> Explicit CGST & SGST calculated per HSN slab (0%, 5%, 12%, 18%). Full input credit reconciliation.';
    if (gstTh) gstTh.innerText = 'GST Slab';
  }
  renderBill();
}

function commitCounterBill() {
  const btn = document.getElementById('confirm-bill-btn');
  const label = document.getElementById('confirm-btn-label');
  if (label) label.innerText = 'Bill Committed to SQL & Khata (ACID Verified ✓)';
  if (btn) {
    btn.classList.remove('bg-emerald-credit');
    btn.classList.add('bg-indigo-depth');
  }
  alert('ACID Transaction Committed: Stock decremented in PostgreSQL, Dynamic UPI payment logged, Khata balanced.');
}

function toggleGstrModal() {
  const card = document.getElementById('gstr-preview-card');
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('ring-2', 'ring-saffron-primary');
  setTimeout(() => card.classList.remove('ring-2', 'ring-saffron-primary'), 1500);
}

function toggleMarginView(type) {
  const btnProfit = document.getElementById('margin-view-profit');
  const btnRev = document.getElementById('margin-view-revenue');
  const heroProfit = document.getElementById('metric-hero-profit');

  if (type === 'profit') {
    if (btnProfit) btnProfit.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-saffron-primary text-white shadow-xs transition-all flex items-center gap-1';
    if (btnRev) btnRev.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-on-surface-variant hover:text-indigo-midnight transition-all flex items-center gap-1';
    if (heroProfit) heroProfit.innerText = '₹8,920';
  } else {
    if (btnRev) btnRev.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-saffron-primary text-white shadow-xs transition-all flex items-center gap-1';
    if (btnProfit) btnProfit.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-on-surface-variant hover:text-indigo-midnight transition-all flex items-center gap-1';
    if (heroProfit) heroProfit.innerText = '₹48,500 GMV';
  }
}

function handleBudgetSlider(val) {
  const sliderVal = document.getElementById('dealer-slider-val');
  if (sliderVal) sliderVal.innerText = `₹${Number(val).toLocaleString('en-IN')}`;
  
  const prunedRow = document.getElementById('po-pruned-row');
  const poTotal = document.getElementById('po-total-display');

  if (val >= 6500) {
    if (prunedRow) {
      prunedRow.classList.remove('opacity-60', 'line-through');
      prunedRow.querySelector('span.line-through')?.classList.remove('line-through');
    }
    if (poTotal) poTotal.innerText = `₹6,330 / ₹${Number(val).toLocaleString('en-IN')} Budget`;
  } else {
    if (prunedRow) {
      prunedRow.classList.add('opacity-60');
      const span = prunedRow.querySelector('span.text-xs.font-bold');
      if (span && !span.classList.contains('line-through')) span.classList.add('line-through');
    }
    if (poTotal) poTotal.innerText = `₹4,890 / ₹${Number(val).toLocaleString('en-IN')} Budget`;
  }
}

function dispatchWhatsAppPO() {
  alert('Pre-formatted Purchase Order dispatched to Shri Ganesh Traders via WhatsApp API:\n\n"Namaste Kaka, Ramesh Kirana restock list: 24 pkts Amul Taaza, 15 pkts Fortune Oil 1L, 10 bags Madhur Sugar. Total ₹4,890."');
}

// Attach all functions to window for inline HTML onclick attributes
window.renderBill = renderBill;
window.setVoiceInput = setVoiceInput;
window.addLooseItem = addLooseItem;
window.setGstMode = setGstMode;
window.commitCounterBill = commitCounterBill;
window.toggleGstrModal = toggleGstrModal;
window.toggleMarginView = toggleMarginView;
window.handleBudgetSlider = handleBudgetSlider;
window.dispatchWhatsAppPO = dispatchWhatsAppPO;

// Render initial bill
renderBill();
