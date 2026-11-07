(() => {
  const STORAGE_KEY = 'thuis-ontspullen-v2';
  const STATUS_LABELS = {
    te_beoordelen: 'Te beoordelen',
    houden: 'Houden',
    weggeven: 'Weggeven',
    verkopen: 'Verkopen',
    weggooien: 'Weggooien',
  };
  const state = loadState();
  let deferredPrompt = null;
  let pendingFotoData = null;

  const els = {
    tabs: document.querySelectorAll('.tab'), views: document.querySelectorAll('.view'),
    profileSelect: document.getElementById('profileSelect'), statsCards: document.getElementById('statsCards'),
    attentionList: document.getElementById('attentionList'), duplicateList: document.getElementById('duplicateList'),
    exportIcsAllBtn: document.getElementById('exportIcsAllBtn'), exportIcsAttentionBtn: document.getElementById('exportIcsAttentionBtn'),
    itemForm: document.getElementById('itemForm'), itemFormTitle: document.getElementById('itemFormTitle'),
    itemSubmitBtn: document.getElementById('itemSubmitBtn'), cancelEditBtn: document.getElementById('cancelEditBtn'),
    editId: document.getElementById('editId'), itemRuimte: document.getElementById('itemRuimte'),
    itemCategorie: document.getElementById('itemCategorie'), categorieSuggesties: document.getElementById('categorieSuggesties'),
    bewaarMaanden: document.getElementById('bewaarMaanden'), einddatum: document.getElementById('einddatum'),
    itemFoto: document.getElementById('itemFoto'), fotoPreviewWrap: document.getElementById('fotoPreviewWrap'),
    regelHint: document.getElementById('regelHint'), searchInput: document.getElementById('searchInput'),
    searchSummary: document.getElementById('searchSummary'), filterRuimte: document.getElementById('filterRuimte'),
    filterStatus: document.getElementById('filterStatus'), sortSelect: document.getElementById('sortSelect'),
    itemList: document.getElementById('itemList'), itemTemplate: document.getElementById('itemTemplate'),
    ruimteForm: document.getElementById('ruimteForm'), ruimteList: document.getElementById('ruimteList'),
    regelForm: document.getElementById('regelForm'), regelList: document.getElementById('regelList'),
    profileForm: document.getElementById('profileForm'), profileList: document.getElementById('profileList'),
    exportBtn: document.getElementById('exportBtn'), importInput: document.getElementById('importInput'),
    resetBtn: document.getElementById('resetBtn'), installBtn: document.getElementById('installBtn'), swStatus: document.getElementById('swStatus'),
  };

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function defaultProfile(naam = 'Mijn woning') {
    return { id: uid(), naam, ruimtes: [{ id: uid(), naam: 'Woonkamer' }, { id: uid(), naam: 'Keuken' }, { id: uid(), naam: 'Slaapkamer' }, { id: uid(), naam: 'Badkamer' }, { id: uid(), naam: 'Berging/Opslag' }], items: [], categorieRegels: [{ id: uid(), categorie: 'kleding', maanden: 12 }, { id: uid(), categorie: 'papier', maanden: 24 }, { id: uid(), categorie: 'speelgoed', maanden: 12 }] };
  }
  function defaultState() { const p = defaultProfile(); return { version: 2, activeProfileId: p.id, profiles: [p] }; }
  function migrate(raw) {
    if (raw && raw.version === 2 && Array.isArray(raw.profiles)) return raw;
    if (raw && Array.isArray(raw.ruimtes) && Array.isArray(raw.items)) {
      const p = defaultProfile('Mijn woning');
      p.ruimtes = raw.ruimtes; p.items = raw.items; p.categorieRegels = p.categorieRegels || [];
      return { version: 2, activeProfileId: p.id, profiles: [p] };
    }
    return defaultState();
  }
  function loadState() {
    try { const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('thuis-ontspullen-v1'); if (!raw) return defaultState(); return migrate(JSON.parse(raw)); }
    catch { return defaultState(); }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function profile() { return state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0]; }
  function ruimtes() { return profile().ruimtes || []; }
  function items() { return profile().items || []; }
  function regels() { return profile().categorieRegels || (profile().categorieRegels = []); }
  function escapeHtml(str) { return String(str ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
  function norm(str) { return String(str ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
  function ruimteNaam(id) { return ruimtes().find((r) => r.id === id)?.naam || 'Onbekende ruimte'; }
  function addMonths(date, months) { const d = new Date(date.getTime()), day = d.getDate(); d.setMonth(d.getMonth() + months); if (d.getDate() < day) d.setDate(0); return d; }
  function parseDateLocal(v) { if (!v) return null; const d = new Date(v + (v.length === 10 ? 'T00:00:00' : '')); return Number.isNaN(d.getTime()) ? null : d; }
  function bewaartermijnInfo(item) {
    if (['weggeven', 'verkopen', 'weggooien'].includes(item.status)) return null;
    let eind = null;
    if (item.einddatum) eind = parseDateLocal(item.einddatum);
    if (!eind) {
      const months = Number(item.bewaarMaanden);
      if (Number.isFinite(months) && months > 0) {
        const basis = item.laatstGebruikt ? parseDateLocal(item.laatstGebruikt) : item.aangemaaktOp ? new Date(item.aangemaaktOp) : null;
        if (basis && !Number.isNaN(basis.getTime())) eind = addMonths(basis, months);
      }
    }
    if (!eind) return null;
    const today = new Date(); today.setHours(0,0,0,0); const e = new Date(eind); e.setHours(0,0,0,0);
    const dagen = Math.round((e - today) / 86400000);
    let niveau = 'ok', tekst = `Einddatum ${e.toLocaleDateString('nl-NL')}`;
    if (dagen < 0) { niveau = 'danger'; tekst = `Bewaartermijn verstreken (${Math.abs(dagen)} dagen)`; }
    else if (dagen <= 30) { niveau = 'warn'; tekst = `Loopt af (${dagen} dagen)`; }
    return { niveau, tekst, dagen, eind: e };
  }
  function needsAttention(item) { if (item.status === 'te_beoordelen') return !['weggeven','verkopen','weggooien'].includes(item.status); const info = bewaartermijnInfo(item); return !!info && info.dagen <= 30; }
  function duplicateGroups() {
    const groups = new Map();
    for (const item of items()) { const key = norm(item.naam); if (!key) continue; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); }
    return Array.from(groups.entries()).filter(([, arr]) => arr.length > 1).sort((a,b)=>b[1].length-a[1].length || a[0].localeCompare(b[0]));
  }
  function duplicateIds() { const ids = new Set(); for (const [, arr] of duplicateGroups()) for (const i of arr) ids.add(i.id); return ids; }
  function itemSearchText(item) { return [item.naam,item.categorie,ruimteNaam(item.ruimteId),item.notitie,STATUS_LABELS[item.status]||item.status,item.einddatum,item.bewaarMaanden].join(' '); }
  function matchingRule(categorie) { const n = norm(categorie); if (!n) return null; return regels().find((r) => norm(r.categorie) === n) || regels().find((r) => n.includes(norm(r.categorie)) || norm(r.categorie).includes(n)) || null; }

  async function imageToDataUrl(file) {
    if (!file) return null;
    const data = await file.arrayBuffer();
    const blob = new Blob([data], { type: file.type || 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
      const max = 900, scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.78);
    } finally { URL.revokeObjectURL(url); }
  }

  function renderFotoPreview(src) {
    if (!src) { els.fotoPreviewWrap.innerHTML = ''; return; }
    els.fotoPreviewWrap.innerHTML = `<div class="preview-row"><img class="preview-img" src="${src}" alt="Voorbeeld foto" /><button type="button" class="secondary small" id="removeFotoBtn">Foto verwijderen</button></div>`;
    document.getElementById('removeFotoBtn').onclick = () => { pendingFotoData = ''; els.itemFoto.value = ''; renderFotoPreview(''); };
  }

  function downloadText(filename, content, type) {
    const blob = new Blob([content], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  }
  function icsDate(d) { const dt = new Date(d); const y=dt.getFullYear(), m=String(dt.getMonth()+1).padStart(2,'0'), da=String(dt.getDate()).padStart(2,'0'); return `${y}${m}${da}`; }
  function icsEscape(s) { return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }
  function exportIcs(list, name) {
    const events = list.map((item) => { const info = bewaartermijnInfo(item); return info ? { item, info } : null; }).filter(Boolean);
    if (!events.length) return alert('Geen items met een bewaareinddatum om te exporteren.');
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Thuis Ontspullen//NL','CALSCALE:GREGORIAN'];
    for (const { item, info } of events) {
      const d = icsDate(info.eind);
      lines.push('BEGIN:VEVENT', `UID:${item.id}-${d}@thuis-ontspullen`, `DTSTAMP:${icsDate(new Date())}T000000Z`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${d}`, `SUMMARY:${icsEscape('Ontspullen: ' + item.naam)}`, `DESCRIPTION:${icsEscape(`Woning: ${profile().naam}\\nRuimte: ${ruimteNaam(item.ruimteId)}\\nStatus: ${STATUS_LABELS[item.status]||item.status}\\n${info.tekst}`)}`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    downloadText(name, lines.join('\r\n'), 'text/calendar;charset=utf-8');
  }

  function renderProfileSelect() {
    els.profileSelect.innerHTML = state.profiles.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.naam)}</option>`).join('');
    els.profileSelect.value = state.activeProfileId;
  }
  function renderRuimteSelects() {
    const opts = ruimtes().map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.naam)}</option>`).join('');
    els.itemRuimte.innerHTML = opts || '<option value="">Maak eerst een ruimte aan</option>';
    els.filterRuimte.innerHTML = `<option value="">Alle ruimtes</option>` + opts;
  }
  function renderCategorieSuggesties() {
    const cats = new Set([...regels().map((r)=>r.categorie), ...items().map((i)=>i.categorie).filter(Boolean)]);
    els.categorieSuggesties.innerHTML = Array.from(cats).sort((a,b)=>a.localeCompare(b,'nl')).map((c)=>`<option value="${escapeHtml(c)}"></option>`).join('');
  }
  function renderStats() {
    const arr = items(); const dup = duplicateGroups().length; const aandacht = arr.filter(needsAttention).length;
    const weg = arr.filter((i)=>['weggeven','verkopen','weggooien'].includes(i.status)).length;
    const cards = [{num:arr.length,label:'Totaal items'},{num:aandacht,label:'Aandacht nodig'},{num:dup,label:'Dubbele namen'},{num:weg,label:'Op weg eruit'},{num:ruimtes().length,label:'Ruimtes'},{num:regels().length,label:'Categorie-regels'}];
    els.statsCards.innerHTML = cards.map((c)=>`<div class="card"><div class="num">${c.num}</div><div class="label">${escapeHtml(c.label)}</div></div>`).join('');
  }
  function renderAttention() {
    const arr = items().filter(needsAttention).sort((a,b)=>(bewaartermijnInfo(a)?.dagen ?? -9999)-(bewaartermijnInfo(b)?.dagen ?? -9999));
    els.attentionList.innerHTML = arr.length ? '' : '<div class="empty">Geen items die nu aandacht nodig hebben.</div>';
    for (const item of arr) els.attentionList.appendChild(renderItem(item, true));
  }
  function renderDuplicates() {
    const groups = duplicateGroups();
    if (!groups.length) { els.duplicateList.innerHTML = '<div class="empty">Geen mogelijke dubbele spullen gevonden.</div>'; return; }
    els.duplicateList.innerHTML = groups.map(([key, arr]) => `<article class="item"><div class="item-main"><strong class="item-name">"${escapeHtml(arr[0].naam)}"</strong><div class="meta">${arr.length} mogelijke duplicaten</div><p class="note">${arr.map((i)=>`${escapeHtml(i.naam)} (${escapeHtml(ruimteNaam(i.ruimteId))})`).join(', ')}</p></div><div class="item-actions"><button class="secondary small" data-find-dup="${escapeHtml(key)}" type="button">Toon in items</button></div></article>`).join('');
    els.duplicateList.querySelectorAll('[data-find-dup]').forEach((btn)=>btn.onclick=()=>{ const sample=duplicateGroups().find(([k])=>k===btn.dataset.findDup)?.[1]?.[0]; if(sample) els.searchInput.value=sample.naam; els.filterStatus.value='duplicaten'; showView('items'); renderItems(); });
  }

  function renderItem(item, compact=false) {
    const node = els.itemTemplate.content.firstElementChild.cloneNode(true);
    const media = node.querySelector('.item-media');
    if (item.foto) media.innerHTML = `<img src="${item.foto}" alt="${escapeHtml(item.naam)}" class="thumb" />`; else media.remove();
    node.querySelector('.item-name').textContent = item.naam;
    const meta = [ruimteNaam(item.ruimteId)]; if (item.categorie) meta.push(item.categorie); if (item.laatstGebruikt) meta.push(`Laatst gebruikt: ${new Date(item.laatstGebruikt).toLocaleDateString('nl-NL')}`);
    node.querySelector('.meta').textContent = meta.join(' · ');
    node.querySelector('.note').textContent = item.notitie || '';
    const badges = node.querySelector('.badges');
    const addBadge=(cls,text)=>{const b=document.createElement('span'); b.className='badge '+(cls||''); b.textContent=text; badges.appendChild(b);};
    addBadge(item.status==='houden'?'ok':item.status==='te_beoordelen'?'warn':'', STATUS_LABELS[item.status]||item.status);
    if (item.bewaarMaanden) addBadge('', `Bewaartermijn: ${item.bewaarMaanden} mnd`);
    const info = bewaartermijnInfo(item); if (info) addBadge(info.niveau==='ok'?'':info.niveau, info.tekst);
    if (duplicateIds().has(item.id)) addBadge('warn','Mogelijk dubbel');
    const select = node.querySelector('.status-select'); select.value = item.status;
    select.onchange = () => { item.status = select.value; saveState(); renderAll(); };
    node.querySelector('.ics-item').onclick = () => exportIcs([item], `ontspullen-${norm(item.naam)||'item'}.ics`);
    node.querySelector('.edit-item').onclick = () => startEdit(item);
    node.querySelector('.delete-item').onclick = () => { if (!confirm(`"${item.naam}" verwijderen?`)) return; profile().items = items().filter((i)=>i.id!==item.id); if (els.editId.value===item.id){els.itemForm.reset(); clearEdit();} saveState(); renderAll(); };
    if (compact) node.querySelectorAll('button,select').forEach((e)=>e.classList.add('small'));
    return node;
  }

  function sortItems(arr) {
    const mode = els.sortSelect.value;
    const copy = arr.slice();
    const byName = (a,b)=>String(a.naam||'').localeCompare(String(b.naam||''),'nl');
    if (mode==='naam') copy.sort(byName);
    else if (mode==='ruimte') copy.sort((a,b)=>ruimteNaam(a.ruimteId).localeCompare(ruimteNaam(b.ruimteId),'nl') || byName(a,b));
    else if (mode==='status') copy.sort((a,b)=>String(STATUS_LABELS[a.status]||a.status).localeCompare(String(STATUS_LABELS[b.status]||b.status),'nl') || byName(a,b));
    else if (mode==='bewaartermijn') copy.sort((a,b)=>(bewaartermijnInfo(a)?.dagen ?? 999999)-(bewaartermijnInfo(b)?.dagen ?? 999999) || byName(a,b));
    else copy.sort((a,b)=>String(b.aangemaaktOp||'').localeCompare(String(a.aangemaaktOp||'')));
    return copy;
  }

  function renderItems() {
    const ruimte = els.filterRuimte.value, status = els.filterStatus.value, query = norm(els.searchInput.value), dupIds = duplicateIds();
    let arr = items().filter((i) => {
      if (ruimte && i.ruimteId !== ruimte) return false;
      if (status === 'duplicaten') { if (!dupIds.has(i.id)) return false; }
      else if (status && i.status !== status) return false;
      if (query && !norm(itemSearchText(i)).includes(query)) return false;
      return true;
    });
    arr = sortItems(arr);
    els.searchSummary.textContent = `${arr.length} item(s) gevonden${query ? ` voor “${els.searchInput.value.trim()}”` : ''}.`;
    els.itemList.innerHTML = arr.length ? '' : '<div class="empty">Geen resultaten. Pas je zoekopdracht, filter of sortering aan.</div>';
    for (const item of arr) els.itemList.appendChild(renderItem(item));
  }

  function renderRuimtes() {
    const arr = ruimtes();
    els.ruimteList.innerHTML = arr.length ? arr.map((r)=>`<div class="ruimte"><div><strong>${escapeHtml(r.naam)}</strong><div class="meta">${items().filter((i)=>i.ruimteId===r.id).length} item(s)</div></div><button class="secondary small" data-del-ruimte="${escapeHtml(r.id)}" type="button">Verwijder</button></div>`).join('') : '<div class="empty">Nog geen ruimtes.</div>';
    els.ruimteList.querySelectorAll('[data-del-ruimte]').forEach((btn)=>btn.onclick=()=>{ const id=btn.dataset.delRuimte, count=items().filter((i)=>i.ruimteId===id).length; if(count && !confirm('Deze ruimte heeft items. Ruimte verwijderen en items loskoppelen?')) return; profile().ruimtes=ruimtes().filter((r)=>r.id!==id); for(const item of items()) if(item.ruimteId===id) item.ruimteId=ruimtes()[0]?.id||''; saveState(); renderAll(); });
  }

  function renderRegels() {
    const arr = regels();
    els.regelList.innerHTML = arr.length ? arr.map((r)=>`<div class="ruimte"><div><strong>${escapeHtml(r.categorie)}</strong><div class="meta">Standaard bewaartermijn: ${Number(r.maanden)||0} maand(en)</div></div><button class="secondary small" data-del-regel="${escapeHtml(r.id)}" type="button">Verwijder</button></div>`).join('') : '<div class="empty">Nog geen categorie-regels.</div>';
    els.regelList.querySelectorAll('[data-del-regel]').forEach((btn)=>btn.onclick=()=>{ profile().categorieRegels=regels().filter((r)=>r.id!==btn.dataset.delRegel); saveState(); renderAll(); });
  }

  function renderProfiles() {
    els.profileList.innerHTML = state.profiles.map((p)=>`<div class="ruimte"><div><strong>${escapeHtml(p.naam)}</strong><div class="meta">${p.items?.length||0} item(s), ${(p.ruimtes||[]).length} ruimte(s) ${p.id===state.activeProfileId ? '· actief' : ''}</div></div><div class="actions wrap"><button class="secondary small" data-activate="${escapeHtml(p.id)}" type="button">Activeren</button><button class="secondary small" data-del-profile="${escapeHtml(p.id)}" type="button">Verwijder</button></div></div>`).join('');
    els.profileList.querySelectorAll('[data-activate]').forEach((b)=>b.onclick=()=>{ state.activeProfileId=b.dataset.activate; saveState(); renderAll(); });
    els.profileList.querySelectorAll('[data-del-profile]').forEach((b)=>b.onclick=()=>{ if(state.profiles.length<=1) return alert('Je moet minimaal één woning/profiel behouden.'); if(!confirm('Dit profiel verwijderen?')) return; state.profiles=state.profiles.filter((p)=>p.id!==b.dataset.delProfile); if(!state.profiles.find((p)=>p.id===state.activeProfileId)) state.activeProfileId=state.profiles[0].id; saveState(); renderAll(); });
  }

  function showView(name) { els.tabs.forEach((t)=>t.classList.toggle('active',t.dataset.view===name)); els.views.forEach((v)=>v.classList.toggle('active',v.id==='view-'+name)); }
  function clearEdit() { els.editId.value=''; pendingFotoData=null; els.itemFormTitle.textContent='Nieuw item'; els.itemSubmitBtn.textContent='Item opslaan'; els.cancelEditBtn.classList.add('hidden'); els.regelHint.textContent=''; renderFotoPreview(''); }
  function startEdit(item) {
    els.editId.value=item.id; pendingFotoData=item.foto||null; els.itemFormTitle.textContent='Item bewerken'; els.itemSubmitBtn.textContent='Wijzigingen opslaan'; els.cancelEditBtn.classList.remove('hidden');
    const f=els.itemForm.elements; f.naam.value=item.naam||''; f.ruimteId.value=item.ruimteId||''; f.categorie.value=item.categorie||''; f.status.value=item.status||'te_beoordelen'; f.bewaarMaanden.value=item.bewaarMaanden||''; f.einddatum.value=item.einddatum||''; f.laatstGebruikt.value=item.laatstGebruikt||''; f.notitie.value=item.notitie||''; f.foto.value='';
    renderFotoPreview(item.foto||''); updateRegelHint(); showView('items'); window.scrollTo({top:0,behavior:'smooth'}); f.naam.focus();
  }
  function updateRegelHint() {
    const cat = els.itemCategorie.value, rule = matchingRule(cat);
    if (!rule) { els.regelHint.textContent = ''; return; }
    els.regelHint.textContent = `Regel gevonden voor “${rule.categorie}”: standaard ${rule.maanden} maand(en).`;
  }

  function renderAll() { renderProfileSelect(); renderRuimteSelects(); renderCategorieSuggesties(); renderStats(); renderAttention(); renderDuplicates(); renderItems(); renderRuimtes(); renderRegels(); renderProfiles(); updateRegelHint(); }

  els.tabs.forEach((tab)=>tab.onclick=()=>showView(tab.dataset.view));
  els.profileSelect.onchange = () => { state.activeProfileId = els.profileSelect.value; saveState(); renderAll(); };
  els.itemCategorie.addEventListener('input', () => {
    updateRegelHint();
    if (els.editId.value || els.einddatum.value || els.bewaarMaanden.value) return;
    const rule = matchingRule(els.itemCategorie.value); if (rule) els.bewaarMaanden.value = rule.maanden;
  });
  els.itemFoto.addEventListener('change', async () => { const file=els.itemFoto.files?.[0]; if(!file) return; try { pendingFotoData = await imageToDataUrl(file); renderFotoPreview(pendingFotoData); } catch { alert('Foto kon niet worden verwerkt.'); } });

  els.itemForm.onsubmit = async (e) => {
    e.preventDefault(); if(!ruimtes().length) return alert('Maak eerst een ruimte aan.');
    const fd = new FormData(els.itemForm), editId = String(fd.get('editId')||'').trim();
    if (els.itemFoto.files?.[0]) { try { pendingFotoData = await imageToDataUrl(els.itemFoto.files[0]); } catch {} }
    const data = { naam:String(fd.get('naam')||'').trim(), ruimteId:String(fd.get('ruimteId')||''), categorie:String(fd.get('categorie')||'').trim(), status:String(fd.get('status')||'te_beoordelen'), bewaarMaanden:String(fd.get('bewaarMaanden')||'').trim(), einddatum:String(fd.get('einddatum')||''), laatstGebruikt:String(fd.get('laatstGebruikt')||''), notitie:String(fd.get('notitie')||'').trim(), foto: pendingFotoData === '' ? '' : (pendingFotoData ?? (editId ? items().find((i)=>i.id===editId)?.foto : '')) };
    if (editId) { const item=items().find((i)=>i.id===editId); if(item) Object.assign(item,data); }
    else items().push({ id: uid(), ...data, aangemaaktOp: new Date().toISOString() });
    saveState(); els.itemForm.reset(); clearEdit(); renderAll();
  };
  els.cancelEditBtn.onclick = () => { els.itemForm.reset(); clearEdit(); };
  els.itemForm.addEventListener('reset', () => setTimeout(clearEdit, 0));

  els.ruimteForm.onsubmit = (e)=>{ e.preventDefault(); const naam=String(new FormData(els.ruimteForm).get('naam')||'').trim(); if(!naam) return; ruimtes().push({id:uid(),naam}); saveState(); els.ruimteForm.reset(); renderAll(); };
  els.regelForm.onsubmit = (e)=>{ e.preventDefault(); const fd=new FormData(els.regelForm); const categorie=String(fd.get('categorie')||'').trim(); const maanden=Math.max(0,Number(fd.get('maanden')||0)); if(!categorie) return; const existing=regels().find((r)=>norm(r.categorie)===norm(categorie)); if(existing){ existing.categorie=categorie; existing.maanden=maanden; } else regels().push({id:uid(),categorie,maanden}); saveState(); els.regelForm.reset(); renderAll(); };
  els.profileForm.onsubmit = (e)=>{ e.preventDefault(); const naam=String(new FormData(els.profileForm).get('naam')||'').trim(); if(!naam) return; state.profiles.push(defaultProfile(naam)); saveState(); els.profileForm.reset(); renderAll(); };

  ['input','change'].forEach((ev)=>{ els.searchInput.addEventListener(ev, renderItems); els.filterRuimte.addEventListener(ev, renderItems); els.filterStatus.addEventListener(ev, renderItems); els.sortSelect.addEventListener(ev, renderItems); });
  els.exportIcsAllBtn.onclick = () => exportIcs(items().filter((i)=>bewaartermijnInfo(i)), 'ontspullen-deadlines.ics');
  els.exportIcsAttentionBtn.onclick = () => exportIcs(items().filter(needsAttention), 'ontspullen-aandacht.ics');
  els.exportBtn.onclick = () => downloadText('thuis-ontspullen-backup.json', JSON.stringify(state,null,2), 'application/json');
  els.importInput.onchange = async () => { const file=els.importInput.files?.[0]; if(!file) return; try { const imported=migrate(JSON.parse(await file.text())); if(!Array.isArray(imported.profiles)) throw new Error('Ongeldig bestand'); if(!confirm('Backup importeren? Dit vervangt je huidige gegevens.')) return; state.version=2; state.activeProfileId=imported.activeProfileId; state.profiles=imported.profiles; saveState(); renderAll(); } catch(err){ alert('Importeren mislukt: '+(err.message||'onbekende fout')); } els.importInput.value=''; };
  els.resetBtn.onclick = () => { if(!confirm('Alle lokale gegevens wissen?')) return; localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('thuis-ontspullen-v1'); location.reload(); };

  window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; els.installBtn.classList.remove('hidden'); });
  els.installBtn.onclick = async ()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; els.installBtn.classList.add('hidden'); };

  (async function registerSW(){ if(!('serviceWorker' in navigator)){els.swStatus.textContent='Service worker wordt niet ondersteund in deze browser.'; return;} try{const reg=await navigator.serviceWorker.register('./sw.js'); els.swStatus.textContent='Offline/installeerbaar: service worker actief (werkt het best via http(s) of localhost).'; reg.update?.();}catch{els.swStatus.textContent='Service worker niet geregistreerd (vaak nodig: openen via een lokale server).';} })();

  renderAll();
})();
