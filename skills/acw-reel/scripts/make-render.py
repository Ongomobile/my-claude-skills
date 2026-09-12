"""Build a standalone, deterministic render page from Main.dc.html.
Usage: python3 make-render.py [dark|workbench|paint] [outfile.html]"""
import re, json, os, sys

W = os.path.dirname(os.path.abspath(__file__))

THEMES = {
 'dark': dict(bg='#1F1B17', surface='#2C2620', text='#F5EFE2', sub='#B8AE9D',
        accent='#E8703A', accentText='#1A1714', line='#0E0B09',
        chipBg='#2C2620', chipText='#F5EFE2', chipBorder='#4A4138',
        logoRing='#2C2620', textureOpacity='0.12'),
 'workbench': dict(bg='#F5EFE2', surface='#EFE6D2', text='#1A1714', sub='#3C3631',
        accent='#E8703A', accentText='#FFF6EE', line='#1A1714',
        chipBg='#FFFFFFAA', chipText='#1A1714', chipBorder='#1A1714',
        logoRing='#FAF6EC', textureOpacity='0.5'),
 'paint': dict(bg='#E8703A', surface='#F5EFE2', text='#FFF6EE', sub='#FCE3D3',
        accent='#1A1714', accentText='#FFF6EE', line='#7A2E0E',
        chipBg='rgba(255,246,238,.16)', chipText='#FFF6EE', chipBorder='rgba(255,246,238,.55)',
        logoRing='#FFF6EE', textureOpacity='0.18'),
}

theme = sys.argv[1] if len(sys.argv) > 1 else 'dark'
outname = sys.argv[2] if len(sys.argv) > 2 else 'render.html'
th = THEMES[theme]

src = open(os.path.join(W, "Main.dc.html"), encoding="utf-8").read()
style = re.search(r'<style>(.*?)</style>',
                  re.search(r'<helmet>(.*?)</helmet>', src, re.S).group(1), re.S).group(1)
stage = src[src.index('<!-- ===== THE 1080x1920 REEL STAGE'):
            src.index('<!-- ===================== CONTROL BAR')]
durs = json.loads(re.search(r'this\.durations = (\[[^\]]*\]);', src).group(1))

stage = re.sub(r'<div ref="\{\{ setWrapRef \}\}"[^>]*>', '', stage, count=1).rstrip()
stage = re.sub(r'</div>\s*</div>\s*$', '</div>', stage).replace('ref="{{ setStageRef }}" ', '')
stage = re.sub(r'<sc-if value="\{\{ s(\d) \}\}"[^>]*>',
               lambda m: '<div class="scene" data-scene="%s">' % m.group(1), stage)
stage = stage.replace('</sc-if>', '</div>')
for k, v in th.items():
    stage = stage.replace('{{ %s }}' % k, v)
assert not re.findall(r'\{\{[^}]*\}\}', stage), re.findall(r'\{\{[^}]*\}\}', stage)

TPL = """<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
<style>
html,body{margin:0;padding:0;background:__BG__;width:1080px;height:1920px;overflow:hidden;}
#stagehost{position:relative;width:1080px;height:1920px;font-family:'Inter',system-ui,sans-serif;}
#stagehost > div{border-radius:0 !important;box-shadow:none !important;}
.scene{display:none;} .scene.on{display:block;}
__STYLE__
</style></head><body><div id="stagehost">
__STAGE__
</div>
<script>
const DUR = __DUR__; const STARTS=[]; let acc=0; for(const d of DUR){STARTS.push(acc);acc+=d;}
window.__total = acc;
const scenes=[...document.querySelectorAll('.scene')]; let cur=-1;
window.__seek=function(ms){
  let i=0; for(let k=0;k<STARTS.length;k++){ if(ms>=STARTS[k]) i=k; }
  if(i!==cur){ scenes.forEach((el,k)=>el.classList.toggle('on',k===i)); void document.body.offsetHeight; cur=i; }
  const local=ms-STARTS[i];
  for(const a of document.getAnimations()){ try{ a.pause(); a.currentTime=local; }catch(e){} }
  return i;
};
</script></body></html>"""

html = (TPL.replace('__BG__', th['bg'])
           .replace('__STYLE__', style)
           .replace('__STAGE__', stage)
           .replace('__DUR__', json.dumps(durs)))
open(os.path.join(W, outname), "w", encoding="utf-8").write(html)
print(outname, "ok —", theme, "— total", sum(durs), "ms")
