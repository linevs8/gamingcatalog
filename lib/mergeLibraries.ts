import type { Data, Game, Category, Shelf, Membership, QuickLink, NotePage } from "./data";

/** Keep both copies while matching imported IGDB titles by provider identity.
 * Existing cloud data wins ID/metadata conflicts; local notes are preserved as
 * an additional page rather than silently overwritten. No mutation of inputs. */
export function combineLibraries(cloud:Data,guest:Data):Data {
  const out:Data=structuredClone(cloud);
  const seen = new Set([
    ...out.games.map(g=>g.id),...out.categories.map(c=>c.id),...out.shelves.map(s=>s.id)
  ]);
  const makeDistinct=(id:string) => {
    let next=id, i=1;
    while(seen.has(next)) next=id+"-import-"+i++;
    seen.add(next);
    return next;
  };
  const gameIds=new Map<string,string>(),categoryIds=new Map<string,string>(),shelfIds=new Map<string,string>();
  out.notePages ||= {}; out.noteTitles ||= {}; out.noteRevisions ||= {};
  for(const shelf of guest.shelves) {
    const match=out.shelves.find(s=>s.id===shelf.id&&s.name===shelf.name);
    const id=match?.id || makeDistinct(shelf.id);
    shelfIds.set(shelf.id,id);
    if(!match)out.shelves.push({...shelf,id,order:out.shelves.length});
  }
  for(const category of guest.categories) {
    const mappedLocation=category.location==="dashboard"?"dashboard":shelfIds.get(category.location)||"dashboard";
    const match=out.categories.find(c=>c.id===category.id&&c.name===category.name);
    const id=match?.id||makeDistinct(category.id);
    categoryIds.set(category.id,id);
    if(!match)out.categories.push({...category,id,location:mappedLocation,
      order:out.categories.filter(c=>c.location===mappedLocation).length});
  }
  for(const game of guest.games) {
    const match=out.games.find(g=>
      (game.provider==="igdb"&&g.provider==="igdb"&&g.providerId===game.providerId)||
      (g.id===game.id&&g.title===game.title));
    const id=match?.id || makeDistinct(game.id);
    gameIds.set(game.id,id);
    if(!match)out.games.push({...game,id});
    const incoming=guest.notes[game.id]||"";
    if(incoming){
      const already=out.notes[id]||"";
      if(!already)out.notes[id]=incoming;
      else if(already!==incoming) {
        const list=out.notePages[id]||[];
        if(!list.some(p=>p.title==="Imported notes"&&p.content===incoming)) {
          const page:NotePage={id:makeDistinct(game.id+"-imported-notes"),title:"Imported notes",
            content:incoming,order:list.length};
          out.notePages[id]=[...list,page];
        }
      }
    }
    if(guest.noteTitles?.[game.id]&&!out.noteTitles[id])out.noteTitles[id]=guest.noteTitles[game.id];
    const pages=guest.notePages?.[game.id]||[];
    const existingPages=out.notePages[id]||[];
    for(const page of pages) {
      if(!existingPages.some(p=>p.title===page.title&&p.content===page.content)) {
        existingPages.push({...page,id:makeDistinct(page.id),order:existingPages.length});
      }
    }
    out.notePages[id]=existingPages;
    for(const [key,revisions] of Object.entries(guest.noteRevisions||{})) {
      if(!key.startsWith(game.id+"/"))continue;
      const mapped=id+"/"+key.slice(game.id.length+1);
      out.noteRevisions[mapped]=[...(out.noteRevisions[mapped]||[]),...revisions]
        .filter((rev,i,arr)=>arr.findIndex(x=>x.id===rev.id)===i).slice(0,15);
    }
  }
  const memberKeys=new Set(out.memberships.map(m=>m.categoryId+"/"+m.gameId));
  for(const m of guest.memberships) {
    const cat=categoryIds.get(m.categoryId),game=gameIds.get(m.gameId);
    if(!cat||!game||memberKeys.has(cat+"/"+game))continue;
    const member:Membership={categoryId:cat,gameId:game,
      order:out.memberships.filter(x=>x.categoryId===cat).length};
    out.memberships.push(member);memberKeys.add(cat+"/"+game);
  }
  const linkSet=new Set(out.links.map(l=>l.gameId+"\n"+l.url));
  for(const link of guest.links) {
    const mapped=gameIds.get(link.gameId);
    if(!mapped||linkSet.has(mapped+"\n"+link.url))continue;
    const item:QuickLink={...link,id:makeDistinct(link.id),gameId:mapped,
      order:out.links.filter(l=>l.gameId===mapped).length};
    out.links.push(item);linkSet.add(mapped+"\n"+link.url);
  }
  return out;
}
