"""Local source projections only. No generative fill or watermark removal.
Screen camera pose and altar corner correspondences are visual estimates, not survey data.
"""
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT.parent/'千壁浮光_参考素材/第61窟_三维建模资料_2026-10-28/panorama'
OUT=ROOT/'assets/cave61'
manifest=[]
def rectified(key,scene,face,points,size,part):
    image=Image.open(SRC/scene/f'{face}.jpg').convert('RGB')
    w,h=size;dst=[(0,0),(w,0),(w,h),(0,h)];a=[];b=[]
    for (x,y),(u,v) in zip(dst,points):
        a.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]]);b.extend([u,v])
    coeff=np.linalg.solve(a,b)
    result=image.transform(size,Image.Transform.PERSPECTIVE,coeff,Image.Resampling.BICUBIC)
    result.save(OUT/f'{key}.webp',quality=92,method=6)
    manifest.append(dict(file=f'{key}.webp',source_file=str(SRC/scene/f'{face}.jpg'),part=part,corners=points,pixels=size,processing='Four-corner perspective rectification of visible source area; photograph lighting retained; estimated correspondence'))
# Separate exposed front panels. Crops are never repeated to invent missing ornament.
rectified('altar-upper-south','zhushi','f',[(0,851),(271,871),(271,960),(0,952)],(540,180),'上层坛南侧前脸，可见局部')
rectified('altar-upper-north','zhushi','f',[(1312,874),(1535,857),(1535,967),(1310,963)],(450,180),'上层坛北侧前脸，可见局部')
rectified('altar-upper-inset','zhushi','f',[(462,831),(1078,837),(1078,888),(460,887)],(1200,132),'上层坛前部凹口内立面')
rectified('altar-lower-south','zhushi','f',[(0,1081),(329,1093),(330,1303),(0,1317)],(600,390),'下层坛南侧前脸，可见局部')
rectified('altar-lower-north','zhushi','f',[(1249,1104),(1535,1095),(1535,1303),(1247,1305)],(570,390),'下层坛北侧前脸，可见局部')
rectified('floor-photo','beiping','d',[(365,257),(1187,179),(1268,929),(438,1012)],(1024,1024),'屏后铺地照片样本；重复铺设，不代表逐砖测绘')
rectified('earth-photo','fotannan','d',[(220,430),(780,430),(780,990),(220,990)],(768,768),'佛坛素土表面样本；重复铺设只表达材质，不代表每处裂痕位置')
# The entrance is represented by the actual door-side rock and threshold
# paving from the menkou panorama. These are material samples, not a flat
# replacement for the doorway geometry.
rock=Image.open(SRC/'menkou/r.jpg').convert('RGB').crop((1100,250,1536,1400)).resize((512,1024),Image.Resampling.BICUBIC)
rock.save(OUT/'entrance-rock.webp',quality=90,method=6)
manifest.append(dict(file='entrance-rock.webp',source_file=str(SRC/'menkou/r.jpg'),part='门口侧壁岩土材质样本',crop=(1100,250,1536,1400),pixels=rock.size,processing='Side-rock/plaster crop retained as a repeated material sample; no facade panorama flattening'))
entrance_floor=Image.open(SRC/'menkou/b.jpg').convert('RGB').crop((230,980,1320,1536)).resize((1024,768),Image.Resampling.BICUBIC)
entrance_floor.save(OUT/'entrance-floor.webp',quality=90,method=6)
manifest.append(dict(file='entrance-floor.webp',source_file=str(SRC/'menkou/b.jpg'),part='门口与甬道铺地样本',crop=(230,980,1320,1536),pixels=entrance_floor.size,processing='Interior-facing panorama floor crop retained; grey slab joints and present-day wear left visible'))
# Reproject all six faces into one estimated screen plane. Source-space masks
# prevent adjacent walls, floor and ceiling becoming painted onto the screen.
N=1536
polygons={
 'f':[(0,0),(1535,0),(1535,1535),(0,1535)],
 'r':[(0,0),(425,0),(310,1000),(0,1440)],
 'l':[(1130,0),(1535,0),(1535,1535),(1250,1200)],
 'u':[(0,955),(315,810),(440,775),(1090,800),(1210,865),(1535,1080),(1535,1535),(0,1535)],
 'd':[(0,0),(1535,0),(1535,135),(0,277)],'b':[]}
faces={}
for k in 'frblud':
    im=Image.open(SRC/'beiping'/f'{k}.jpg').convert('RGBA');mask=Image.new('L',im.size)
    if polygons[k]:ImageDraw.Draw(mask).polygon(polygons[k],fill=255)
    im.putalpha(mask);faces[k]=np.array(im)
width,height=1000,1434
xx,yy=np.meshgrid(np.linspace(-2.55,2.55,width),np.linspace(6.94,0,height))
x=xx;y=yy-1.6;z=np.ones_like(x)
roll=.06;pitch=-.20
x,y=x*np.cos(roll)-y*np.sin(roll),x*np.sin(roll)+y*np.cos(roll)
y,z=y*np.cos(pitch)-z*np.sin(pitch),y*np.sin(pitch)+z*np.cos(pitch)
result=np.zeros((height,width,4),np.uint8)
axis=np.argmax(np.stack([abs(x),abs(y),abs(z)],-1),-1)
for k,mask,a,b,c in [('f',(axis==2)&(z>0),x,-y,z),('b',(axis==2)&(z<0),-x,-y,-z),('r',(axis==0)&(x>0),-z,-y,x),('l',(axis==0)&(x<0),z,-y,-x),('u',(axis==1)&(y>0),x,z,y),('d',(axis==1)&(y<0),x,-z,-y)]:
    if not mask.any():continue
    f=faces[k];sx=np.clip((a[mask]/c[mask]+1)*.5*N-.5,0,N-1);sy=np.clip((b[mask]/c[mask]+1)*.5*N-.5,0,N-1)
    x0=sx.astype(int);y0=sy.astype(int);x1=np.minimum(x0+1,N-1);y1=np.minimum(y0+1,N-1);u=(sx-x0)[:,None];v=(sy-y0)[:,None]
    result[mask]=((1-u)*(1-v)*f[y0,x0]+u*(1-v)*f[y0,x1]+(1-u)*v*f[y1,x0]+u*v*f[y1,x1]).astype('uint8')
Image.fromarray(result).save(OUT/'screen-rear-projected.webp',quality=91,method=6)
manifest.append(dict(file='screen-rear-projected.webp',source_files=[str(SRC/'beiping'/f'{k}.jpg') for k in 'frblud'],part='背屏背面六面全景重投影',processing='Cubemap ray reprojection into an estimated plane; adjacent architecture masked; transparent gaps remain unfilled; no generative content',fit=dict(width=5.1,height=6.94,camera_height=1.6,plane_distance=1.0,roll=.06,pitch=-.20,units='estimated metres and radians'),masks=polygons))
for item in manifest:item['source']='https://www.e-dunhuang.com/cave/10.0001/0001.0001.0061'
(OUT/'detail-sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Prepared',len(manifest),'source-based detail textures')
