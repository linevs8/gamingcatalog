import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {createHash} from "node:crypto";
import updater from "../electron/updater.cjs";

const bytes=Buffer.from("mock installer");
const sha=createHash("sha256").update(bytes).digest("hex");
const name="Playquill-Setup-0.5.0-x64.exe";
const url="https://github.com/linevs8/gamingcatalog/releases/download/v0.5.0/"+name;
const release={tag_name:"v0.5.0",draft:false,prerelease:false,assets:[{name,state:"uploaded",browser_download_url:url,size:bytes.length,digest:"sha256:"+sha}]};
test("only newer stable official installers with an asset digest are accepted",()=>{
  const selected=updater.releaseAsset(release,"0.4.0");
  assert.equal(selected.latest,"0.5.0");
  assert.equal(selected.sha256,sha);
  assert.equal(updater.releaseAsset(release,"0.5.0"),null);
  assert.equal(updater.releaseAsset(release,"0.6.0"),null);
  assert.equal(updater.releaseAsset({...release,prerelease:true},"0.4.0"),null);
  assert.equal(updater.releaseAsset({...release,draft:true},"0.4.0"),null);
  for(const patch of [{digest:null},{browser_download_url:"https://example.com/update.exe"},{size:0},{size:2**31}]){
    assert.equal(updater.releaseAsset({...release,assets:[{...release.assets[0],...patch}]},"0.4.0"),null);
  }
});
test("download validates content, redirects and staged integrity",async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),"playquill-updater-test-"));
  try {
    const asset=updater.releaseAsset(release,"0.4.0");
    const progress=[];
    const redirect="https://release-assets.githubusercontent.com/mock";
    const staged=await updater.downloadAsset(asset,directory,p=>progress.push(p),async u=>u===url?new Response(null,{status:302,headers:{location:redirect}}):new Response(bytes));
    assert.equal(progress.at(-1),100);
    assert.equal(await updater.verifyStaged(staged),true);
    await fs.writeFile(staged.file,Buffer.alloc(bytes.length));
    assert.equal(await updater.verifyStaged(staged),false);
    await assert.rejects(updater.downloadAsset(asset,directory,()=>{},async()=>new Response(Buffer.alloc(bytes.length))),/integrity/);
    await assert.rejects(updater.downloadAsset(asset,directory,()=>{},async()=>new Response(null,{status:302,headers:{location:"https://example.com/update.exe"}})),/Unexpected download location/);
    await assert.rejects(updater.downloadAsset(asset,directory,()=>{},async()=>new Response(Buffer.alloc(bytes.length+1))),/size mismatch/);
  } finally {await fs.rm(directory,{recursive:true,force:true});}
});
