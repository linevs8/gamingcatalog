const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const {createHash} = require("node:crypto");
const {Readable, Transform} = require("node:stream");
const {pipeline} = require("node:stream/promises");

const ROOT = "https://github.com/linevs8/gamingcatalog/releases/download/";
const API = "https://api.github.com/repos/linevs8/gamingcatalog/releases/latest";
const MAX_SIZE = 1024*1024*1024;
const version = s => typeof s === "string" ? /^v?(\d+)\.(\d+)\.(\d+)$/.exec(s)?.slice(1).map(Number) : null;
function releaseAsset(release, current) {
  const old = version(current), next = version(release?.tag_name);
  if (!old || !next || release.draft || release.prerelease) return null;
  const i = next.findIndex((n,j)=>n!==old[j]);
  if (i<0 || next[i]<old[i]) return null;
  const latest = next.join(".");
  if (release.tag_name !== "v"+latest) return null;
  const name = "Playquill-Setup-"+latest+"-x64.exe";
  const asset = Array.isArray(release.assets) && release.assets.find(a=>a.name===name);
  const url = ROOT + release.tag_name + "/" + name;
  if (!asset || asset.state!=="uploaded" || asset.browser_download_url!==url ||
      !Number.isSafeInteger(asset.size) || asset.size<=0 || asset.size>MAX_SIZE ||
      !/^sha256:[a-f0-9]{64}$/i.test(asset.digest || "")) return null;
  return {latest,name,url,size:asset.size,sha256:asset.digest.slice(7).toLowerCase()};
}
async function latestRelease(current, fetcher=fetch) {
  const response = await fetcher(API,{headers:{"Accept":"application/vnd.github+json","User-Agent":"Playquill/"+current},signal:AbortSignal.timeout(10000),redirect:"error"});
  if(response.status===404)return null;
  if(!response.ok)throw Error("Release check failed");
  return await response.json();
}
function allowedRedirect(url) {
  const u = new URL(url);
  return u.protocol==="https:" && !u.username && !u.password && !u.port &&
    ["release-assets.githubusercontent.com","objects.githubusercontent.com","github-releases.githubusercontent.com"].includes(u.hostname);
}
async function downloadAsset(asset, directory, onProgress=()=>{}, fetcher=fetch) {
  const expected = ROOT+"v"+asset.latest+"/"+asset.name;
  if (!/^\d+\.\d+\.\d+$/.test(asset.latest) || asset.name!=="Playquill-Setup-"+asset.latest+"-x64.exe" ||
      asset.url!==expected || !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      !Number.isSafeInteger(asset.size)||asset.size<=0||asset.size>MAX_SIZE) throw Error("Invalid release asset");
  const signal=AbortSignal.timeout(10*60*1000);
  let url=asset.url, response;
  for(let redirects=0;redirects<=5;redirects++){
    response=await fetcher(url,{signal,redirect:"manual"});
    if(![301,302,303,307,308].includes(response.status))break;
    const next=response.headers.get("location");
    await response.body?.cancel();
    if(!next || !allowedRedirect(next))throw Error("Unexpected download location");
    url=next; response=null;
  }
  if(!response?.ok || !response.body)throw Error("Installer download failed");
  const root=await fsp.mkdtemp(path.join(directory,"playquill-update-"));
  const partial=path.join(root,asset.name+".part"), file=path.join(root,asset.name);
  let count=0;
  const hash=createHash("sha256");
  const meter=new Transform({transform(chunk,enc,done){
    count+=chunk.length;
    if(count>asset.size)return done(Error("Installer size mismatch"));
    hash.update(chunk);onProgress(Math.floor(count*100/asset.size));
    done(null,chunk);
  }});
  try {
    await pipeline(Readable.fromWeb(response.body),meter,fs.createWriteStream(partial,{flags:"wx"}),{signal});
    if(count!==asset.size || hash.digest("hex")!==asset.sha256)throw Error("Installer failed integrity verification");
    await fsp.rename(partial,file);
    // Mark internet-origin files so Windows can apply its normal security checks.
    if(process.platform==="win32") await fsp.writeFile(file+":Zone.Identifier","[ZoneTransfer]\r\nZoneId=3\r\nHostUrl="+asset.url+"\r\n");
    return {file,root,asset};
  } catch(error) {
    await fsp.rm(root,{recursive:true,force:true}).catch(()=>{});
    throw error;
  }
}
async function verifyStaged(staged) {
  const stat=await fsp.stat(staged.file);
  if(!stat.isFile() || stat.size!==staged.asset.size)return false;
  const hash=createHash("sha256");
  for await(const chunk of fs.createReadStream(staged.file))hash.update(chunk);
  return hash.digest("hex")===staged.asset.sha256;
}
module.exports={releaseAsset,latestRelease,downloadAsset,verifyStaged,allowedRedirect};
