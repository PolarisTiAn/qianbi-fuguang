import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import earthColorURL from '../assets/materials/earth-color.webp';
import earthNormalURL from '../assets/materials/earth-normal.webp';
import earthORMURL from '../assets/materials/earth-orm.webp';
import floorColorURL from '../assets/materials/floor-color.webp';
import floorNormalURL from '../assets/materials/floor-normal.webp';
import floorORMURL from '../assets/materials/floor-orm.webp';

export async function loadCaveTextures() {
  const loader = new THREE.TextureLoader();
  const entries = Object.entries({earthColor:earthColorURL,earthNormal:earthNormalURL,earthORM:earthORMURL,floorColor:floorColorURL,floorNormal:floorNormalURL,floorORM:floorORMURL});
  const results = await Promise.allSettled(entries.map(async ([name,url]) => {
    const texture = await loader.loadAsync(url);
    texture.colorSpace = name.endsWith('Color') ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return [name, texture];
  }));
  if (results.some(result => result.status === 'rejected')) {
    results.forEach(result => { if (result.status === 'fulfilled') result.value[1].dispose(); });
    throw new Error('cave-texture-load');
  }
  return Object.fromEntries(results.map(result => result.value));
}

// Smooth, deterministic variation at three spatial scales, in metres.
function relief(x, y, z, seed = 0) {
  return Math.sin(x * 1.73 + y * .81 + z * 1.12 + seed) * .48
    + Math.sin(x * 4.17 - y * 3.45 + z * 2.82 + seed * 2) * .22
    + Math.sin(x * 11.61 + y * 13.13 - z * 8.74 + seed) * .09;
}
function shading(x, y, z, seed, edge = 1) {
  const variation = .94 + .06 * relief(x * .7,y * .5,z * .7,seed);
  const foot = .72 + .28 * THREE.MathUtils.smoothstep(y, 0, .8);
  return Math.max(.25, variation * foot * edge);
}
function finish(geometry, material, parent, name) {
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

export function caveMaterials(textures, renderer) {
  Object.values(textures).forEach(texture => { texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); });
  const earth = {map:textures.earthColor,normalMap:textures.earthNormal,normalScale:new THREE.Vector2(.65,.65),aoMap:textures.earthORM,aoMapIntensity:.65,roughnessMap:textures.earthORM,roughness:1,metalness:0,vertexColors:true,side:THREE.DoubleSide};
  return {
    wall:new THREE.MeshStandardMaterial({...earth,color:'#eee8dc'}),
    corridor:new THREE.MeshStandardMaterial({...earth,color:'#e8deca',normalScale:new THREE.Vector2(.55,.55)}),
    ceiling:new THREE.MeshStandardMaterial({...earth,color:'#bec4bc',normalScale:new THREE.Vector2(.48,.48)}),
    rock:new THREE.MeshStandardMaterial({...earth,color:'#d7c8b0',normalScale:new THREE.Vector2(.7,.7)}),
    plinth:new THREE.MeshStandardMaterial({...earth,color:'#dbd1bd',normalScale:new THREE.Vector2(.7,.7)}),
    seam:new THREE.MeshStandardMaterial({...earth,color:'#746959'}),
    floor:new THREE.MeshStandardMaterial({map:textures.floorColor,normalMap:textures.floorNormal,normalScale:new THREE.Vector2(.32,.32),aoMap:textures.floorORM,aoMapIntensity:.5,roughnessMap:textures.floorORM,roughness:1,vertexColors:true,color:'#c3b8a3',side:THREE.DoubleSide})
  };
}

