"""Prepare local PBR maps from the Poly Haven sources listed in assets/materials/SOURCES.md.
Usage: python prepare-cave-materials.py /path/to/source-jpegs
Requires Pillow and numpy. Source maps use the names clay_plaster-color.jpg,
clay_plaster-normal.jpg, clay_plaster-orm.jpg, etc. No network access is needed.
"""
from pathlib import Path
import sys
import numpy as np
from PIL import Image, ImageFilter
source=Path(sys.argv[1])
out=Path(__file__).resolve().parents[1]/'assets/materials'
out.mkdir(exist_ok=True)
def load(name, role, size):
 return np.asarray(Image.open(source/f'{name}-{role}.jpg').convert('RGB').resize((size,size),Image.Resampling.LANCZOS),dtype=np.float32)/255
size=1536
rng=np.random.default_rng(61)
# Periodic low-frequency noise keeps the blend seamless when a wall repeats it.
noise=rng.normal(size=(size,size))
spectrum=np.fft.rfft2(noise)
fy=np.fft.fftfreq(size)[:,None];fx=np.fft.rfftfreq(size)[None,:]
field=np.fft.irfft2(spectrum*np.exp(-(fx*fx+fy*fy)*18000),s=(size,size)).real
field=(field-field.min())/(field.max()-field.min())
mask=.04+field*.20
clay=load('clay_plaster','color',size)
worn=load('worn_cracked_plaster','color',size)
worn=worn/(worn.mean(axis=(0,1))+1e-6)*clay.mean(axis=(0,1))
color=clay*(1-mask[...,None])+worn*mask[...,None]
# Neutral buff plaster under warm daylight; only the texture is adjusted.
color=color/(color.mean(axis=(0,1))+1e-6)*np.array([.59,.545,.465])
color=np.clip(color,0,1)
Image.fromarray((color*255).astype(np.uint8)).save(out/'earth-color.webp',quality=87,method=6)
for role in ['normal','orm']:
 size=1024
 blend=Image.fromarray((mask*255).astype(np.uint8)).resize((size,size),Image.Resampling.BICUBIC)
 blend=np.asarray(blend,dtype=np.float32)[...,None]/255
 a=load('clay_plaster',role,size); b=load('worn_cracked_plaster',role,size)
 result=a*(1-blend)+b*blend
 if role=='normal':
  result=result*2-1;result/=np.maximum(np.linalg.norm(result,axis=2,keepdims=True),1e-4);result=(result+1)/2
 Image.fromarray(np.clip(result*255,0,255).astype(np.uint8)).save(out/f'earth-{role}.webp',quality=92,method=6)
for role in ['color','normal','orm']:
 im=Image.open(source/f'dirt_floor-{role}.jpg').convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
 im.save(out/f'floor-{role}.webp',quality=88 if role=='color' else 92,method=6)
print('Prepared 6 local texture maps:',sum(p.stat().st_size for p in out.glob('*.webp')),'bytes')
