export const REASONS = ['W21', 'W22', 'W20', 'W24', 'W25', 'B02'];
export function percentage(waste, issued) { return issued > 0 ? waste / issued * 100 : null; }
export function buildReport(rows, { year, from = 1, to = 12, search = '', category = '', site = '' }) {
  const groups = new Map();
  for (const row of rows) {
    const item = row.item.trim();
    const cat = row.flvGroup?.trim() || 'Unclassified';
    if (site && row.site !== site) continue;
    if (category && cat !== category) continue;
    if (search && !`${item} ${row.description || ''}`.toLowerCase().includes(search.toLowerCase())) continue;
    if (row.month < from || row.month > to) continue;
    if (!groups.has(item)) groups.set(item, { item, description: row.description || 'Description unavailable', category: cat, months: Array.from({length: to - from + 1}, (_, i) => ({ month: from + i, issued: 0, waste: 0, transactions: 0 })) });
    const month = groups.get(item).months[row.month - from];
    month.issued += Number(row.issued); month.waste += Number(row.waste); month.transactions += Number(row.transactions);
  }
  function finish(months) {
    let issued = 0, waste = 0;
    return months.map(m => { issued += m.issued; waste += m.waste; return {...m, percent: percentage(m.waste, m.issued), cumulative: percentage(waste, issued)}; });
  }
  const items = [...groups.values()].map(item => {
    item.months = finish(item.months);
    item.issued = item.months.reduce((sum, m) => sum + m.issued, 0);
    item.waste = item.months.reduce((sum, m) => sum + m.waste, 0);
    item.percent = percentage(item.waste, item.issued);
    return item;
  }).sort((a,b) => b.waste - a.waste || a.item.localeCompare(b.item));
  const months = finish(Array.from({length: to - from + 1}, (_, i) => ({month: from + i, issued: items.reduce((sum, item) => sum + item.months[i].issued, 0), waste: items.reduce((sum, item) => sum + item.months[i].waste, 0)})));
  const issued = items.reduce((sum, item) => sum + item.issued, 0), waste = items.reduce((sum, item) => sum + item.waste, 0);
  return {year, from, to, items, months, totals: {issued, waste, percent: percentage(waste, issued), items: items.length}};
}

