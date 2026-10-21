import type { Category, Data, Membership } from "./data";

function ranked(members:Membership[],categoryId:string) {
  return members.filter(m=>m.categoryId===categoryId).sort((a,b)=>a.order-b.order);
}
export function moveGamePlacement(data:Data, sourceCategoryId:string, gameId:string,
  destCategoryId:string|null, beforeGameId?:string):Data {
  if(!data.games.some(g=>g.id===gameId)) return data;
  if(sourceCategoryId!=="library"&&!data.categories.some(c=>c.id===sourceCategoryId))return data;
  if(destCategoryId!==null&&!data.categories.some(c=>c.id===destCategoryId))return data;
  if(sourceCategoryId===destCategoryId&&gameId===beforeGameId)return data;
  const wasMember=sourceCategoryId!=="library"&&data.memberships.some(m=>m.categoryId===sourceCategoryId&&m.gameId===gameId);
  if(!wasMember && sourceCategoryId!=="library") return data;
  // All Games is the master: drop to Library removes only the source membership.
  const affected=new Set([sourceCategoryId,destCategoryId].filter((x):x is string=>!!x&&x!=="library"));
  let working=data.memberships.filter(m=>!(wasMember&&m.categoryId===sourceCategoryId&&m.gameId===gameId));
  if(destCategoryId!==null) {
    // Cross-category moves preserve memberships elsewhere.
    working=working.filter(m=>!(m.categoryId===destCategoryId&&m.gameId===gameId));
    const target=ranked(working,destCategoryId);
    const existingBefore=beforeGameId?target.findIndex(m=>m.gameId===beforeGameId):-1;
    const position=existingBefore<0?target.length:existingBefore;
    target.splice(position,0,{categoryId:destCategoryId,gameId,order:position});
    working=working.filter(m=>m.categoryId!==destCategoryId).concat(target);
  }
  // Normalize ranks only for changed categories; all other custom rankings remain intact.
  let next=working.filter(m=>!affected.has(m.categoryId));
  for(const cat of affected) {
    next=next.concat(ranked(working,cat).map((m,i)=>({...m,order:i})));
  }
  return {...data,memberships:next};
}
export function reorderCategories(data:Data,sourceCategoryId:string,beforeCategoryId:string):Data {
  const source=data.categories.find(c=>c.id===sourceCategoryId);
  const dest=data.categories.find(c=>c.id===beforeCategoryId);
  if(!source||!dest||source.location!==dest.location||source.id===dest.id)return data;
  const group=data.categories.filter(c=>c.location===source.location).sort((a,b)=>a.order-b.order);
  const moved=group.find(c=>c.id===source.id);
  if(!moved)return data;
  const rest=group.filter(c=>c.id!==source.id);
  const idx=rest.findIndex(c=>c.id===dest.id);
  rest.splice(idx,0,moved);
  const ranks=new Map(rest.map((c,i)=>[c.id,i]));
  return {...data,categories:data.categories.map(c=>ranks.has(c.id)?{...c,order:ranks.get(c.id)!}:c)};
}
export function placeCategory(data:Data,categoryId:string,location:string):Data {
  const category=data.categories.find(c=>c.id===categoryId);
  if(!category||category.location===location)return data;
  if(location!=="dashboard"&&!data.shelves.some(s=>s.id===location))return data;
  const order=data.categories.filter(c=>c.location===location).length;
  return {...data,categories:data.categories.map(c=>c.id===categoryId?{...c,location,order}:c)};
}
