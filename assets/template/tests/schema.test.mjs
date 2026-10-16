import {test} from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/portfolio.json' with {type:'json'};
import {normalizePortfolio,escapeHTML,safeUrl} from '../src/schema.js';
test('Three modules yield exactly three scene slots',()=>{
 const d=structuredClone(data);d.modules=d.modules.slice(0,3);
 const {categories}=normalizePortfolio(d);assert.equal(categories.length,3);assert.equal(categories.at(-1).number,'03');
});
test('Unsupported counts and duplicate ids rejected',()=>{
 const d=structuredClone(data);d.modules=d.modules.slice(0,2);assert.throws(()=>normalizePortfolio(d));
 d.modules=structuredClone(data.modules);d.modules[1].id=d.modules[0].id;assert.throws(()=>normalizePortfolio(d));
});
test('Untrusted captions stay text and executable links are not emitted',()=>{
 assert.equal(escapeHTML('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
 assert.equal(safeUrl('javascript:alert(1)'), '');assert.equal(safeUrl('data:text/html,abc'),'');
 assert.equal(safeUrl('https://example.org/work'), 'https://example.org/work');
});

test('Empty sections require explicit confirmation and retain all four scene slots',()=>{
 const d=structuredClone(data);
 if(d.modules.length===3) d.modules.push({...structuredClone(d.modules[0]),id:'fourth-section'});
 for (const m of d.modules) m.items=[];
 assert.throws(()=>normalizePortfolio(d));
 for (const m of d.modules) m.emptyConfirmed=true;
 const {categories}=normalizePortfolio(d);
 assert.equal(categories.length,4);
 assert.deepEqual(categories.map(m=>m.number),['01','02','03','04']);
 assert.ok(categories.every(m=>m.items.length===0));
});
