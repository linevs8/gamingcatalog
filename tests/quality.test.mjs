import test from "node:test";
import assert from "node:assert/strict";
import { libraryPage, removeLibraryGames } from "../lib/library.ts";
import { emptyData, validateImport, notePreview } from "../lib/data.ts";

const game = i => ({ id:"g"+i, title:"Game "+String(i).padStart(5,"0"), subtitle:"PC", coverUrl:"", createdAt:i });

test("library pagination scales to 1,200 games and preserves every identity", () => {
  const games=Array.from({length:1200},(_,i)=>game(i));
  let seen=[];
  for(let page=1;page<=15;page++){
    const result=libraryPage(games,"",page);
    assert.equal(result.visible.length,80);
    assert.equal(result.totalPages,15);
    seen.push(...result.visible.map(g=>g.id));
  }
  assert.equal(new Set(seen).size,1200);
  assert.deepEqual(libraryPage(games,"",999).visible.map(g=>g.id),seen.slice(-80));
});

test("library filter updates pagination and matches titles or platform", () => {
  const games=[game(1),{...game(2),title:"Elden Ring",subtitle:"PS5"}];
  assert.equal(libraryPage(games,"elden",1).visible[0].title,"Elden Ring");
  assert.equal(libraryPage(games,"ps5",1).visible.length,1);
  assert.equal(libraryPage(games,"zzz",1).totalPages,1);
  assert.equal(libraryPage(games,"zzz",1).visible.length,0);
});

test("bulk deletion preserves unrelated memberships, notes and recovery pages", () => {
  const before=emptyData();
  before.games=[game(1),game(2),game(3)];
  before.notes={g1:"one",g2:"two",g3:"three"};
  before.noteTitles={g1:"first",g2:"second"};
  before.notePages={g1:[{id:"p1",title:"page",content:"old",order:0}],g2:[{id:"p2",title:"other",content:"keep",order:0}]};
  before.noteRevisions={"g1/current":[{id:"v1",content:"old",createdAt:1}],"g2/current":[{id:"v2",content:"keep",createdAt:1}]};
  before.deletedNotePages={g1:[{id:"z1",title:"old",content:"deleted",order:0,deletedAt:2}]};
  before.memberships=[{gameId:"g1",categoryId:"c",order:0},{gameId:"g2",categoryId:"c",order:1}];
  before.links=[{id:"l1",gameId:"g1",title:"Guide",url:"https://example.com",order:0},
                {id:"l2",gameId:"g2",title:"Guide",url:"https://example.com",order:0}];
  const after=removeLibraryGames(before,new Set(["g1","unknown"]));
  assert.deepEqual(after.games.map(g=>g.id),["g2","g3"]);
  assert.equal(after.notes.g2,"two");
  assert.equal(after.notes.g3,"three");
  assert.equal(after.notePages.g2[0].content,"keep");
  assert.equal(after.noteRevisions["g2/current"][0].content,"keep");
  assert.equal(after.notePages.g1,undefined);
  assert.equal(after.noteRevisions["g1/current"],undefined);
  assert.deepEqual(after.links.map(l=>l.id),["l2"]);
  assert.deepEqual(after.memberships.map(m=>m.gameId),["g2"]);
  assert.equal(before.notes.g1,"one");
  assert.equal(before.notePages.g1.length,1);
});

test("unknown bulk deletion IDs cannot remove another game's content", () => {
  const d=emptyData();d.games=[game(1)];d.notes.g1="saved";
  assert.equal(removeLibraryGames(d,new Set(["not-here"])),d);
});

test("portable local and cloud backups validate on large libraries", () => {
  const d=emptyData();d.games=Array.from({length:1200},(_,i)=>game(i));
  d.notes.g100="Keep this memory";
  const result=validateImport(JSON.parse(JSON.stringify(d)));
  assert.equal(result.games.length,1200);
  assert.equal(result.notes.g100,"Keep this memory");
});

test("notebook previews handle legacy text and rich HTML", () => {
  assert.equal(notePreview("first line\nsecond line"),"first line");
  assert.equal(notePreview("rhq:<p>Hello <strong>there</strong></p>"),"Hello there");
});
