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
