import * as THREE from 'three';
import east from '../assets/cave61/east.webp';
import south from '../assets/cave61/south.webp';
import north from '../assets/cave61/north.webp';
import roofEast from '../assets/cave61/roof-east.webp';
import roofSouth from '../assets/cave61/roof-south.webp';
import roofWest from '../assets/cave61/roof-west.webp';
import roofNorth from '../assets/cave61/roof-north.webp';
import caisson from '../assets/cave61/caisson.webp';
import screen from '../assets/cave61/screen.webp';
import passageSouth from '../assets/cave61/passage-south.webp';
import passageNorth from '../assets/cave61/passage-north.webp';
import passageSlopeSouth from '../assets/cave61/passage-slope-south.webp';
import passageSlopeNorth from '../assets/cave61/passage-slope-north.webp';
import passageTop from '../assets/cave61/passage-top.webp';
import screenRear from '../assets/cave61/screen-rear-projected.webp';
import altarUpperSouth from '../assets/cave61/altar-upper-south.webp';
import altarUpperNorth from '../assets/cave61/altar-upper-north.webp';
import altarUpperInset from '../assets/cave61/altar-upper-inset.webp';
import altarLowerSouth from '../assets/cave61/altar-lower-south.webp';
import altarLowerNorth from '../assets/cave61/altar-lower-north.webp';
import floorPhoto from '../assets/cave61/floor-photo.webp';
import earthPhoto from '../assets/cave61/earth-photo.webp';
import { caveMaterials, wornBlock } from './cave-surfaces.js';

// All geometric dimensions are adjustable photo-based estimates, NOT surveyed measurements.
// +X north, +Y up, +Z east (entrance); Wutai mural lies on west wall at -Z.
export const CAVE61 = Object.freeze({width:13,depth:13,wallHeight:13*1427/3286,roofHeight:8.1,caissonWidth:3.25,
  altarWidth:7.35,altarDepth:6.85,altarFront:2.1,altarHeight:1.3,lowerTierHeight:.78,notchWidth:2.45,notchDepth:1.32,
  upperTierWidth:6.85,upperTierFront:1.25,upperNotchWidth:2.75,upperNotchDepth:2.2,
  screenWidth:5.1,screenHeight:5.64,screenDepth:.5,screenZ:-4.35,
  passageWidth:3.1,passageEave:3.25,passageHeight:4.0,passageEnd:11.45});

