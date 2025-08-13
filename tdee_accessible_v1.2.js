// State
let currentUnit = 'imperial';
let currentChoice = 'male'; // 'male' | 'female' | 'AMAB' | 'AFAB'
let currentWeight = 0;

// Helpers
const qs = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function showFormError(msg){
  let err = document.getElementById('formError');
  if(!err){
    err = document.createElement('div');
    err.id = 'formError';
    err.style.marginTop='10px';
    err.style.color='#c0392b';
    err.style.fontWeight='600';
    const calc = document.querySelector('#calculator');
    if(calc) calc.appendChild(err);
  }
  err.textContent = msg || '';
}

function setUnit(unit, button){
  currentUnit = unit;
  // toggle active styles + aria
  qsa('.unit-btn').forEach(btn => { btn.classList.remove('active'); btn.setAttribute('aria-pressed','false'); });
  if (button){ button.classList.add('active'); button.setAttribute('aria-pressed','true'); }

  // sync BB radios if present
  const rImp = qs('#bbImperial'); const rMet = qs('#bbMetric');
  if (rImp && rMet){ rImp.checked = (unit === 'imperial'); rMet.checked = (unit === 'metric'); }

  if (unit === 'imperial'){
    qs('#weightUnit').textContent = 'lbs';
    qs('#heightImperial').style.display = 'block';
    qs('#heightMetric').style.display = 'none';
  } else {
    qs('#weightUnit').textContent = 'kg';
    qs('#heightImperial').style.display = 'none';
    qs('#heightMetric').style.display = 'block';
  }
  // refresh goal titles
  updateGoalTitlesForUnit();
}

// Equations
function getBMR({ weightKg, heightCm, age, bodyFatPct, choice, hrtType, monthsHRT }){
  // If body fat provided -> Katch–McArdle (sex-neutral)
  if (bodyFatPct != null && !isNaN(bodyFatPct)) {
    const bf = Math.max(0, Math.min(0.6, bodyFatPct)); // 0..60%
    const lbm = weightKg * (1 - bf);
    return 370 + 21.6 * lbm;
  }

  // Mifflin–St Jeor baselines
  const bmrMale   = (10*weightKg) + (6.25*heightCm) - (5*age) + 5;
  const bmrFemale = (10*weightKg) + (6.25*heightCm) - (5*age) - 161;

  // Male/Female direct
  if (choice === 'male') return bmrMale;
  if (choice === 'female') return bmrFemale;

  // AMAB/AFAB with optional HRT blending
  if (!hrtType || hrtType === 'none') return choice === 'AMAB' ? bmrMale : bmrFemale;
  const t = Math.max(0, Math.min(1, (monthsHRT || 0) / 12));
  if (hrtType === 'feminizing')   return (1 - t) * bmrMale   + t * bmrFemale;
  if (hrtType === 'masculinizing')return (1 - t) * bmrFemale + t * bmrMale;
  return choice === 'AMAB' ? bmrMale : bmrFemale;
}

