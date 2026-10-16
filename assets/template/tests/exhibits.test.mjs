import {test} from 'node:test';
import assert from 'node:assert/strict';

test('Confirmed empty sections render a neutral state for every layout, then allow real content',async()=>{
 globalThis.document={addEventListener(){},getElementById(){return {addEventListener(){}};}};
 try {
  const {categories}=await import('../src/content.js');
  const {mountExhibit}=await import('../src/exhibits.js');
  const host={innerHTML:''};
  for(const module of categories){
   const items=module.items;
   try {
    module.items=[];
    mountExhibit(host,module.id);
    assert.match(host.innerHTML,/暂无展示内容/);
    assert.ok(!host.innerHTML.includes(items[0].title));
    module.items=items;
    mountExhibit(host,module.id);
    assert.ok(!host.innerHTML.includes('暂无展示内容'));
   } finally {module.items=items;}
  }
 } finally {delete globalThis.document;}
});
