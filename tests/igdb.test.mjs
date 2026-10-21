import test from "node:test";
import assert from "node:assert/strict";
import { safeSearchQuery, buildGamesQuery, mapIgdbGame } from "../lib/igdb.ts";

test("search query trims whitespace and enforces reasonable lengths",()=>{
  assert.equal(safeSearchQuery("   Kingdom   Hearts  "),"Kingdom Hearts");
  assert.equal(safeSearchQuery("x"),null);
  assert.equal(safeSearchQuery("x".repeat(81)),null);
});
test("APICalypse query escapes quote and backslash injection",()=>{
  const query=buildGamesQuery('Halo"; fields *; search "Mario\\');
  assert.equal(query,'search "Halo\\"; fields *; search \\"Mario\\\\"; fields id,name,cover.image_id,first_release_date,platforms.name; limit 20;');
  assert.equal(query.match(/limit 20;/g)?.length,1);
});
test("game mapping includes correct cover art, title and platform/year",()=>{
  const item=mapIgdbGame({id:123,name:"  Final Fantasy X  ",
    cover:{image_id:"co123a"},first_release_date:1000000000,platforms:[{name:"PS2"},{name:"Windows"}]});
  assert.deepEqual(item,{
    provider:"igdb",providerId:123,title:"Final Fantasy X",
    coverUrl:"https://images.igdb.com/igdb/image/upload/t_cover_big/co123a.jpg",
    releaseYear:2001,platforms:["PS2","Windows"],subtitle:"2001 · PS2, Windows"
  });
});
test("missing cover and platform data yield safe defaults",()=>{
  assert.deepEqual(mapIgdbGame({id:31,name:"Untitled",cover:null,platforms:null}),{
    provider:"igdb",providerId:31,title:"Untitled",coverUrl:"",
    releaseYear:null,platforms:[],subtitle:""
  });
});
test("malformed items and unsafe cover identifiers are rejected",()=>{
  assert.equal(mapIgdbGame({id:0,name:"X"}),null);
  assert.equal(mapIgdbGame({id:12,name:" "}),null);
  const item=mapIgdbGame({id:16,name:"X",cover:{image_id:"../secret"}});
  assert.equal(item?.coverUrl,"");
});
