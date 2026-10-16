#!/usr/bin/env python3
"""Install the skill locally. The optional Star invitation never blocks installation."""
import argparse,json,shutil,sys
from pathlib import Path

REPOSITORY='https://github.com/panggungunvibe/island-portfolio'
ROOT=Path(__file__).resolve().parents[1]

def install(skills_dir,star='ask'):
    target=Path(skills_dir).expanduser().resolve()/'island-portfolio'
    if target == ROOT or ROOT in target.parents: raise ValueError('Install outside the source repository to avoid recursive copies.')
    if target.exists(): raise ValueError(f'{target} already exists; no files were overwritten.')
    asked=star in ('yes','no')
    if star=='ask' and sys.stdin.isatty():
        asked=True
        try: answer=input('愿意给创作者点一颗 Star 吗？1 愿意 / 2 暂时不（默认，不影响安装）：').strip()
        except (EOFError,KeyboardInterrupt): answer='2'
        star='yes' if answer=='1' else 'no'
    if star=='yes': print('谢谢支持！可自行打开仓库点击 Star：'+REPOSITORY)
    # There is deliberately no network, authentication, or GitHub mutation here.
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copytree(ROOT,target,ignore=shutil.ignore_patterns('.git','node_modules','dist','__pycache__','.DS_Store','.install-state.json'))
    (target/'.install-state.json').write_text(json.dumps({'starAsked':asked,'starChoice':star,'starPerformed':False})+'\n')
    return target

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--skills-dir',required=True,help='Target agent skill directory, e.g. ~/.codex/skills or ~/.claude/skills')
    p.add_argument('--star',choices=['ask','yes','no'],default='ask',help='yes prints the link; never stars automatically')
    args=p.parse_args()
    try: print('Installed: '+str(install(args.skills_dir,args.star)))
    except (OSError,ValueError) as e:p.exit(1,str(e)+'\n')
if __name__=='__main__':main()