export async function loadCave61References(){
  const loader=new THREE.TextureLoader();
  const pairs=Object.entries({east,south,north,roofEast,roofSouth,roofWest,roofNorth,caisson,screen,screenRear,altarUpperSouth,altarUpperNorth,altarUpperInset,altarLowerSouth,altarLowerNorth,floorPhoto,earthPhoto,passageSouth,passageNorth,passageSlopeSouth,passageSlopeNorth,passageTop});
  const result=await Promise.allSettled(pairs.map(async([key,url])=>{
    const texture=await loader.loadAsync(url);texture.colorSpace=THREE.SRGBColorSpace;return [key,texture];
  }));
  if(result.some(x=>x.status==='rejected')){result.forEach(x=>{if(x.status==='fulfilled')x.value[1].dispose();});throw new Error('cave61-reference-load');}
  return Object.fromEntries(result.map(x=>x.value));
}
function mesh(geometry,material,parent,name){const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function tiledFloor(parent,material,width,depth,tile=.86,centerX=0,centerZ=0){
  // The main room floor is made from individually separated, slightly uneven
  // slabs. This preserves the photographed square-lay pattern while avoiding
  // a large flat image that reads as a single stretched texture.
  const gap=.012,nx=Math.ceil(width/tile),nz=Math.ceil(depth/tile),
    actualX=width/nx,actualZ=depth/nz,positions=[],uvs=[],indices=[];
  const yAt=(i,j,c)=>.006+.006*Math.sin(i*12.7+j*7.3+c*1.8)+.002*Math.sin(i*3.1-j*5.2);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x0=centerX-width/2+i*actualX+gap/2,x1=centerX-width/2+(i+1)*actualX-gap/2;
    const z0=centerZ-depth/2+j*actualZ+gap/2,z1=centerZ-depth/2+(j+1)*actualZ-gap/2;
    const base=positions.length/3;
    [[x0,z0],[x1,z0],[x1,z1],[x0,z1]].forEach(([x,z],c)=>positions.push(x,yAt(i,j,c),z));
    const u0=i/nx*2.6,u1=(i+1)/nx*2.6,v0=j/nz*2.6,v1=(j+1)/nz*2.6;
    uvs.push(u0,v0,u1,v0,u1,v1,u0,v1);indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
  return mesh(g,material,parent,'main-floor-individual-slab-grid');
}
function quad(parent,points,material,name,uvs=[[0,0],[1,0],[1,1],[0,1]],recess=false){
  const vertices=[],tex=[],indices=[],n=recess?36:12;
  const normal=new THREE.Vector3(...points[1]).sub(new THREE.Vector3(...points[0])).cross(new THREE.Vector3(...points[3]).sub(new THREE.Vector3(...points[0]))).normalize();
  for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){
    const u=x/n,v=y/n;
    // Gently hollow the painted corner fields while keeping common seams fixed.
    // These shallow corner sections are estimates, not scanned profiles.
    const edge=Math.min(u,1-u);
    const dip=recess?-.19*Math.exp(-(((edge-.11)/.11)**2+((v-.21)/.18)**2))*Math.sin(Math.PI*Math.min(1,edge/.2))*Math.sin(Math.PI*Math.min(1,v/.45)):0;
    for(let axis=0;axis<3;axis++)vertices.push((1-v)*((1-u)*points[0][axis]+u*points[1][axis])+v*((1-u)*points[3][axis]+u*points[2][axis])+normal.getComponent(axis)*dip);
    for(let axis=0;axis<2;axis++)tex.push((1-v)*((1-u)*uvs[0][axis]+u*uvs[1][axis])+v*((1-u)*uvs[3][axis]+u*uvs[2][axis]));
    if(x<n&&y<n){const k=y*(n+1)+x;indices.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));g.setIndex(indices);g.computeVertexNormals();return mesh(g,material,parent,name);
}
// Polygon in the XZ ground plane; notch is real geometry, not hidden beneath a box.
function altarTier(parent,width,back,front,notchWidth,notchDepth,bottom,height,material,name){
  const x=width/2,n=notchWidth/2;
  const points=[[-x,-back],[x,-back],[x,-front],[n,-front],[n,-front+notchDepth],[-n,-front+notchDepth],[-n,-front],[-x,-front]];
  const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
  const g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:true,bevelSize:.035,bevelThickness:.024,bevelSegments:2,steps:1});
  // Extrusion local Y is -world Z; local Z is height.
  const pos=g.attributes.position,uv=g.attributes.uv;
  const norms=g.attributes.normal;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),nx=norms.getX(i),ny=norms.getY(i),nz=norms.getZ(i);
    uv.setXY(i,Math.abs(nz)>.65?x/2.5:(Math.abs(nx)>Math.abs(ny)?y/2.5:x/2.5),Math.abs(nz)>.65?y/2.5:z/2.5);
    // Millimetric wear softens the rim while preserving the notched plan.
    const noise=.007*Math.sin(x*13+y*7+z*3)*Math.sin(x*9-y*11);
    pos.setXYZ(i,x+nx*noise,y+ny*noise,z+nz*noise);
  }
  const m=mesh(g,material,parent,name);m.rotation.x=-Math.PI/2;m.position.y=bottom;return m;
}
function verticalShape(parent,shape,material,name,z,depth=.32){
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:18,steps:1});
  const pos=g.attributes.position,uv=g.attributes.uv;
  const normal=g.attributes.normal;
  for(let i=0;i<pos.count;i++)uv.setXY(i,Math.abs(normal.getX(i))>.5?pos.getZ(i)/2:pos.getX(i)/2,pos.getY(i)/2);
  const m=mesh(g,material,parent,name);m.position.z=z;return m;
}

