import test from "node:test";
import assert from "node:assert/strict";
import { moveGamePlacement, reorderCategories, placeCategory } from "../lib/organization.ts";

const create = () => ({
  version: 1,
  games: [
    {id:"g1",title:"Warframe",subtitle:"",coverUrl:"",createdAt:1},
    {id:"g2",title:"Kingdom Hearts",subtitle:"",coverUrl:"",createdAt:2},
    {id:"g3",title:"Stellar Blade",subtitle:"",coverUrl:"",createdAt:3}
  ],
  categories: [
    {id:"priority",name:"Priority",color:"#77A9F7",icon:"star",location:"dashboard",order:0,view:"gallery"},
    {id:"solo",name:"Solo",color:"#77A9F7",icon:"star",location:"dashboard",order:1,view:"gallery"},
    {id:"finished",name:"Finished",color:"#77A9F7",icon:"star",location:"backlog",order:0,view:"gallery"}
  ],
  shelves:[{id:"backlog",name:"Backlog",order:0}],
  memberships:[
    {categoryId:"priority",gameId:"g1",order:0},
    {categoryId:"priority",gameId:"g2",order:1},
    {categoryId:"priority",gameId:"g3",order:2},
    {categoryId:"solo",gameId:"g1",order:0},
    {categoryId:"solo",gameId:"g3",order:1}
  ],
  notes:{g1:"I love this build."},links:[],notePages:{},noteTitles:{}
});
const ids=(d,c)=>d.memberships.filter(m=>m.categoryId===c).sort((a,b)=>a.order-b.order).map(m=>m.gameId);
test("moving a game across categories removes only its source placement",()=>{
  const d=create(), after=moveGamePlacement(d,"priority","g1","finished");
  assert.deepEqual(ids(after,"priority"),["g2","g3"]);
  assert.deepEqual(ids(after,"solo"),["g1","g3"]);
  assert.deepEqual(ids(after,"finished"),["g1"]);
  assert.equal(after.games.length,3);
  assert.equal(after.notes.g1,"I love this build.");
  assert.equal(ids(d,"priority")[0],"g1","original snapshot remains unchanged");
});
test("dropping into Library removes one placement without deleting game",()=>{
  const after=moveGamePlacement(create(),"priority","g1",null);
  assert.deepEqual(ids(after,"priority"),["g2","g3"]);
  assert.deepEqual(ids(after,"solo"),["g1","g3"]);
  assert.equal(after.games.find(x=>x.id==="g1").title,"Warframe");
});
test("reorder preserves separate category rankings",()=>{
  const after=moveGamePlacement(create(),"priority","g3","priority","g1");
  assert.deepEqual(ids(after,"priority"),["g3","g1","g2"]);
  assert.deepEqual(ids(after,"solo"),["g1","g3"]);
});
test("dragging a library game to a category adds a placement",()=>{
  const after=moveGamePlacement(create(),"library","g2","solo");
  assert.deepEqual(ids(after,"solo"),["g1","g3","g2"]);
  assert.deepEqual(ids(after,"priority"),["g1","g2","g3"]);
});
test("moving into an existing category does not duplicate memberships",()=>{
  const after=moveGamePlacement(create(),"priority","g1","solo","g3");
  assert.deepEqual(ids(after,"solo"),["g1","g3"]);
  assert.equal(after.memberships.filter(x=>x.categoryId==="solo"&&x.gameId==="g1").length,1);
});
test("reordering categories cannot accidentally nest or cross shelves",()=>{
  const data=create();
  const after=reorderCategories(data,"solo","priority");
  assert.deepEqual(after.categories.filter(x=>x.location==="dashboard").sort((a,b)=>a.order-b.order).map(x=>x.id),["solo","priority"]);
  assert.equal(reorderCategories(data,"solo","finished"),data);
});
test("moving category to shelf preserves game memberships and notes",()=>{
  const data=create(), after=placeCategory(data,"priority","backlog");
  assert.equal(after.categories.find(c=>c.id==="priority").location,"backlog");
  assert.deepEqual(ids(after,"priority"),ids(data,"priority"));
  assert.deepEqual(after.notes,data.notes);
});
test("invalid drag targets do nothing",()=>{
  const data=create();
  assert.equal(moveGamePlacement(data,"priority","missing","solo"),data);
  assert.equal(moveGamePlacement(data,"priority","g1","not-there"),data);
  assert.equal(placeCategory(data,"solo","unknown-shelf"),data);
});