function calculateTDEE(){
  const age = parseFloat(qs('#age')?.value);
  const weight = parseFloat(qs('#weight')?.value);
  const activity = parseFloat(qs('#activity')?.value);
  const hrtType = qs('#hrtType')?.value || 'none';
  const monthsHRT = parseFloat(qs('#monthsHRT')?.value) || 0;
  const bodyFatInput = qs('#bodyFatPct')?.value;
  const bodyFatPct = bodyFatInput ? (parseFloat(bodyFatInput)/100) : null;

  currentWeight = weight;

  if (!age || !weight || !activity) {
    showFormError('Please fill in all required fields (age, weight, height, activity).');
    return;
  }

  let weightKg, heightCm;
  if (currentUnit === 'imperial') {
    const feet = parseFloat(qs('#feet')?.value) || 0;
    const inches = parseFloat(qs('#inches')?.value) || 0;
    if (feet === 0 && inches === 0) {
      showFormError('Please enter your height.');
      return;
    }
    weightKg = weight * 0.45359237;
    heightCm = (feet * 12 + inches) * 2.54;
  } else {
    const heightInput = parseFloat(qs('#heightCm')?.value);
    if (!heightInput) {
      showFormError('Please enter your height.');
      return;
    }
    weightKg = weight;
    heightCm = heightInput;
  }

  const bmr = getBMR({ weightKg, heightCm, age, bodyFatPct, choice: currentChoice, hrtType, monthsHRT });
  const tdee = Math.round(bmr * activity);

  qs('#tdeeValue').textContent = tdee.toLocaleString();
  qs('#maintain').textContent = tdee.toLocaleString();
  qs('#lose05').textContent = (tdee - 250).toLocaleString();
  qs('#lose1').textContent = (tdee - 500).toLocaleString();
  qs('#lose15').textContent = (tdee - 750).toLocaleString();
  qs('#gain05').textContent = (tdee + 250).toLocaleString();
  qs('#gain1').textContent = (tdee + 500).toLocaleString();

  const results = qs('#results');
  results.classList.add('show');
  showFormError('');
  results.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// Weekly change helper (lbs as canonical)
function getChangeLbs(cardEl){
  const calEl = cardEl.querySelector('.goal-calories');
  const id = calEl?.id || '';
  const map = { maintain: 0, lose05: -0.5, lose1: -1, lose15: -1.5, gain05: 0.5, gain1: 1 };
  return Object.prototype.hasOwnProperty.call(map, id) ? map[id] : 0;
}

function updateGoalTitlesForUnit(){
  qsa('.goal-card').forEach(card => {
    const titleEl = card.querySelector('.goal-title');
    if (!titleEl) return;
    const changeLbs = getChangeLbs(card);
    if (changeLbs === 0){
      titleEl.textContent = 'Maintain';
      return;
    }
    const sign = changeLbs < 0 ? 'Lose' : 'Gain';
    if (currentUnit === 'imperial'){
      titleEl.textContent = `${sign} ${Math.abs(changeLbs)} lb/week`;
    } else {
      const amountKg = Math.round(Math.abs(changeLbs) * 0.45359237 * 10) / 10;
      titleEl.textContent = `${sign} ${amountKg} kg/week`;
    }
  });
}

function handleGoalCard(cardEl){
  const changeLbs = getChangeLbs(cardEl);
  // weekly change in current display units
  const weeklyChange = (currentUnit === 'imperial') ? changeLbs : (changeLbs * 0.45359237);

  qsa('.goal-card').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');

  const weeks = 13;
  const data = [];
  for (let w=0; w<weeks; w++){
    data.push({ week: w, weight: currentWeight + (weeklyChange * w) });
  }
  drawChart(data, weeklyChange);
  const chart = qs('#projectionChart');
  chart.style.display='block';
  chart.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function drawChart(data, weeklyChange){
  const svg = qs('#weightChart');
  
  // v1.1: Ensure responsive SVG sizing
  if (svg) {
    svg.setAttribute('viewBox', '0 0 800 400');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
  }
const padding = 60, width = 800, height = 400;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  const weights = data.map(d => d.weight);
  const minWeight = Math.min(...weights) - 2;
  const maxWeight = Math.max(...weights) + 2;

  svg.innerHTML = '';
  svg.innerHTML += `<rect width="${width}" height="${height}" fill="#fafafa" rx="10"/>`;

  const goalText = weeklyChange === 0 ? 'Weight Maintenance' :
                   weeklyChange > 0 ? `Gaining ${Math.abs(weeklyChange)} /wk` :
                   `Losing ${Math.abs(weeklyChange)} /wk`;
  svg.innerHTML += `<text x="${width/2}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="#185a9d">${goalText} - 12 Week Projection</text>`;

  for (let i = 0; i <= 12; i++) {
    const x = padding + (i * chartWidth / 12);
    svg.innerHTML += `<line x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}" stroke="#e0e0e0" stroke-width="1"/>`;
  }
  for (let i = 0; i <= 5; i++) {
    const y = padding + (i * chartHeight / 5);
    svg.innerHTML += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`;
  }

  svg.innerHTML += `<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#333" stroke-width="2"/>`;
  svg.innerHTML += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#333" stroke-width="2"/>`;

  for (let i = 0; i <= 12; i++) {
    const x = padding + (i * chartWidth / 12);
    svg.innerHTML += `<text x="${x}" y="${height - padding + 20}" text-anchor="middle" font-size="12" fill="#444">Week ${i}</text>`;
  }
  for (let i = 0; i <= 5; i++) {
    const weight = minWeight + (maxWeight - minWeight) * (1 - i/5);
    const y = padding + (i * chartHeight / 5);
    const unit = currentUnit === 'imperial' ? 'lbs' : 'kg';
    svg.innerHTML += `<text x="${padding - 10}" y="${y + 5}" text-anchor="end" font-size="12" fill="#444">${weight.toFixed(1)} ${unit}</text>`;
  }

  let pathData = '';
  data.forEach((p, idx) => {
    const x = padding + (p.week * chartWidth / 12);
    const y = padding + ((maxWeight - p.weight) / (maxWeight - minWeight)) * chartHeight;
    pathData += (idx === 0 ? 'M ' : ' L ') + `${x} ${y}`;
  });

  const lineColor = weeklyChange < 0 ? '#ff6b6b' : weeklyChange > 0 ? '#4CAF50' : '#43cea2';
  svg.innerHTML += `<path d="${pathData}" fill="none" stroke="${lineColor}" stroke-width="3"/>`;

  data.forEach((p) => {
    const x = padding + (p.week * chartWidth / 12);
    const y = padding + ((maxWeight - p.weight) / (maxWeight - minWeight)) * chartHeight;
    svg.innerHTML += `<circle cx="${x}" cy="${y}" r="5" fill="${lineColor}"/>`;
    svg.innerHTML += `<circle cx="${x}" cy="${y}" r="3" fill="white"/>`;
    if (p.week === 0 || p.week === 12) {
      const unit = currentUnit === 'imperial' ? 'lbs' : 'kg';
      svg.innerHTML += `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="12" font-weight="bold" fill="${lineColor}">${p.weight.toFixed(1)} ${unit}</text>`;
    }
  });

  const totalChange = weeklyChange * 12;
  const unit = currentUnit === 'imperial' ? 'lbs' : 'kg';
  const changeText = totalChange === 0 ? 'No change' :
                     totalChange > 0 ? `+${totalChange.toFixed(1)} ${unit}` :
                     `${totalChange.toFixed(1)} ${unit}`;
  svg.innerHTML += `<rect x="${width - 180}" y="${padding + 10}" width="160" height="60" fill="white" stroke="${lineColor}" stroke-width="2" rx="5"/>`;
  svg.innerHTML += `<text x="${width - 100}" y="${padding + 35}" text-anchor="middle" font-size="14" font-weight="bold" fill="#333">12 Week Result:</text>`;
  svg.innerHTML += `<text x="${width - 100}" y="${padding + 55}" text-anchor="middle" font-size="16" font-weight="bold" fill="${lineColor}">${changeText}</text>`;
}

// Tiny toast (already styled in CSS as .toast)
function showToast(msg, ms=1400){
  const el = qs('#toast');
  if(!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.classList.remove('show');
    el.hidden = true;
  }, ms);
}

// Export helpers (unchanged but stable)
function serializeSVG(svg){
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
  const w = parseInt(svg.getAttribute('width')) || svg.clientWidth || 800;
  const h = parseInt(svg.getAttribute('height')) || svg.clientHeight || 400;
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  if (!clone.getAttribute('viewBox')){
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  const fam = getComputedStyle(svg).fontFamily || 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  clone.style.fontFamily = fam;
  const xml = new XMLSerializer().serializeToString(clone);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
}

function download(filename, blob){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}
function downloadSVG(svg, filename='tdee-projection.svg'){
  try{
    const xml = serializeSVG(svg);
    const blob = new Blob([xml], {type:'image/svg+xml;charset=utf-8'});
    download(filename, blob);
    showToast('Saved SVG');
  }catch(e){
    alert('Could not export SVG.');
    console.error(e);
  }
}

function downloadPNGFromSVG(svg, filename='tdee-projection.png', scale=2){
  try{
    const xml = serializeSVG(svg);
    const blob = new Blob([xml], {type:'image/svg+xml;charset=utf-8'});
    const width = parseInt(svg.getAttribute('width')) || svg.clientWidth || 800;
    const height = parseInt(svg.getAttribute('height')) || svg.clientHeight || 400;

    const doCanvas = (imageLike) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(width * scale));
      canvas.height = Math.max(1, Math.floor(height * scale));
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width, canvas.height);
      ctx.drawImage(imageLike, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((outBlob)=>{
        if(outBlob){ download(filename, outBlob); showToast('Saved PNG'); }
        else alert('Could not create PNG.');
      });
    };

    if (window.createImageBitmap){
      createImageBitmap(blob).then(bitmap => doCanvas(bitmap)).catch(err => {
        console.error('createImageBitmap failed, falling back to Image()', err);
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = function(){
          doCanvas(img);
          URL.revokeObjectURL(url);
        };
        img.onerror = function(e){
          URL.revokeObjectURL(url);
          alert('Could not render SVG to PNG.');
          console.error(e);
        };
        img.src = url;
      });
    } else {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = function(){
        doCanvas(img);
        URL.revokeObjectURL(url);
      };
      img.onerror = function(e){
        URL.revokeObjectURL(url);
        alert('Could not render SVG to PNG.');
        console.error(e);
      };
      img.src = url;
    }
  }catch(e){
    alert('Could not export PNG.');
    console.error(e);
  }
}

// Floating Back to Top
function initBackToTop(){
  const btn = document.getElementById('backToTopFloating');
  if (!btn) return;
  const threshold = 250;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onScroll = () => {
    if (window.scrollY > threshold) btn.classList.add('show');
    else btn.classList.remove('show');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  btn.addEventListener('click', () => {
    if (prefersReduced) window.scrollTo(0, 0);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    btn.blur();
  });
}

// Wire up everything once
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Units
    qsa('.unit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const unit = btn.getAttribute('data-unit');
        setUnit(unit, btn);
      });
    });

    // Sex/identity selection
    qsa('.sel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        qsa('.sel-btn').forEach(b=>{ b.classList.remove('active'); b.setAttribute('aria-checked','false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-checked','true');
        currentChoice = btn.getAttribute('data-choice');

        // Toggle HRT fields: only when AMAB/AFAB (collapsed by default)
        const hrtGroups = qsa('.hrt-only');
        const showHRT = (currentChoice === 'AMAB' || currentChoice === 'AFAB');
        hrtGroups.forEach(g => g.style.display = showHRT ? 'block' : 'none');
      });
    });

    // Calculate
    qs('#calcBtn')?.addEventListener('click', calculateTDEE);

    // Goal cards
    qsa('.goal-card').forEach(card => {
      card.addEventListener('click', ()=>handleGoalCard(card));
      // keyboard access
      card.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          handleGoalCard(card);
        }
      });
    });

    // Chart downloads
    qs('#dlChartBtn')?.addEventListener('click', () => {
      const svg = qs('#weightChart');
      if(!svg || !svg.innerHTML.trim()) { alert('Draw a projection first (tap a goal).'); return; }
      downloadPNGFromSVG(svg, 'tdee-projection.png', 3);
    });
    qs('#dlChartSVGBtn')?.addEventListener('click', () => {
      const svg = qs('#weightChart');
      if(!svg || !svg.innerHTML.trim()) { alert('Draw a projection first (tap a goal).'); return; }
      downloadSVG(svg, 'tdee-projection.svg');
    });

    // Initial setup
    updateGoalTitlesForUnit();
    initBackToTop();
    // Retry once after a tick in case it mounts late
    setTimeout(() => initBackToTop(), 0);
  } catch(e) {
    console.error('Initialization error:', e);
  }
});
