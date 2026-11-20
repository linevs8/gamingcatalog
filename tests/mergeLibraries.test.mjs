import test from "node:test";
import assert from "node:assert/strict";
import { combineLibraries } from "../lib/mergeLibraries.ts";

function blank(){
  return {version:1,games:[],categories:[],shelves:[],memberships:[],notes:{},noteTitles:{},notePages:{},noteRevisions:{},links:[],theme:"midnight"};
}
test("combining preserves unique games, categories and notes",()=>{
  const cloud=blank();cloud.games=[{id:"a",title:"Kingdom Hearts",subtitle:"",coverUrl:"",createdAt:1}];
  cloud.notes={a:"Cloud note"};
  const guest=blank();guest.games=[{id:"b",title:"Warframe",subtitle:"",coverUrl:"",createdAt:2}];
  guest.categories=[{id:"c",name:"Priority",color:"blue",icon:"star",location:"dashboard",order:0,view:"gallery"}];
  guest.memberships=[{categoryId:"c",gameId:"b",order:0}];guest.notes={b:"Guest note"};
  const merged=combineLibraries(cloud,guest);
  assert.equal(merged.games.length,2);
  assert.equal(merged.categories.length,1);
  assert.equal(merged.memberships.length,1);
  assert.equal(merged.notes.b,"Guest note");
  assert.equal(merged.notes.a,"Cloud note");
  assert.equal(cloud.games.length,1);
});
test("IGDB duplicates combine without losing conflicting local notes",()=>{
  const cloud=blank();cloud.games=[{id:"cloud-game",provider:"igdb",providerId:234,title:"Warframe",subtitle:"",coverUrl:"",createdAt:1}];
  cloud.notes={"cloud-game":"Cloud notes"};
  const guest=blank();guest.games=[{id:"guest-game",provider:"igdb",providerId:234,title:"Warframe",subtitle:"",coverUrl:"",createdAt:2}];
  guest.notes={"guest-game":"Local notes"};
  guest.categories=[{id:"c",name:"Solo",location:"dashboard",order:0,color:"blue",icon:"star",view:"gallery"}];
  guest.memberships=[{categoryId:"c",gameId:"guest-game",order:0}];
  const merged=combineLibraries(cloud,guest);
  assert.equal(merged.games.length,1);
  assert.equal(merged.notes["cloud-game"],"Cloud notes");
  assert.equal(merged.notePages["cloud-game"][0].content,"Local notes");
  assert.equal(merged.memberships[0].gameId,"cloud-game");
});
test("identical game IDs but different titles are not overwritten",()=>{
  const cloud=blank();cloud.games=[{id:"g",title:"Elden Ring",subtitle:"",coverUrl:"",createdAt:1}];
  const guest=blank();guest.games=[{id:"g",title:"Hollow Knight",subtitle:"",coverUrl:"",createdAt:2}];
  const merged=combineLibraries(cloud,guest);
  assert.equal(merged.games.length,2);
  assert.notEqual(merged.games[0].id,merged.games[1].id);
});
test("repeated merge does not duplicate provider titles or notes",()=>{
  const cloud=blank();cloud.games=[{id:"one",provider:"igdb",providerId:3,title:"FFX",subtitle:"",coverUrl:"",createdAt:1}];
  cloud.notes={one:"cloud"};
  const guest=blank();guest.games=[{id:"two",provider:"igdb",providerId:3,title:"FFX",subtitle:"",coverUrl:"",createdAt:1}];
  guest.notes={two:"guest"};
  const once=combineLibraries(cloud,guest), twice=combineLibraries(once,guest);
  assert.equal(twice.games.length,1);
  assert.equal(twice.notePages.one.filter(p=>p.content==="guest").length,1);
});
