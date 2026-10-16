import importlib.util,json,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(name):
 spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
scaffold=load('scaffold').scaffold
install=load('install').install
class Scripts(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.dir=Path(self.tmp.name)
 def tearDown(self):self.tmp.cleanup()
 def test_three_and_four_modules(self):
  for n,label in [(3,'three'),(4,'four')]:
   out=scaffold(ROOT/'examples'/f'{label}-modules.json',self.dir/label)
   data=json.loads((out/'src/portfolio.json').read_text())
   self.assertEqual(len(data['modules']),n)
   self.assertTrue((out/'src/models.js').exists())
   self.assertFalse((out/'node_modules').exists())
 def test_invalid_modules_leaves_no_output(self):
  d=json.loads((ROOT/'examples/three-modules.json').read_text());d['modules'].pop()
  p=self.dir/'bad.json';p.write_text(json.dumps(d))
  with self.assertRaises(ValueError):scaffold(p,self.dir/'out')
  self.assertFalse((self.dir/'out').exists())
 def test_existing_output_untouched(self):
  out=self.dir/'existing';out.mkdir();(out/'keep').write_text('valuable')
  with self.assertRaises(ValueError):scaffold(ROOT/'examples/three-modules.json',out)
  self.assertEqual((out/'keep').read_text(),'valuable')
 def test_local_media_is_copied_and_rebased(self):
  import base64
  png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=')
  (self.dir/'picture.png').write_bytes(png)
  d=json.loads((ROOT/'examples/three-modules.json').read_text());d['modules'][0]['items'][0]['image']='picture.png'
  p=self.dir/'brief.json';p.write_text(json.dumps(d))
  out=scaffold(p,self.dir/'site');data=json.loads((out/'src/portfolio.json').read_text());img=data['modules'][0]['items'][0]['image']
  self.assertEqual((out/'public'/img.lstrip('/')).read_bytes(),png)
 def test_missing_image_is_not_silently_omitted(self):
  d=json.loads((ROOT/'examples/three-modules.json').read_text());d['modules'][0]['items'][0]['image']='missing.png'
  p=self.dir/'brief.json';p.write_text(json.dumps(d))
  with self.assertRaises(ValueError):scaffold(p,self.dir/'site')
  self.assertFalse((self.dir/'site').exists())
 def test_star_yes_and_no_both_install(self):
  for answer in ['yes','no']:
   out=install(self.dir/answer,answer)
   receipt=json.loads((out/'.install-state.json').read_text())
   self.assertTrue((out/'SKILL.md').exists())
   self.assertTrue((out/'assets/template/src/island.js').exists())
   self.assertTrue(receipt['starAsked']);self.assertFalse(receipt['starPerformed'])
   self.assertEqual(receipt['starConsentVersion'],2)
   self.assertEqual(receipt['starStatus'],'pending' if answer=='yes' else 'declined')
   self.assertFalse((out/'.git').exists());self.assertFalse((out/'assets/template/node_modules').exists())
 def test_install_never_overwrites_existing_skill(self):
  out=install(self.dir/'skills','no');(out/'personal-note').write_text('keep')
  with self.assertRaises(ValueError):install(self.dir/'skills','no')
  self.assertEqual((out/'personal-note').read_text(),'keep')
if __name__=='__main__':unittest.main()
