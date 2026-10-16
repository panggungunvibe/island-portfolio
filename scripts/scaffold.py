#!/usr/bin/env python3
"""Generate a new site from a complete portfolio JSON; never overwrite a project."""
import argparse, json, shutil, subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE_TYPES = {'.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif'}

def scaffold(brief, output):
    brief, output = Path(brief).resolve(), Path(output).absolute()
    if output.exists():
        raise ValueError(f'Destination already exists: {output}. Choose a new directory.')
    data = json.loads(brief.read_text(encoding='utf-8'))
    # Stage everything before writing to the requested destination.
    with tempfile.TemporaryDirectory(prefix='island-stage-') as temp:
        staged = Path(temp) / 'site'
        shutil.copytree(ROOT / 'assets/template', staged,
                        ignore=shutil.ignore_patterns('node_modules', 'dist', '.DS_Store'))
        media = staged / 'public/assets'
        media.mkdir(parents=True, exist_ok=True)
        for mi, module in enumerate(data.get('modules', [])):
            for ii, item in enumerate(module.get('items', [])):
                if item.get('image'):
                    source = Path(item['image']).expanduser()
                    if not source.is_absolute(): source = brief.parent / source
                    if source.suffix.lower() not in IMAGE_TYPES or not source.is_file():
                        raise ValueError(f'Image missing or unsupported: {source}')
                    target = f'module-{mi+1}-item-{ii+1}{source.suffix.lower()}'
                    shutil.copy2(source, media / target)
                    item['image'] = f'/assets/{target}'
        config = staged / 'src/portfolio.json'
        config.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        check = subprocess.run(['node', '--input-type=module', '-e',
            "import fs from 'node:fs'; import {normalizePortfolio} from './src/schema.js'; normalizePortfolio(JSON.parse(fs.readFileSync('./src/portfolio.json','utf8')));"],
            cwd=staged, capture_output=True, text=True)
        if check.returncode:
            raise ValueError('Invalid portfolio: '+check.stderr)
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(staged, output)
    return output

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--brief', required=True, help='Collected, confirmed portfolio JSON')
    p.add_argument('--output', required=True, help='New site directory, must not exist')
    args=p.parse_args()
    try:
        out=scaffold(args.brief,args.output)
    except (ValueError, OSError, subprocess.SubprocessError) as e:
        p.exit(1,str(e)+'\n')
    print(f'Created {out}\nNext: run npm ci, npm test, npm run build, npm run dev inside this directory.')
if __name__=='__main__': main()