// A bilinear patch retains matched boundaries while its interior has shallow
// hand-worked relief. UVs are measured in metres, so grain does not stretch.
export function surface(parent, corners, material, {width, height, seed=1, depth=.04, tile=2, edgeShade=.12, name='earthen-surface'}={}) {
  const nx = Math.max(8, Math.ceil(width * 4)), ny = Math.max(8, Math.ceil(height * 4));
  const points = corners.map(p => new THREE.Vector3(...p));
  const normal = points[1].clone().sub(points[0]).cross(points[3].clone().sub(points[0])).normalize();
  const positions=[], uvs=[], colors=[], indices=[];
  const p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  for(let j=0;j<=ny;j++) for(let i=0;i<=nx;i++) {
    const u=i/nx,v=j/ny;
    a.lerpVectors(points[0],points[1],u); b.lerpVectors(points[3],points[2],u); p.lerpVectors(a,b,v);
    const edge = Math.min(u,1-u,v,1-v);
    const edgeMask = THREE.MathUtils.smoothstep(edge,0,.08);
    p.addScaledVector(normal, relief(p.x,p.y,p.z,seed)*depth*edgeMask);
    positions.push(p.x,p.y,p.z);
    uvs.push(u * width / tile + seed*.137, v * height / tile + seed*.191);
    const tone=shading(p.x,p.y,p.z,seed,1-edgeShade*(1-THREE.MathUtils.smoothstep(edge,0,.06)));
    colors.push(tone,tone,tone);
    if(i<nx&&j<ny) {const k=j*(nx+1)+i;indices.push(k,k+1,k+nx+1,k+1,k+nx+2,k+nx+1);}
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  return finish(geometry,material,parent,name);
}

export function wornBlock(parent, size, position, material, {radius=.06, seed=1, wear=.014, name='worn-earthen-edge'}={}) {
  const geometry = new RoundedBoxGeometry(...size, 3, radius);
  const attribute=geometry.attributes.position, normals=geometry.attributes.normal, uv=geometry.attributes.uv;
  const colors=[];
  const projected=new THREE.Vector3();
  // RoundedBox has one UV island per face; keep each island's projection stable
  // across the bevel rather than selecting an axis at every rounded vertex.
  geometry.groups.forEach((group,face) => {
    for(let i=group.start;i<group.start+group.count;i++) {
      const x=attribute.getX(i),y=attribute.getY(i),z=attribute.getZ(i);
      projected.set(x+position[0],y+position[1],z+position[2]);
      const offset=wear*relief(projected.x*2,projected.y*2,projected.z*2,seed);
      attribute.setXYZ(i,x+normals.getX(i)*offset,y+normals.getY(i)*offset,z+normals.getZ(i)*offset);
      if(face<2) uv.setXY(i,z/2,y/2);
      else if(face<4) uv.setXY(i,x/2,z/2);
      else uv.setXY(i,x/2,y/2);
      const shade=shading(projected.x,projected.y,projected.z,seed);
      colors[i*3]=colors[i*3+1]=colors[i*3+2]=shade;
    }
  });
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  // Keep rounded normals: recomputing a non-indexed rounded box creates facets.
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position); mesh.castShadow=mesh.receiveShadow=true; mesh.name=name;
  parent.add(mesh);return mesh;
}

// The tunnel has one continuous inner skin, with rounded shoulders and shallow
// unevenness; it is deliberately not an invented stone or brick vault.
export function passageSkin(parent, material) {
  const profile=[];
  for(let i=0;i<=16;i++) profile.push([-1.4,3.23*i/16]);
  for(let i=1;i<=10;i++) {const a=Math.PI-(Math.PI/2)*i/10;profile.push([-1.08+.32*Math.cos(a),3.23+.32*Math.sin(a)]);}
  for(let i=1;i<=14;i++) profile.push([-1.08+2.16*i/14,3.55]);
  for(let i=1;i<=10;i++) {const a=Math.PI/2-(Math.PI/2)*i/10;profile.push([1.08+.32*Math.cos(a),3.23+.32*Math.sin(a)]);}
  for(let i=1;i<=16;i++) profile.push([1.4,3.23*(1-i/16)]);
  const lengths=[0];
  for(let i=1;i<profile.length;i++)lengths.push(lengths[i-1]+Math.hypot(profile[i][0]-profile[i-1][0],profile[i][1]-profile[i-1][1]));
  const positions=[],uvs=[],colors=[],indices=[],segments=36,n=profile.length;
  for(let j=0;j<=segments;j++) for(let i=0;i<n;i++) {
    const t=j/segments,z=6.42+4.48*t;
    let [x,y]=profile[i];
    const taper=Math.sin(t*Math.PI),w=relief(x,y,z,19)*.035*taper;
    x+=Math.sign(x)*w;y+=y>3?w*.7:0;
    positions.push(x,y,z);uvs.push(lengths[i]/1.8,z/1.8);
    const corner = y>3.15?.87:1;
    const tone=shading(x,y,z,19,corner);
    colors.push(tone,tone,tone);
    if(i<n-1&&j<segments){const k=j*n+i;indices.push(k,k+1,k+n,k+1,k+n+1,k+n);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
  return finish(geometry,material,parent,'continuous-rounded-passage');
}
