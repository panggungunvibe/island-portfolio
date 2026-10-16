const kinds = new Set(['gallery','awards','research','projects']);
const slots = [
 {position:[-6.7,3.4],arrival:[-5.4,4.9],color:'#e99364'},
 {position:[6.6,3],arrival:[5,4.6],color:'#a38bbf'},
 {position:[5.4,-5.8],arrival:[4,-4.3],color:'#79a8b8'},
 {position:[-5.9,-5.8],arrival:[-4.4,-4.2],color:'#d7aa53'}
];
export function safeUrl(value) {
 if (!value) return '';
 try { const u = new URL(value); return ['https:','http:','mailto:'].includes(u.protocol) ? value : ''; } catch { return ''; }
}
export function escapeHTML(value='') {return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function normalizePortfolio(data) {
 if (!data || data.version !== 1) throw new Error('portfolio.version must be 1');
 if (!data.profile?.name || !data.profile?.title) throw new Error('Profile name and website title are required');
 if (!Array.isArray(data.modules) || ![3,4].includes(data.modules.length)) throw new Error('Choose 3 or 4 modules');
 const ids = new Set();
 const categories = data.modules.map((m,i)=>{
  if(!/^[a-z][a-z0-9-]*$/.test(m.id)||ids.has(m.id)) throw new Error('Module ids must be unique lowercase slugs');
  ids.add(m.id);
  if (!m.name || !m.short || !kinds.has(m.kind)) throw new Error('Module name, short label and supported kind are required');
  if (!Array.isArray(m.items) || (!m.items.length && m.emptyConfirmed !== true)) throw new Error('Provide real items or explicitly confirm an empty section');
  for (const item of m.items) {
   if (!item.title || !item.summary) throw new Error('Each item needs a title and summary');
   if (item.image && !/^\/assets\/[a-zA-Z0-9_.-]+$/.test(item.image)) throw new Error('Images must be staged under /assets/');
   if (['research','projects'].includes(m.kind) && !item.chapters?.length) throw new Error('Research and projects need chapters');
  }
  return {...m,...slots[i],number:String(i+1).padStart(2,'0'),english:m.english||'EXPLORE & DISCOVER',intro:m.intro||'',description:m.description||''};
 });
 return {profile:{...data.profile,links:(data.profile.links||[]).filter(l=>safeUrl(l.url))},categories};
}
