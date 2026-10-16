import { categories, profile } from './content.js';
import { escapeHTML as h, safeUrl } from './schema.js';
const states = new Map();
let current;
const links = (items=[]) => items.filter(l=>safeUrl(l.url)).map(l=>`<a class="action-link" href="${h(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">${h(l.label||'查看链接')} ↗</a>`).join('');
const metrics = (items=[]) => items.length ? `<div class="ex-metrics">${items.map(m=>`<div><strong>${h(m.value)}</strong><span>${h(m.label)}</span></div>`).join('')}</div>` : '';
const picture = (item,cls='') => item.image ? `<button class="evidence ${cls}" data-photo="${h(item.image)}" data-caption="${h(item.alt||item.title)}" aria-label="放大：${h(item.alt||item.title)}"><img src="${h(item.image)}" alt="${h(item.alt||item.title)}" loading="lazy"/><span class="zoom-hint">查看原图 ↗</span></button>` : '';
const fold = (title,text) => text ? `<details class="field-fold"><summary>${h(title)} <span>＋</span></summary><p>${h(text)}</p></details>` : '';
function choices(items,scope,selected,cls='choice-strip') {
 return `<div class="${cls}" aria-label="${scope==='item'?'选择作品':'选择章节'}">${items.map((label,i)=>`<button data-pick="${scope}" data-index="${i}" aria-pressed="${i===selected}">${label}</button>`).join('')}</div>`;
}
export function mountExhibit(host,id) {
 const module=categories.find(c=>c.id===id);
 if(!module) return;
 current={host,id};
 if (!module.items.length) {
  host.innerHTML='<article class="award-card story-enter"><h3>暂无展示内容</h3></article>';
  return;
 }
 if(!states.has(id)) states.set(id,{item:0,chapter:0});
 const s=states.get(id), item=module.items[s.item], chapters=item.chapters||[];
 let view='';
 const intro=`${metrics(module.metrics)}<div class="account-links">${links(module.links)}</div>`;
 if(module.kind==='gallery') {
  view=choices(module.items.map((v,i)=>`${String(i+1).padStart(2,'0')} · ${h(v.title)}`),'item',s.item)+
  `<article class="screening story-enter ${item.image?'':'text-only'}">${picture(item,'poster')}<div class="screening-copy"><span class="tiny-label">${h(item.kicker)}</span><h3>${h(item.title)}</h3><p>${h(item.summary)}</p>${metrics(item.metrics)}${links(item.url?[{url:item.url,label:'查看作品'}]:[])}</div></article>`;
 } else if(module.kind==='awards') {
  view=choices(module.items.map((v,i)=>`<span class="medal">${h(v.rank||String(i+1).padStart(2,'0'))}</span><span>${h(v.title)}</span>`),'item',s.item,'medal-shelf')+
  `<article class="award-card story-enter"><div class="award-heading"><div><span class="tiny-label">${h(item.kicker)}</span><h3>${h(item.title)}</h3></div>${item.result?`<strong>${h(item.result)}</strong>`:''}</div>${picture(item,'award-photo')}<p class="photo-caption">${h(item.summary)}</p>${metrics(item.metrics)}${links(item.url?[{url:item.url,label:'查看活动或作品'}]:[])}</article>`;
 } else {
  view=module.timeline?.length?`<details class="career-fold"><summary>查看经历时间线 ＋</summary><div class="career-timeline">${module.timeline.map(t=>`<article><small>${h(t.period)}</small><h4>${h(t.title)}</h4><p>${h(t.text)}</p></article>`).join('')}</div></details>`:'';
  if(module.items.length>1) view+=choices(module.items.map(v=>h(v.title)),'item',s.item);
  view+=`<div class="${module.kind==='research'?'journal-cover':'project-cover'}"><div><span class="tiny-label">${h(item.kicker)}</span><h3>${h(item.title)}</h3><p>${h(item.summary)}</p>${metrics(item.metrics)}</div></div>`;
  view+=choices(chapters.map((c,i)=>`<b>${String(i+1).padStart(2,'0')}</b>${h(c.title)}`),'chapter',s.chapter,'step-path');
  const ch=chapters[s.chapter];
  view+=`<article class="${module.kind==='research'?'research-leaf':'case-step'} story-enter"><span class="tiny-label">CHAPTER ${s.chapter+1} / ${chapters.length}</span><h3>${h(ch.title)}</h3><p>${h(ch.text)}</p></article><div class="case-footer"><span>${s.chapter+1} / ${chapters.length}</span>${s.chapter<chapters.length-1?'<button data-next>继续阅读 →</button>':'<span>✓ 已读完这条路径</span>'}</div>${picture(item,'award-photo')}<div class="paper-links">${links(item.url?[{url:item.url,label:'查看原文 / 作品'}]:[])}</div>`;
 }
 host.innerHTML=intro+view+fold('打开复盘笔记',item.reflection)+(item.sourceNote?`<p class="source-note">${h(item.sourceNote)}</p>`:'')+(profile.links.length?`<div class="conversation-card"><b>继续认识${h(profile.name)}</b><div class="project-contact-links">${links(profile.links)}</div></div>`:'');
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-pick]');
 if(b&&current){
  const s=states.get(current.id),scope=b.dataset.pick;s[scope]=Number(b.dataset.index);if(scope==='item')s.chapter=0;
  const scroll=document.getElementById('work').scrollTop;
  mountExhibit(current.host,current.id);
  current.host.querySelector(`[data-pick="${scope}"][data-index="${s[scope]}"]`)?.focus({preventScroll:true});
  document.getElementById('work').scrollTop=scroll;
 }
 if(e.target.closest('[data-next]')&&current){const s=states.get(current.id);s.chapter++;mountExhibit(current.host,current.id);current.host.querySelector(`[data-pick="chapter"][data-index="${s.chapter}"]`)?.focus({preventScroll:true});}
 const photo=e.target.closest('[data-photo]');
 if(photo){const d=document.getElementById('evidence-dialog');d.querySelector('img').src=photo.dataset.photo;d.querySelector('img').alt=photo.dataset.caption;d.querySelector('p').textContent=photo.dataset.caption;d.showModal();}
});
const evidence=document.getElementById('evidence-dialog');
document.getElementById('close-evidence').addEventListener('click',()=>evidence.close());
evidence.addEventListener('click',e=>{if(e.target===evidence)evidence.close();});
evidence.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
