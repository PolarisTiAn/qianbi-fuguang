// Repack the Blender GLB without changing mesh/UV data. Keep the source in the
// editable model directory. Supply a sharp package path when not installed here.
const fs=require('node:fs');
const sharp=require(process.env.QIANBI_SHARP_PATH || 'sharp');
const crypto=require('node:crypto');
(async()=>{
const source='../千壁浮光_模型/Mogao061-interior-final-source-20261029.glb';
const target='assets/cave61/Mogao061-interior-final-20261029.glb';
const file=fs.readFileSync(source), jsonLength=file.readUInt32LE(12);
const doc=JSON.parse(file.toString('utf8',20,20+jsonLength));
// The previous Blender passage script added its length towards the chamber.
// Reflect only those ten misplaced strips about the chamber threshold so that
// they sit against the passage walls (z 6.5–11.4), not inside the main room.
// Preserve the source .blend and source GLB; record this web adaptation below.
const placementCorrections=[];
for(const node of doc.nodes){
 if(!/^甬道[左右]壁_(墙脚夯土带|破损上缘|低位层理|中位层理|残损交界层)$/.test(node.name))continue;
 const accessor=doc.accessors[doc.meshes[node.mesh].primitives[0].attributes.POSITION];
 if(node.matrix||node.rotation||node.translation||node.scale)throw new Error('Unexpected passage transform');
 const threshold=accessor.max[2];
 node.scale=[1,1,-1];node.translation=[0,0,threshold*2];
 placementCorrections.push({name:node.name,before:[accessor.min[2],threshold],after:[threshold,threshold*2-accessor.min[2]]});
}
const binary=file.subarray(28+jsonLength), replacements=new Map(), converted=new Set(), images=[];
const colorSources=new Set();
for(const material of doc.materials){const color=material.pbrMetallicRoughness?.baseColorTexture;if(color)colorSources.add(doc.textures[color.index].source);}
for(const [index,img] of doc.images.entries()){
 if(!colorSources.has(index))continue;
 const view=doc.bufferViews[img.bufferView];
 const input=binary.subarray(view.byteOffset,view.byteOffset+view.byteLength);
 const output=await sharp(input).webp({quality:94,alphaQuality:100,effort:5}).toBuffer();
 const before=await sharp(input).metadata(),after=await sharp(output).metadata();
 if(before.width!==after.width||before.height!==after.height)throw new Error('Image dimensions changed');
 if(output.length>=input.length)continue;
 replacements.set(img.bufferView,output);converted.add(index);img.mimeType='image/webp';
 images.push({name:img.name,sourceBytes:input.length,webBytes:output.length,width:after.width,height:after.height});
}
for(const tex of doc.textures){if(converted.has(tex.source)){tex.extensions={...tex.extensions,EXT_texture_webp:{source:tex.source}};delete tex.source;}}
for(const key of ['extensionsUsed','extensionsRequired'])doc[key]=[...new Set([...(doc[key]||[]),'EXT_texture_webp'])];
const chunks=[];let size=0;
for(const [i,v] of doc.bufferViews.entries()){
 const payload=replacements.get(i)||binary.subarray(v.byteOffset,v.byteOffset+v.byteLength);
 const padding=Buffer.alloc((4-size%4)%4);chunks.push(padding);size+=padding.length;
 v.byteOffset=size;v.byteLength=payload.length;chunks.push(payload);size+=payload.length;
}
const tail=Buffer.alloc((4-size%4)%4);chunks.push(tail);size+=tail.length;doc.buffers[0].byteLength=size;
const raw=Buffer.from(JSON.stringify(doc)),jp=Buffer.alloc((4-raw.length%4)%4,32),jbytes=Buffer.concat([raw,jp]),bin=Buffer.concat(chunks);
const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(28+jbytes.length+bin.length,8);head.writeUInt32LE(jbytes.length,12);head.writeUInt32LE(0x4e4f534a,16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);
const result=Buffer.concat([head,jbytes,bh,bin]);fs.writeFileSync(target,result);
const report={source,target,sourceBytes:file.length,webBytes:result.length,sha256:crypto.createHash('sha256').update(result).digest('hex'),meshCount:doc.meshes.length,imageCount:doc.images.length,meshVertexDataUnchanged:true,placementCorrections,textureChanges:images};
fs.writeFileSync('assets/cave61/interior-web-manifest.json',JSON.stringify(report,null,2)+'\n');console.log({sourceBytes:file.length,webBytes:result.length,convertedImages:images.length});
})().catch(e=>{console.error(e);process.exit(1)});