export function buildCave61(owner,references,surfaceTextures){
  const p=CAVE61, H=p.wallHeight,R=p.roofHeight,r=p.caissonWidth/2,W=p.width/2;
  const root=new THREE.Group();root.name='Mogao-061-photo-based-study';
  root.userData={source:'https://www.e-dunhuang.com/cave/10.0001/0001.0001.0061',referenceDate:'2026-10-28',geometry:'Photo-based approximate blockout; NOT a survey or scan',axis:'+X north; +Y up; +Z east',parameters:p};owner.scene.add(root);owner.modelRoot=root;
  const floorMap=references.floorPhoto;
  floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;
  const materials=caveMaterials(surfaceTextures,owner.renderer);
  // The current cave blockout uses analytical quad and solid geometries. Keep
  // the PBR maps but do not ask those meshes for a missing vertex-color buffer.
  Object.values(materials).forEach(material=>{material.vertexColors=false;});
  const plaster=materials.wall;
  const altarMaterial=materials.plinth;
  references.earthPhoto.wrapS=references.earthPhoto.wrapT=THREE.MirroredRepeatWrapping;
  altarMaterial.map=references.earthPhoto;altarMaterial.color.set('#ddd1bd');altarMaterial.normalScale.set(.15,.15);altarMaterial.aoMapIntensity=.2;
  const floorMaterial=materials.floor.clone();
  floorMaterial.map=floorMap;floorMaterial.normalMap=null;floorMaterial.aoMap=null;floorMaterial.roughnessMap=null;
  floorMaterial.color.set('#d5c8b1');floorMaterial.needsUpdate=true;
  const body=materials.rock.clone();body.color.set('#c5b69e');
  const paint=key=>new THREE.MeshStandardMaterial({map:references[key],roughness:1,side:THREE.DoubleSide,alphaTest:.3,emissive:'#000000',emissiveIntensity:0});
  Object.values(references).forEach(t=>{t.anisotropy=Math.min(8,owner.renderer.capabilities.getMaxAnisotropy());});
  const wallPaint={south:paint('south'),north:paint('north'),east:paint('east')};
  owner.southWall=new THREE.Group();owner.southWall.name='south-wall';root.add(owner.southWall);
  owner.northWall=new THREE.Group();owner.northWall.name='north-wall';root.add(owner.northWall);
  owner.eastWall=new THREE.Group();owner.eastWall.name='east-wall-with-door';root.add(owner.eastWall);
  owner.roof=new THREE.Group();owner.roof.name='truncated-pyramid-roof';root.add(owner.roof);
  owner.passage=new THREE.Group();owner.passage.name='flat-top-sloping-side-passage';root.add(owner.passage);
  owner.platform=new THREE.Group();owner.platform.name='two-tier-notched-altar';root.add(owner.platform);
  owner.backScreen=new THREE.Group();owner.backScreen.name='independent-backscreen';root.add(owner.backScreen);
  owner.cutawayEdges=new THREE.Group();owner.cutawayEdges.name='cutaway-guides';owner.scene.add(owner.cutawayEdges);
  // Thin structural wall backs and wall paintings. Inward paint surfaces carry no fake frames.
  for(const [sign,group,key] of [[-1,owner.southWall,'south'],[1,owner.northWall,'north']]){
    const b=mesh(new THREE.BoxGeometry(.26,H,13),body,group,key+'-wall-body');b.position.set(sign*6.64,H/2,0);
    const points=sign===-1?[[-W,0,W],[-W,0,-W],[-W,H,-W],[-W,H,W]]:[[W,0,-W],[W,0,W],[W,H,W],[W,H,-W]];
    quad(group,points,wallPaint[key],key+'-official-mural');
  }
  tiledFloor(root,floorMaterial,p.width,p.depth,.86);
  const groutMaterial=materials.seam.clone();groutMaterial.color.set('#766b5d');groutMaterial.vertexColors=false;groutMaterial.needsUpdate=true;
  const floorBacking=mesh(new THREE.BoxGeometry(13.25,.16,13.25),groutMaterial,root,'floor-backing');floorBacking.position.y=-.09;
  const westBacking=mesh(new THREE.BoxGeometry(13,H,.24),body,root,'west-wall-body');westBacking.position.set(0,H/2,-6.64);
  // East wall excludes the doorway in geometry, so navigation/picking respects it.
  const doorHalf=p.passageWidth/2, shoulder=.7, peak=p.passageHeight;
  const eastShape=new THREE.Shape();[[-W,0],[-doorHalf,0],[-doorHalf,p.passageEave],[-doorHalf+shoulder,peak],[doorHalf-shoulder,peak],[doorHalf,p.passageEave],[doorHalf,0],[W,0],[W,H],[-W,H]].forEach(([x,y],i)=>i?eastShape.lineTo(x,y):eastShape.moveTo(x,y));eastShape.closePath();
  const eg=new THREE.ShapeGeometry(eastShape),ep=eg.attributes.position,eu=eg.attributes.uv;
  // Match the preview's actual cutout to the geometric opening. A single
  // rectangular UV mapping would leave see-through slivers beside the door.
  const mapInterval=(v,from,to)=>{
    for(let j=1;j<from.length;j++)if(v<=from[j])return THREE.MathUtils.lerp(to[j-1],to[j],(v-from[j-1])/(from[j]-from[j-1]));
    return to.at(-1);
  };
  for(let i=0;i<ep.count;i++)eu.setXY(i,
    mapInterval(-ep.getX(i),[-W,-doorHalf,-doorHalf+shoulder,doorHalf-shoulder,doorHalf,W],[0,375/1050,430/1050,635/1050,690/1050,1]),
    mapInterval(ep.getY(i),[0,p.passageEave,peak,H],[0,1-145/418,1-95/418,1]));
  const em=mesh(eg,wallPaint.east,owner.eastWall,'east-official-mural-with-opening');em.position.z=6.49;
  // Low-poly solid reveals behind the mural opening.
  for(const x of [-1,1]){const b=mesh(new THREE.BoxGeometry(4.95,H,.26),body,owner.eastWall,'east-wall-body');b.position.set(x*4.025,H/2,6.65);}
  const lintel=mesh(new THREE.BoxGeometry(3.1,H-peak,.26),body,owner.eastWall,'east-lintel-body');lintel.position.set(0,(H+peak)/2,6.65);
  const sides=[{key:'roofWest',b:[[-W,H,-W],[W,H,-W]],t:[[-r,R,-r],[r,R,-r]],uv:[.34,.66]},
    {key:'roofNorth',b:[[W,H,-W],[W,H,W]],t:[[r,R,-r],[r,R,r]],uv:[.34,.66]},
    {key:'roofEast',b:[[W,H,W],[-W,H,W]],t:[[r,R,r],[-r,R,r]],uv:[.34,.66]},
    {key:'roofSouth',b:[[-W,H,W],[-W,H,-W]],t:[[-r,R,r],[-r,R,-r]],uv:[.34,.66]}];
  for(const s of sides){const pts=[s.b[0],s.b[1],s.t[1],s.t[0]];quad(owner.roof,pts,plaster,s.key+'-plaster',undefined,true);const painted=quad(owner.roof,pts,paint(s.key),s.key+'-official-paint',undefined,true);painted.material.polygonOffset=true;painted.material.polygonOffsetFactor=-1;painted.material.polygonOffsetUnits=-1;}
  quad(owner.roof,[[-r,R,-r],[r,R,-r],[r,R,r],[-r,R,r]],paint('caisson'),'central-painted-caisson');
  // Two U-shaped tiers with a real opening at the east front; no solid box fills the notch.
  const back=p.altarFront-p.altarDepth;
  const lowerTop=p.lowerTierHeight,upperBottom=lowerTop+.025;
  altarTier(owner.platform,p.altarWidth,back,p.altarFront,p.notchWidth,p.notchDepth,.02,lowerTop-.02,altarMaterial,'altar-lower-tier');
  altarTier(owner.platform,p.upperTierWidth,back+.12,p.upperTierFront,p.upperNotchWidth,p.upperNotchDepth,upperBottom,p.altarHeight-upperBottom,altarMaterial,'altar-upper-tier');
  for(let i=0;i<4;i++){
    const h=(i+1)*lowerTop/4;
    wornBlock(owner.platform,[1.17+(3-i)*.04,h,.34],[0,.018+h/2,p.altarFront-.14-i*.31],altarMaterial,{radius:.035,seed:i+41,wear:.012,name:'central-step-'+(i+1)});
  }
  // Only source-visible panels receive their own rectified photographs.
  // Unrecorded side faces remain earthen; ornament is not tiled around the altar.
  function altarFace(x0,x1,y0,y1,z,key){
    const m=quad(owner.platform,[[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]],paint(key),key+'-source-panel');
    m.userData={source:'zhushi/f.jpg',projection:'Four-corner estimated rectification of the corresponding visible panel'};
    return m;
  }
  for(const [sign,lower,upper] of [[-1,'altarLowerSouth','altarUpperSouth'],[1,'altarLowerNorth','altarUpperNorth']]){
    const lx=[sign*p.altarWidth/2,sign*p.notchWidth/2].sort((a,b)=>a-b);
    const ux=[sign*p.upperTierWidth/2,sign*p.upperNotchWidth/2].sort((a,b)=>a-b);
    altarFace(...lx,.055,lowerTop-.035,p.altarFront+.038,lower);
    altarFace(...ux,upperBottom+.025,p.altarHeight-.025,p.upperTierFront+.038,upper);
  }
  altarFace(-p.upperNotchWidth/2,p.upperNotchWidth/2,upperBottom+.025,p.altarHeight-.025,p.upperTierFront-p.upperNotchDepth+.038,'altarUpperInset');
  // The back screen outline follows the official front preview, with curved
  // shoulders. Its rear extends to ground level behind the platform.
  const sw=p.screenWidth,sh=p.screenHeight,sy=p.altarHeight;
  function screenShape(bottom){
    const shape=new THREE.Shape(),x=u=>(u-.5)*sw,y=v=>sy+v*sh;
    shape.moveTo(x(.145),bottom);shape.lineTo(x(.145),y(.59));
    shape.bezierCurveTo(x(.03),y(.64),x(0),y(.73),x(0),y(.84));
    shape.bezierCurveTo(x(0),y(.92),x(.035),y(1),x(.08),y(1));
    shape.lineTo(x(.92),y(1));
    shape.bezierCurveTo(x(.965),y(1),x(1),y(.92),x(1),y(.84));
    shape.bezierCurveTo(x(1),y(.73),x(.97),y(.64),x(.855),y(.59));
    shape.lineTo(x(.855),bottom);shape.closePath();return shape;
  }
  const shape=screenShape(0),frontShape=screenShape(sy);
  verticalShape(owner.backScreen,shape,plaster,'backscreen-thick-body',p.screenZ-p.screenDepth/2,p.screenDepth);
  const sg=new THREE.ShapeGeometry(frontShape,24),sp=sg.attributes.position,suv=sg.attributes.uv;
  for(let i=0;i<sp.count;i++)suv.setXY(i,sp.getX(i)/sw+.5,(sp.getY(i)-sy)/sh);
  const painted=mesh(sg,paint('screen'),owner.backScreen,'backscreen-official-front');painted.position.z=p.screenZ+.255;painted.castShadow=false;
  const rearGeometry=new THREE.ShapeGeometry(shape),rp=rearGeometry.attributes.position,ruv=rearGeometry.attributes.uv;
  for(let i=0;i<rp.count;i++)ruv.setXY(i,.5-rp.getX(i)/sw,rp.getY(i)/(sy+sh));
  // All six cube faces are projected into an estimated plane with source-space
  // masks. The transform is documented; it is not a measured orthophoto.
  const rearMaterial=paint('screenRear');
  rearMaterial.userData={projection:'beiping six-face cubemap, estimated planar reprojection with adjacent surfaces masked; see detail-sources.json'};
  const rearPaint=mesh(rearGeometry,rearMaterial,owner.backScreen,'backscreen-official-rear-panorama-projection');
  rearPaint.position.z=p.screenZ-p.screenDepth/2-.006;rearPaint.castShadow=false;
  // A continuous worn earthen footprint follows the low remnants visible in
  // fotannan/b.jpg. Extents/depths are estimates; no missing statue is invented.
  const remains=new THREE.PlaneGeometry(2.9,2.4,64,56);remains.rotateX(-Math.PI/2);
  const rp2=remains.attributes.position,ruv2=remains.attributes.uv;
  for(let i=0;i<rp2.count;i++){
    const x=rp2.getX(i),z=rp2.getZ(i),wx=x,wz=z-2.85;
    const edge=THREE.MathUtils.smoothstep(Math.min(1.45-Math.abs(x),1.2-Math.abs(z)),0,.22);
    const footprint=Math.exp(-Math.pow(x/.8,6)-Math.pow(z/.74,6));
    let h=.13*footprint+.018*(Math.sin(x*19+z*11)+.4*Math.sin(x*37-z*23));
    for(const [cx,cz] of [[-.35,-.65],[.35,-.67],[.12,.15]])h-=.09*Math.exp(-((x-cx)**2/.022+(z-cz)**2/.03));
    rp2.setXYZ(i,wx,p.altarHeight+.027+edge*Math.max(.006,h),wz);ruv2.setXY(i,wx/2.5,wz/2.5);
  }
  remains.computeVertexNormals();
  mesh(remains,altarMaterial,owner.platform,'eroded-earth-footprint-study').userData={source:'fotannan/b.jpg',accuracy:'visible low remains, estimated shape and scale; identity not asserted'};
  const z0=6.5,z1=p.passageEnd,d=p.passageWidth/2,a=d-.7,ey=p.passageEave,ty=p.passageHeight;
  for(const [sign,key,slope] of [[-1,'passageSouth','passageSlopeSouth'],[1,'passageNorth','passageSlopeNorth']]){
    const pts=sign===-1?[[sign*d,0,z1],[sign*d,0,z0],[sign*d,ey,z0],[sign*d,ey,z1]]:[[sign*d,0,z0],[sign*d,0,z1],[sign*d,ey,z1],[sign*d,ey,z0]];
    quad(owner.passage,pts,plaster,key+'-plaster');const paintWall=quad(owner.passage,pts,paint(key),key+'-official-mural');paintWall.material.polygonOffset=true;paintWall.material.polygonOffsetFactor=-1;paintWall.material.polygonOffsetUnits=-1;
    const slopePts=sign===-1?[[-d,ey,z1],[-d,ey,z0],[-a,ty,z0],[-a,ty,z1]]:[[d,ey,z0],[d,ey,z1],[a,ty,z1],[a,ty,z0]];
    quad(owner.passage,slopePts,paint(slope),slope+'-official-mural');
  }
  quad(owner.passage,[[-a,ty,z1],[a,ty,z1],[a,ty,z0],[-a,ty,z0]],plaster,'passage-ceiling-plaster');
  const top=quad(owner.passage,[[-a,ty-.006,z1],[a,ty-.006,z1],[a,ty-.006,z0],[-a,ty-.006,z0]],paint('passageTop'),'passage-flat-top-six-flower-reference',[[1,0],[1,1],[0,1],[0,0]]);
  top.userData.note='Rectangular photo projected to estimated flat top; dimensions not measured';
  tiledFloor(owner.passage,floorMaterial,p.passageWidth,z1-z0,.72,0,(z0+z1)/2);
  // Exterior is a restrained cutaway threshold, because no verified complete facade is available.
  const threshold=new THREE.Shape();[[-5,0],[-d,0],[-d,ey],[-a,ty],[a,ty],[d,ey],[d,0],[5,0],[5,5.5],[-5,5.5]].forEach(([x,y],i)=>i?threshold.lineTo(x,y):threshold.moveTo(x,y));threshold.closePath();
  verticalShape(owner.passage,threshold,body,'unmeasured-exterior-threshold',z1,.28);
  quad(owner.passage,[[-5,-.01,17],[5,-.01,17],[5,-.01,z1],[-5,-.01,z1]],floorMaterial,'entrance-apron',[[0,0],[2,0],[2,1.1],[0,1.1]]);
  owner.modelRoot.updateMatrixWorld(true);
  return {root,plaster,floorMaterial};
}
