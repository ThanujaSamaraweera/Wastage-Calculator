import { buildReport } from './report.js';
const $ = id => document.getElementById(id);
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const number = new Intl.NumberFormat('en-US', {maximumFractionDigits:2});
const compact = new Intl.NumberFormat('en-US', {notation:'compact',maximumFractionDigits:1});
const qty = value => number.format(value || 0);
const pct = value => value === null ? 'N/A' : `${number.format(value)}%`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows = [], report, metadata, updatedAt, page = 1, expanded = new Set(), sort = 'waste', direction = -1, loading = false;
let pageSize = 30;
let toastTimer;
for (const id of ['from','to']) $(id).innerHTML = months.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
$('to').value = '12';
function options() { return {year:Number($('year').value), from:Number($('from').value), to:Number($('to').value), search:$('search').value.trim(), category:$('category').value, site:$('site').value}; }
function setLoading(value) {
  loading = value;
  $('loading-note').hidden = !value;
  document.body.classList.toggle('is-loading', value);
  document.querySelectorAll('[data-range], #page-size').forEach(button => button.disabled = value);
  for (const id of ['search','year','from','to','category','site','reset','refresh','export','expand','collapse','previous','next']) $(id).disabled = value;
  $('status').textContent = value ? 'Loading ERP data…' : 'ERP connected';
  document.querySelector('main').setAttribute('aria-busy',String(value));
}
async function api(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load report. Please retry.');
  return data;
}
async function load(refresh=false) {
  setLoading(true); $('error').hidden = true;
  try {
    if (!metadata) {
      metadata = await api('/api/metadata');
      $('year').innerHTML = metadata.years.map(y=>`<option value="${y}">${y}</option>`).join('');
      $('site').innerHTML = '<option value="">All sites</option>' + metadata.sites.filter(Boolean).map(s=>`<option value="${escape(s)}">${escape(s)}</option>`).join('');
      if (!metadata.years.length) throw new Error('No matching wastage or issued transactions were found in the database.');
    }
    const data = await api(`/api/report?year=${$('year').value}${refresh ? '&refresh=true' : ''}`);
    rows = data.rows; updatedAt = data.updatedAt; page=1; expanded.clear(); updateCategories();
    setLoading(false); render();
    $('updated').textContent = `Data refreshed ${new Date(updatedAt).toLocaleString()}`;
  } catch (error) {
    setLoading(false); report=null; rows=[]; updatedAt=null; $('active-filters').replaceChildren();
    $('error').textContent = error.message; $('error').hidden=false; $('status').textContent='Connection unavailable';
    ['issued','waste','rate','count'].forEach(id=>$(id).textContent='—');
    $('table-body').innerHTML='<tr><td colspan="9" class="empty">Data could not be loaded. Select Refresh to retry.</td></tr>';
    $('table-foot').innerHTML=''; $('trend-chart').innerHTML=''; $('rate-chart').innerHTML='';
    $('export').disabled=true; $('previous').disabled=true; $('next').disabled=true;
    $('table-count').textContent='0 items'; $('period').textContent='Data unavailable'; $('pagination-info').textContent='No data loaded';
  }
}
function updateCategories() {
  const previous = $('category').value;
  const categories = [...new Set(rows.map(r=>r.flvGroup?.trim() || 'Unclassified'))].sort();
  $('category').innerHTML='<option value="">All FLV groups</option>'+categories.map(c=>`<option value="${escape(c)}">${escape(c)}</option>`).join('');
  $('category').value=categories.includes(previous)?previous:'';
}
function orderedItems() {
  return [...report.items].sort((a,b)=>{
    if (a[sort]===null) return b[sort]===null?0:1;
    if (b[sort]===null) return -1;
    return direction * (typeof a[sort]==='string' ? a[sort].localeCompare(b[sort]) : a[sort]-b[sort]);
  });
}
function rateBadge(value) {return `<span class="rate-value${value>10?' high':''}">${pct(value)}</span>`;}
function render() {
  if (loading || !rows.length && !updatedAt) return;
  report = buildReport(rows, options());
  $('issued').textContent=qty(report.totals.issued); $('waste').textContent=qty(report.totals.waste); $('rate').textContent=pct(report.totals.percent); $('count').textContent=qty(report.items.length);
  $('period').textContent=`${months[report.from-1]} – ${months[report.to-1]} ${report.year} · ${$('site').value || 'All sites'}`;
  $('table-count').textContent=`${report.items.length} items`; $('export').disabled=!report.items.length;
  renderTable(); renderCharts(); renderFilterChips();
}
function renderTable() {
  const items=orderedItems(), pages=Math.max(1,Math.ceil(items.length/pageSize));
  page=Math.min(page,pages); const visible=items.slice((page-1)*pageSize,page*pageSize);
  $('table-body').innerHTML = visible.map(item=> {
    const open=expanded.has(item.item);
    return `<tr class="item-row"><td><button class="row-toggle" data-item="${escape(item.item)}" aria-expanded="${open}" aria-label="${open?'Collapse':'Expand'} ${escape(item.item)}">${open?'−':'+'}</button></td><td><button class="category-pill" data-group="${escape(item.category)}" title="Filter this FLV group">${escape(item.category)}</button></td><td class="item-code"><button class="item-detail-link" data-detail="${escape(item.item)}">${escape(item.item)}</button></td><td class="description">${escape(item.description)}</td><td>All selected</td><td class="numeric">${qty(item.issued)}</td><td class="numeric">${qty(item.waste)}</td><td class="numeric">${rateBadge(item.percent)}</td><td class="numeric">${pct(item.percent)}</td></tr>` + (open ? item.months.map(m=>`<tr class="month-row"><td></td><td></td><td class="month-name">↳ ${months[m.month-1]} ${report.year}</td><td></td><td>${months[m.month-1]}</td><td class="numeric">${qty(m.issued)}</td><td class="numeric">${qty(m.waste)}</td><td class="numeric">${pct(m.percent)}</td><td class="numeric">${pct(m.cumulative)}</td></tr>`).join('') : '');
  }).join('') || '<tr><td colspan="9" class="empty">No materials match your filters. Try a different search or period.</td></tr>';
  $('table-foot').innerHTML=items.length?`<tr><td></td><td colspan="4">Filtered total · ${items.length} materials</td><td class="numeric">${qty(report.totals.issued)}</td><td class="numeric">${qty(report.totals.waste)}</td><td class="numeric">${pct(report.totals.percent)}</td><td class="numeric">${pct(report.totals.percent)}</td></tr>`:'';
  $('pagination-info').textContent=items.length ? `Showing ${(page-1)*pageSize+1}–${Math.min(page*pageSize,items.length)} of ${items.length} materials` : '0 materials';
  $('page-number').textContent=`${page} / ${pages}`; $('previous').disabled=page<=1; $('next').disabled=page>=pages;
  document.querySelectorAll('th button[data-sort]').forEach(button=>button.closest('th').setAttribute('aria-sort',button.dataset.sort===sort?(direction===1?'ascending':'descending'):'none'));
}
function renderCharts() {
  $('chart-readout').textContent = 'Hover or focus a month for details. Select it to filter.';
  if (!report.items.length) { $('trend-chart').innerHTML='<p class="empty">No data for this selection</p>'; $('rate-chart').innerHTML='<p class="empty">No data for this selection</p>'; return; }
  const width=560, height=205, left=55, right=14, top=16, bottom=32;
  const plotW=width-left-right, plotH=height-top-bottom, series=report.months, step=plotW/series.length;
  function axis(values, percent=false) {
    const min=Math.min(0,...values), max=Math.max(percent?1:1,...values);
    const span=max-min || 1, low=min<0?min-span*.08:0, high=max+span*.08;
    const y=value=>top+(high-value)/(high-low)*plotH;
    const grid=Array.from({length:5},(_,i)=>{
      const value=low+(high-low)*i/4, pos=y(value);
      return `<line class="grid" x1="${left}" x2="${width-right}" y1="${pos}" y2="${pos}"/><text text-anchor="end" x="${left-9}" y="${pos+3}">${percent?`${compact.format(value)}%`:compact.format(value)}</text>`;
    }).join('');
    return {y, grid};
  }
  const x=i=>left+step*(i+.5);
  const labels=series.map((m,i)=>`<text text-anchor="middle" x="${x(i)}" y="${height-9}">${months[m.month-1]}</text>`).join('');
  const a=axis(series.flatMap(m=>[m.issued,m.waste]));
  const bars=series.map((m,i)=>{
    const barW=Math.min(15,step*.25);
    return ['issued','waste'].map((key,j)=>`<rect class="bar-${key}" x="${x(i)+(j===0?-barW-1:1)}" y="${Math.min(a.y(m[key]),a.y(0))}" width="${barW}" height="${Math.abs(a.y(m[key])-a.y(0))}" rx="2"/>`).join('') + `<rect class="month-hit" tabindex="0" role="button" data-month="${m.month}" aria-label="Filter ${months[m.month-1]}: issued ${qty(m.issued)}, wastage ${qty(m.waste)}" x="${left+i*step}" y="${top}" width="${step}" height="${plotH+bottom}"><title>${months[m.month-1]} · Issued: ${qty(m.issued)} · Wastage: ${qty(m.waste)}</title></rect>`;
  }).join('');
  $('trend-chart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="Monthly quantities; select a month to filter">${a.grid}${bars}${labels}</svg>`;
  const b=axis(series.flatMap(m=>[m.percent,m.cumulative]).filter(v=>v!==null),true);
  function line(key,cls) {
    let segment=false;
    const path=series.map((m,i)=>{if(m[key]===null){segment=false;return '';} const p=`${segment?'L':'M'} ${x(i)} ${b.y(m[key])}`;segment=true;return p;}).join(' ');
    return `<path class="${cls}-line" d="${path}"/>`+series.map((m,i)=>m[key]===null?'':`<circle class="dot-${key==='percent'?'monthly':'cumulative'}" cx="${x(i)}" cy="${b.y(m[key])}" r="3"><title>${months[m.month-1]} ${key==='percent'?'monthly':'cumulative'}: ${pct(m[key])}</title></circle>`).join('');
  }
  $('rate-chart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly and cumulative wastage percentages; details available in expanded table rows">${b.grid}${line('percent','rate')}${line('cumulative','cumulative')}${labels}</svg>`;
}
$('table-body').addEventListener('click',event=>{const button=event.target.closest('[data-item]');if(!button)return;const item=button.dataset.item;expanded.has(item)?expanded.delete(item):expanded.add(item);renderTable();document.querySelectorAll('[data-item]').forEach(b=>{if(b.dataset.item===item)b.focus();});});
for(const id of ['from','to','category','site']) $(id).addEventListener('change',()=>{if(Number($('from').value)>Number($('to').value))$(id==='from'?'to':'from').value=$(id).value;page=1;render();});
$('search').addEventListener('input',()=>{page=1;render();});
$('year').addEventListener('change',()=>load()); $('refresh').addEventListener('click',()=>load(true));
$('reset').addEventListener('click',()=>{$('search').value='';$('from').value='1';$('to').value='12';$('category').value='';$('site').value='';page=1;expanded.clear();render();});
$('expand').addEventListener('click',()=>{if(report){expanded=new Set(report.items.map(i=>i.item));renderTable();}});
$('collapse').addEventListener('click',()=>{expanded.clear();if(report)renderTable();});
$('previous').addEventListener('click',()=>{page--;renderTable();});$('next').addEventListener('click',()=>{page++;renderTable();});
document.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{if(!report)return;direction=sort===button.dataset.sort?-direction:button.dataset.sort==='item'?1:-1;sort=button.dataset.sort;page=1;renderTable();}));
function focusMonth(event) {const hit=event.target.closest('[data-month]');if(!hit||loading)return;if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;event.preventDefault();$('from').value=hit.dataset.month;$('to').value=hit.dataset.month;page=1;render();}
$('trend-chart').addEventListener('click',focusMonth);$('trend-chart').addEventListener('keydown',focusMonth);
$('export').addEventListener('click',()=>{
  if(!report)return;
  const csv=[['FLV group','Item','Description','Year','Month','Issued qty','Wastage qty','Wastage %','Cumulative %']];
  for(const item of orderedItems()) for(const m of item.months) csv.push([item.category,item.item,item.description,report.year,months[m.month-1],m.issued,m.waste,m.percent??'N/A',m.cumulative??'N/A']);
  const cell=v=>`"${(typeof v==='string'&&/^[\s]*[=+@\-]/.test(v)?`'${v}`:String(v)).replaceAll('"','""')}"`;
  const blob=new Blob(['\uFEFF'+csv.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}), url=URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url;link.download=`basilur-wastage-${report.year}-${report.from}-${report.to}.csv`;link.click();showToast(`Exported ${report.items.length} materials with monthly details.`);setTimeout(()=>URL.revokeObjectURL(url),1000);
});

function showToast(message) {
  clearTimeout(toastTimer); $('toast').textContent=message; $('toast').hidden=false;
  toastTimer=setTimeout(()=>$('toast').hidden=true,3500);
}
function renderFilterChips() {
  const state=options(), chips=[];
  if(state.search)chips.push(['search',`Search: ${state.search}`]);
  if(state.category)chips.push(['category',`FLV: ${state.category}`]);
  if(state.site)chips.push(['site',`Site: ${state.site}`]);
  if(state.from!==1||state.to!==12)chips.push(['period',`${months[state.from-1]} - ${months[state.to-1]}`]);
  $('active-filters').innerHTML=chips.length ? '<span>Filtered by</span>'+chips.map(([id,label])=>`<button class="filter-chip" data-clear="${id}" aria-label="Remove ${escape(label)}">${escape(label)} <span aria-hidden="true">&times;</span></button>`).join('') : '<span>Showing all materials in the selected year</span>';
  document.querySelectorAll('[data-range]').forEach(button=>{
    const q=Number(button.dataset.range);
    const active=button.dataset.range==='year' ? state.from===1&&state.to===12 : q>=1&&q<=4&&state.from===(q-1)*3+1&&state.to===q*3;
    button.setAttribute('aria-pressed',String(active));
    if(button.dataset.range==='ytd')button.disabled=loading||state.year!==new Date().getFullYear();
  });
}
$('active-filters').addEventListener('click',event=>{
 const button=event.target.closest('[data-clear]');if(!button||loading)return;
 if(button.dataset.clear==='period'){$('from').value='1';$('to').value='12';}else $(button.dataset.clear).value='';
 page=1;render();
});
document.querySelectorAll('[data-range]').forEach(button=>button.addEventListener('click',()=>{
 if(loading||!report)return;
 const range=button.dataset.range,q=Number(range);
 $('from').value=String(q?(q-1)*3+1:1);
 $('to').value=String(q?q*3:range==='ytd'?new Date().getMonth()+1:12);
 page=1;render();
}));
$('density').addEventListener('click',()=>{
 const compact=document.querySelector('.table-panel').classList.toggle('compact-table');
 $('density').setAttribute('aria-pressed',String(compact));$('density').textContent=compact?'Comfortable rows':'Compact rows';
});
$('page-size').addEventListener('change',()=>{pageSize=Number($('page-size').value);page=1;if(report)renderTable();});
document.addEventListener('keydown',event=>{
 if(event.key==='/'&&!loading&&!$('material-dialog').open&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,select,textarea,[contenteditable]')){event.preventDefault();$('search').focus();}
});
function chartReadout(event) {
 const hit=event.target.closest('[data-month]');if(!hit||!report)return;
 const month=report.months.find(m=>m.month===Number(hit.dataset.month));if(!month)return;
 $('chart-readout').textContent=`${months[month.month-1]}: Issued ${qty(month.issued)} | Wastage ${qty(month.waste)} | Rate ${pct(month.percent)}`;
}
$('trend-chart').addEventListener('pointerover',chartReadout);$('trend-chart').addEventListener('focusin',chartReadout);
$('table-body').addEventListener('click',event=>{
 const group=event.target.closest('[data-group]');if(group&&!loading){$('category').value=group.dataset.group;page=1;render();return;}
 const detail=event.target.closest('[data-detail]');if(detail&&!loading)openMaterial(detail.dataset.detail);
});
function openMaterial(code) {
 const item=report?.items.find(i=>i.item===code);if(!item)return;
 $('detail-title').textContent=item.item;$('detail-description').textContent=item.description;
 const peak=Math.max(1,...item.months.map(m=>m.waste));
 $('detail-content').innerHTML=`<div class="detail-context"><span class="category-pill">${escape(item.category)}</span><span>${months[report.from-1]} - ${months[report.to-1]} ${report.year}</span></div><div class="detail-metrics"><div><span>Issued quantity</span><strong>${qty(item.issued)}</strong></div><div><span>Wastage quantity</span><strong>${qty(item.waste)}</strong></div><div><span>Wastage rate</span><strong>${pct(item.percent)}</strong></div></div><h3>Month by month</h3><p class="detail-hint">Bars compare this material's monthly wastage quantities.</p><div class="detail-table-scroll"><table><thead><tr><th>Month</th><th>Wastage profile</th><th class="numeric">Issued</th><th class="numeric">Wastage</th><th class="numeric">Rate</th><th class="numeric">Cumulative</th></tr></thead><tbody>${item.months.map(m=>`<tr><td>${months[m.month-1]}</td><td><progress max="${peak}" value="${Math.max(0,m.waste)}" aria-label="${months[m.month-1]} wastage ${qty(m.waste)}"></progress></td><td class="numeric">${qty(m.issued)}</td><td class="numeric">${qty(m.waste)}</td><td class="numeric">${pct(m.percent)}</td><td class="numeric">${pct(m.cumulative)}</td></tr>`).join('')}</tbody></table></div><p class="detail-hint">Cumulative rates begin at the selected From month. N/A means issued quantity is zero or negative.</p>`;
 $('material-dialog').showModal();
}
$('close-detail').addEventListener('click',()=>$('material-dialog').close());
$('material-dialog').addEventListener('click',event=>{if(event.target===$('material-dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}});
load();
