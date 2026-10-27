import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { COTTAGE_SOURCE_REVISION, cottageToReadingPosition, COTTAGE_ANCHOR, ROOM_FLOOR_Y } from '../../client/src/reading-room.mjs';

async function loadAsset(theme) {
  const binary=await readFile(new URL(`../../client/src/assets/cottage-${theme}.glb`,import.meta.url));
  assert.equal(binary.toString('ascii',0,4),'glTF');
  assert.equal(binary.readUInt32LE(4),2);
  assert.equal(binary.readUInt32LE(8),binary.length);
  const length=binary.readUInt32LE(12);
  assert.equal(binary.readUInt32LE(16),0x4e4f534a);
  const json=JSON.parse(binary.subarray(20,20+length).toString('utf8'));
  const body=binary.subarray(28+length);
  const report=JSON.parse(await readFile(new URL(`../../docs/design/stage2.4.12/cottage-${theme}-export.json`,import.meta.url),'utf8'));
  return {binary,json,body,report};
}

test('both cottage assets are verified, self-contained original static scene exports',async()=>{
  for(const theme of ['day','night']){
    const {binary,json,report}=await loadAsset(theme);
    assert.equal(createHash('sha256').update(binary).digest('hex'),report.sha256);
    assert.equal(report.sourceCommit,COTTAGE_SOURCE_REVISION);
    assert.equal(report.geometryMatches,true);assert.equal(report.boundsDelta,0);
    assert.deepEqual(report.original,report.roundTrip);
    assert.equal(json.nodes.filter(node=>node.mesh!==undefined).length,645);
    assert.equal(report.original.triangles,158560);
    assert.equal(json.images.length,13);
    assert.ok(json.images.every(image=>image.uri===undefined && Number.isInteger(image.bufferView)));
    assert.ok(json.buffers.every(buffer=>buffer.uri===undefined));
    assert.equal(json.animations,undefined);assert.equal(json.skins,undefined);
    assert.ok(json.nodes.filter(node=>node.mesh!==undefined).every(node=>node.extras?.cottageRuntime));
    assert.ok(json.materials.every(material=>material.extras?.cottageRuntime));
  }
});

test('day/night geometry and transforms match byte for byte',async()=>{
  const [day,night]=await Promise.all([loadAsset('day'),loadAsset('night')]);
  assert.deepEqual(day.json.nodes,night.json.nodes);
  function geometryDigest(asset){
    const hash=createHash('sha256');
    for(const mesh of asset.json.meshes)for(const primitive of mesh.primitives){
      for(const index of [...Object.values(primitive.attributes),primitive.indices].filter(value=>value!==undefined)){
        const accessor=asset.json.accessors[index],view=asset.json.bufferViews[accessor.bufferView];
        hash.update(JSON.stringify({count:accessor.count,type:accessor.type,componentType:accessor.componentType,byteStride:view.byteStride}));
        hash.update(asset.body.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength));
      }
    }
    return hash.digest('hex');
  }
  assert.equal(geometryDigest(day),geometryDigest(night));
});

test('uniform source transform anchors the glass above the original wood floor',()=>{
  assert.deepEqual(cottageToReadingPosition(COTTAGE_ANCHOR.x,COTTAGE_ANCHOR.y,COTTAGE_ANCHOR.z),[0,0,-.6]);
  const origin=cottageToReadingPosition(0,0,0),x=cottageToReadingPosition(1,0,0),y=cottageToReadingPosition(0,1,0),z=cottageToReadingPosition(0,0,1);
  for(const distance of [x[0]-origin[0],y[1]-origin[1],z[2]-origin[2]])assert.ok(Math.abs(distance-1/.14)<1e-10);
  assert.ok(Math.abs(ROOM_FLOOR_Y-(.002-.9)/.14)<1e-10);
});
