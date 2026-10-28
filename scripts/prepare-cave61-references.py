"""Prepare dated official previews for a local study model; retain all painted pixels and watermarks."""
from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
root=Path(__file__).resolve().parents[1]
src=root.parent/'千壁浮光_参考素材/第61窟_三维建模资料_2026-10-28'
out=root/'assets/cave61';out.mkdir(exist_ok=True)
names={'主室-东壁':'east','主室-南壁':'south','主室-北壁':'north','主室-东披':'roof-east','主室-南披':'roof-south','主室-西披':'roof-west','主室-北披':'roof-north','主室-藻井':'caisson','主室-背屏':'screen','甬道-南壁':'passage-south','甬道-北壁':'passage-north','甬道-南披':'passage-slope-south','甬道-北披':'passage-slope-north','甬道-顶部':'passage-top'}
manifest=[]
for label,key in names.items():
 im=Image.open(src/'surfaces'/f'{label}.jpg').convert('RGB');a=np.asarray(im)
 # Remove the black presentation surround via connectivity only, preserving dark details within paintings.
 from collections import deque
 black=np.max(a,axis=2)<65;mask=np.zeros(black.shape,bool);h,w=black.shape
 q=deque([(x,0) for x in range(w)]+[(x,h-1) for x in range(w)]+[(0,y) for y in range(h)]+[(w-1,y) for y in range(h)])
 while q:
  x,y=q.popleft()
  if not(0<=x<w and 0<=y<h) or mask[y,x] or not black[y,x]:continue
  mask[y,x]=True;q.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
 rgba=np.dstack([a,np.where(mask,0,255).astype('uint8')]);im=Image.fromarray(rgba)
 box=im.getbbox();im=im.crop(box)
 if key.startswith('roof-'):
  # Normalize each trapezoid row to the mesh's bilinear UV rectangle. Preserve
  # internal holes (e.g. the screen occlusion), alpha, and source watermarks.
  a=np.asarray(im);hh,ww=a.shape[:2];rows=[]
  for yy in range(hh):
   nz=np.flatnonzero(a[yy,:,3]>128)
   if len(nz)>ww*.15:rows.append((yy,int(nz[0]),int(nz[-1])+1))
  if rows:
   fixed=Image.new('RGBA',(ww,rows[-1][0]-rows[0][0]+1))
   for yy in range(rows[0][0],rows[-1][0]+1):
    nearest=min(rows,key=lambda x:abs(x[0]-yy));_,left,right=nearest
    fixed.paste(im.crop((left,yy,right,yy+1)).resize((ww,1),Image.Resampling.BILINEAR),(0,yy-rows[0][0]))
   im=fixed
 im.thumbnail((1200,1200));im.save(out/f'{key}.webp',quality=90,method=6)
 manifest.append({'file':key+'.webp','source_file':str(src/'surfaces'/f'{label}.jpg'),'part':label,'crop':box,'pixels':im.size,'processing':'Crop black surround; transparent border-connected black; roof trapezoid rows normalized for UV mapping; no color correction or watermark removal','source':'https://www.e-dunhuang.com/cave/10.0001/0001.0001.0061'})
(out/'sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Prepared',len(manifest),'dated official reference textures')
