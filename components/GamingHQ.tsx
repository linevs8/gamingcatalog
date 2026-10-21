"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import RichNotes from "@/components/RichNotes";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { SortableItem, DragItem, DropTarget } from "@/components/DragItems";
import type { DragInfo, TargetInfo } from "@/components/DragItems";
import { moveGamePlacement, reorderCategories, placeCategory } from "@/lib/organization";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check,
  ChevronDown, ChevronRight, Cloud, CloudOff, ExternalLink, Gamepad2,
  GripVertical, LayoutDashboard, Library, Link2, List, Menu, MoreHorizontal,
  Plus, Search, Settings2, Sparkles, Star, Trash2, X, PanelLeftClose, Pencil,
  Swords, Trophy, Heart, Users, Flame, Target, Bookmark, MonitorPlay,
  Crown, Clock3, Compass, Puzzle, Zap, CalendarDays, FolderOpen, Shield, Coffee
} from "lucide-react";
import {
  type Category, type Data, type Game, type QuickLink, emptyData,
  loadData, makeId, notePreview, saveData, validCover, validateImport, type ThemeName
} from "@/lib/data";

type Modal = null | { type: "game" | "category" | "shelf" | "link" | "organize" | "pick-library" | "edit-game" | "edit-link"; gameId?: string; categoryId?: string; linkId?: string };
const colors = ["#77A9F7", "#B39BFA", "#70C8BE", "#E8B878", "#F29BAD", "#96B6D1"];
const icons = [
  "star", "gamepad", "book", "sparkle", "swords", "trophy",
  "heart", "users", "flame", "target", "bookmark", "monitor",
  "crown", "clock", "compass", "puzzle", "zap", "calendar",
  "folder", "shield", "coffee"
];

const categoryIcons = {
  star: Star, gamepad: Gamepad2, book: BookOpen, sparkle: Sparkles,
  swords: Swords, trophy: Trophy, heart: Heart, users: Users,
  flame: Flame, target: Target, bookmark: Bookmark, monitor: MonitorPlay,
  crown: Crown, clock: Clock3, compass: Compass, puzzle: Puzzle,
  zap: Zap, calendar: CalendarDays, folder: FolderOpen, shield: Shield, coffee: Coffee
};
function LabelIcon({ name, size = 17 }: { name: string; size?: number }) {
  const IconComponent = categoryIcons[name as keyof typeof categoryIcons] || Gamepad2;
  return <IconComponent size={size}/>;
}
function Cover({ game, className = "" }: { game?: Game; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [game?.coverUrl]);
  return (
    <div className={"cover " + className}>
      {game?.coverUrl && !broken ? (
        // User-supplied covers cannot use next/image optimization without domain allowlists.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={game.coverUrl} alt={game.title + " cover"} loading="lazy" onError={() => setBroken(true)}/>
      ) : (
        <div className="cover-placeholder">
          <Gamepad2 size={25} strokeWidth={1.4}/>
          <span>{game?.title || "No cover"}</span>
        </div>
      )}
    </div>
  );
}

export default function GamingHQ() {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<Data>(() => emptyData());
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">("saved");
  const latestRevision = useRef(0);
  const [modal, setModal] = useState<Modal>(null);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [targetCategory, setTargetCategory] = useState("");
  const [categoryColor, setCategoryColor] = useState(colors[0]);
  const [categoryIcon, setCategoryIcon] = useState(icons[0]);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const expandSidebar = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openCategoryMenu, setOpenCategoryMenu] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [libraryView, setLibraryView] = useState<"gallery" | "list">("gallery");
  const [pickerQuery, setPickerQuery] = useState("");
  const [noteSelection,setNoteSelection] = useState<Record<string,string>>({});
  const [showHistory,setShowHistory]=useState<Record<string,boolean>>({});
  const [noteRefresh,setNoteRefresh]=useState<Record<string,number>>({});
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [showPreferences,setShowPreferences] = useState(false);
  const [backupMessage,setBackupMessage] = useState("");
  const sensors=useSensors(
    useSensor(PointerSensor,{activationConstraint:{delay:240,tolerance:6}}),
    useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates})
  );
  const [dragging,setDragging]=useState<DragInfo|null>(null);
  const [undoData,setUndoData]=useState<Data|null>(null);
  const [undoLabel,setUndoLabel]=useState("");
  useEffect(()=>{
    if(!undoData)return;
    const timeout=window.setTimeout(()=>setUndoData(null),7000);
    return ()=>window.clearTimeout(timeout);
  },[undoData]);
  const [editingNoteTitle, setEditingNoteTitle] = useState<string | null>(null);
  const [noteTitleDraft, setNoteTitleDraft] = useState("");
  const cancelNoteTitleSave = useRef(false);

  const startEditingNoteTitle = (gameId: string) => {
    cancelNoteTitleSave.current = false;
    setNoteTitleDraft(data.noteTitles?.[gameId] || "Where I left off");
    setEditingNoteTitle(gameId);
  };
  const commitNoteTitle = (gameId: string) => {
    if (cancelNoteTitleSave.current) {
      cancelNoteTitleSave.current = false;
      return;
    }
    const title = noteTitleDraft.trim().slice(0, 80);
    setData(previous => {
      const noteTitles = { ...(previous.noteTitles || {}) };
      if (title) noteTitles[gameId] = title;
      else delete noteTitles[gameId];
      return { ...previous, noteTitles };
    });
    setEditingNoteTitle(null);
  };
  const discardNoteTitleEdit = () => {
    cancelNoteTitleSave.current = true;
    setEditingNoteTitle(null);
  };

  useEffect(() => {
    let live = true;
    loadData().then(value => { if (live) { setData(value); setReady(true); } })
      .catch(() => { if (live) { setReady(true); setSaveStatus("error"); } });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const rev = ++latestRevision.current;
    setSaveStatus("saving");
    const timeout = window.setTimeout(() => {
      saveData(data).then(() => {
        if (latestRevision.current === rev) setSaveStatus("saved");
      }).catch(() => {
        if (latestRevision.current === rev) setSaveStatus("error");
      });
    }, 320);
    return () => window.clearTimeout(timeout);
  }, [data, ready]);

  const change = (fn: (prev: Data) => Data) => setData(prev => fn(prev));
  const go = (href: string) => { setMobileMenu(false); router.push(href); };
  const parts = pathname.split("/").filter(Boolean);
  const section = parts[0] || "dashboard";
  const currentId = parts[1] || "";
  const currentCategory = data.categories.find(x => x.id === currentId);
  const currentGame = data.games.find(x => x.id === currentId);
  const dashboardCategories = useMemo(
    () => data.categories.filter(c => c.location === "dashboard").sort((a,b) => a.order-b.order),
    [data.categories]
  );
  const shelfCategories = (id: string) => data.categories.filter(c => c.location === id).sort((a,b) => a.order-b.order);
  const gamesIn = (categoryId: string) => data.memberships.filter(m => m.categoryId === categoryId)
    .sort((a,b) => a.order-b.order)
    .map(m => data.games.find(g => g.id === m.gameId))
    .filter((g): g is Game => Boolean(g));
  const membershipsFor = (id: string) => data.memberships.filter(m => m.gameId === id);
  const openModal = (type: NonNullable<Modal>["type"], gameId?: string, categoryId?: string, linkId?:string) => {
    const existingGame=data.games.find(g=>g.id===gameId);
    const existingLink=data.links.find(l=>l.id===linkId);
    setName(type==="edit-game" ? existingGame?.title||"" : "");
    setSubtitle(type==="edit-game" ? existingGame?.subtitle||"" : "");
    setCoverUrl(type==="edit-game" ? existingGame?.coverUrl||"" : "");
    setLinkUrl(type==="edit-link" ? existingLink?.url||"" : "");
    setLinkName(type==="edit-link" ? existingLink?.title||"" : "");
    setTargetCategory(type === "game" ? categoryId || "" : "");
    setPickerQuery("");
    setCategoryColor(colors[0]); setCategoryIcon(icons[0]);
    setError(""); setModal({ type, gameId, categoryId,linkId });
  };
  const saveEditedGame=()=>{
    if(!modal?.gameId) return;
    if(!name.trim()){setError("Enter a game title.");return;}
    if(!validCover(coverUrl.trim())){setError("Cover must be a valid http(s) URL.");return;}
    change(d=>({...d,games:d.games.map(g=>g.id===modal.gameId?
      {...g,title:name.trim(),subtitle:subtitle.trim(),coverUrl:coverUrl.trim()}:g)}));
    setModal(null);
  };
  const addGame = () => {
    const title = name.trim();
    if (!title) { setError("Enter a game title."); return; }
    if (!validCover(coverUrl.trim())) { setError("Cover must be a valid http(s) URL."); return; }
    const game: Game = { id: makeId(), title, subtitle: subtitle.trim(), coverUrl: coverUrl.trim(), createdAt: Date.now() };
    change(d => ({
      ...d, games: [...d.games, game],
      memberships: targetCategory ? [...d.memberships, {
        categoryId: targetCategory, gameId: game.id,
        order: d.memberships.filter(m => m.categoryId === targetCategory).length
      }] : d.memberships
    }));
    setModal(null);
  };
  const addCategory = () => {
    if (!name.trim()) { setError("Name your category."); return; }
    const location = targetCategory || "dashboard";
    const same = data.categories.filter(x => x.location === location);
    const c: Category = { id: makeId(), name: name.trim(), color: categoryColor,
      icon: categoryIcon, location, order: same.length, view: "gallery" };
    change(d => ({ ...d, categories: [...d.categories, c] }));
    setModal(null);
    go("/category/" + c.id);
  };
  const renameShelf=(shelfId:string,current:string)=>{
    const next=window.prompt("Rename shelf:",current)?.trim().slice(0,70);
    if(!next)return;
    change(d=>({...d,shelves:d.shelves.map(s=>s.id===shelfId?{...s,name:next}:s)}));
  };
  const deleteShelf=(shelfId:string)=>{
    if(!window.confirm("Delete this shelf? Its categories will return to your Dashboard, with all games and notes preserved."))return;
    change(d=>{
      const others=d.categories.filter(c=>c.location==="dashboard").length;
      let offset=0;
      return {...d,shelves:d.shelves.filter(s=>s.id!==shelfId),
        categories:d.categories.map(c=>c.location===shelfId?{...c,location:"dashboard",order:others+(offset++)}:c)};
    });
  };
  const addShelf = () => {
    if (!name.trim()) { setError("Name your shelf."); return; }
    change(d => ({ ...d, shelves: [...d.shelves, { id: makeId(), name: name.trim(), order: d.shelves.length }] }));
    setModal(null);
  };
  const saveEditedLink=()=>{
    if(!modal?.linkId) return;
    try{
      const uri=new URL(linkUrl.trim());
      if(!["http:","https:"].includes(uri.protocol))throw new Error();
      change(d=>({...d,links:d.links.map(l=>l.id===modal.linkId?
        {...l,url:uri.toString(),title:linkName.trim()||uri.hostname}:l)}));
      setModal(null);
    }catch {setError("Enter a valid http(s) URL.");}
  };
  const addLink = () => {
    if (!modal?.gameId) return;
    let url = linkUrl.trim();
    try {
      const parsed = new URL(url);
      if (!["http:","https:"].includes(parsed.protocol)) throw new Error();
      url = parsed.toString();
    } catch { setError("Enter a valid https:// or http:// link."); return; }
    const link: QuickLink = { id: makeId(), gameId: modal.gameId,
      title: linkName.trim() || new URL(url).hostname, url,
      order: data.links.filter(l => l.gameId === modal.gameId).length };
    change(d => ({ ...d, links: [...d.links, link] }));
    setModal(null);
  };
  const toggleMembership = (gameId: string, categoryId: string, checked: boolean) => {
    change(d => {
      const exists = d.memberships.some(m => m.gameId === gameId && m.categoryId === categoryId);
      if (checked && !exists) return { ...d, memberships: [...d.memberships, { gameId, categoryId,
        order: d.memberships.filter(m => m.categoryId === categoryId).length }] };
      if (!checked && exists) return { ...d, memberships: d.memberships.filter(m => !(m.gameId === gameId && m.categoryId === categoryId)) };
      return d;
    });
  };
  const setCategory = (id: string, fields: Partial<Category>) => {
    change(d => ({ ...d, categories: d.categories.map(c => c.id === id ? {...c, ...fields} : c) }));
  };
  const moveCategory = (category: Category, step: number) => {
    change(d => {
      const set = d.categories.filter(c => c.location === category.location).sort((a,b)=>a.order-b.order);
      const at = set.findIndex(c=>c.id===category.id), to = at+step;
      if (at<0 || to<0 || to>=set.length) return d;
      [set[at],set[to]]=[set[to],set[at]];
      return { ...d, categories: d.categories.map(c => {
        const pos=set.findIndex(x=>x.id===c.id); return pos>=0?{...c,order:pos}:c;
      }) };
    });
  };
  const moveGame = (categoryId: string, gameId: string, step: number) => {
    change(d => {
      const set=d.memberships.filter(m=>m.categoryId===categoryId).sort((a,b)=>a.order-b.order);
      const at=set.findIndex(m=>m.gameId===gameId), to=at+step;
      if(at<0||to<0||to>=set.length)return d;
      [set[at],set[to]]=[set[to],set[at]];
      return {...d,memberships:d.memberships.map(m=>{
        const pos=set.findIndex(x=>x.gameId===m.gameId && x.categoryId===m.categoryId);
        return pos>=0?{...m,order:pos}:m;
      })};
    });
  };
  const removeCategory = (id: string) => {
    if (!window.confirm("Delete this category? The games and their notes will stay in your Library.")) return;
    change(d => ({ ...d, categories:d.categories.filter(c=>c.id!==id),
      memberships:d.memberships.filter(m=>m.categoryId!==id) }));
    setOpenCategoryMenu(false);
    go("/");
  };
  const snapshotNote=(gameId:string,pageId:string)=>{
    change(d=>{
      const key=gameId+"/"+pageId;
      const content=pageId==="current"?(d.notes[gameId]||""):
        (d.notePages?.[gameId]||[]).find(p=>p.id===pageId)?.content||"";
      if(!content)return d;
      const prior=d.noteRevisions?.[key]||[];
      if(prior[0]?.content===content)return d;
      return {...d,noteRevisions:{...(d.noteRevisions||{}),[key]:
        [{id:makeId(),content,createdAt:Date.now()},...prior].slice(0,15)}};
    });
  };
  const restoreNote=(gameId:string,pageId:string,content:string)=>{
    if(!window.confirm("Restore this earlier note? Your current content will be saved as a checkpoint first."))return;
    change(d=>{
      const key=gameId+"/"+pageId;
      const current=pageId==="current"?(d.notes[gameId]||""):
        (d.notePages?.[gameId]||[]).find(p=>p.id===pageId)?.content||"";
      const revisions=d.noteRevisions?.[key]||[];
      const next={...d,noteRevisions:{...(d.noteRevisions||{}),
        [key]:current?[{id:makeId(),content:current,createdAt:Date.now()},...revisions].slice(0,15):revisions}};
      if(pageId==="current")return {...next,notes:{...d.notes,[gameId]:content}};
      return {...next,notePages:{...(d.notePages||{}),[gameId]:(d.notePages?.[gameId]||[])
        .map(p=>p.id===pageId?{...p,content}:p)}};
    });
    const key=gameId+"/"+pageId;
    setNoteRefresh(p=>({...p,[key]:(p[key]||0)+1}));
  };
  const addNotePage = (gameId: string) => {
    const name = window.prompt("Name your new notes page:", "New page")?.trim();
    if (!name) return;
    const id = makeId();
    change(d => ({...d, notePages: {...(d.notePages||{}),
      [gameId]: [...(d.notePages?.[gameId]||[]), {id,title:name.slice(0,80),content:"",order:(d.notePages?.[gameId]||[]).length}]
    }}));
    setNoteSelection(p=>({...p,[gameId]:id}));
  };
  const deleteNotePage = (gameId: string,pageId: string) => {
    if (!window.confirm("Delete this notes page and its contents? The main notes page won't be affected.")) return;
    change(d=>({...d,notePages:{...(d.notePages||{}),[gameId]:(d.notePages?.[gameId]||[]).filter(p=>p.id!==pageId)}}));
    setNoteSelection(p=>({...p,[gameId]:"current"}));
  };
  const renameNotePage = (gameId:string,pageId:string,currentName:string) => {
    const name=window.prompt("Rename notes page:",currentName)?.trim().slice(0,80);
    if (!name) return;
    change(d=>({...d,notePages:{...(d.notePages||{}),[gameId]:(d.notePages?.[gameId]||[]).map(p=>p.id===pageId?{...p,title:name}:p)}}));
  };
  const exportBackup = () => {
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="gaming-hq-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),2000);
    setBackupMessage("Backup downloaded. Keep it somewhere safe.");
  };
  const importBackup = async (file: File) => {
    try {
      if (file.size > 25_000_000) throw new Error("Backup file is too large.");
      const imported=validateImport(JSON.parse(await file.text()));
      if (!window.confirm("REPLACE this browser's Gaming HQ library with the imported backup? Export your current library first. This cannot be undone.")) return;
      await saveData(imported);
      setData(imported);
      setBackupMessage("Backup imported successfully.");
      go("/");
    } catch(e) {
      setBackupMessage(e instanceof Error?e.message:"Couldn't import that backup.");
    } finally { if(backupInputRef.current)backupInputRef.current.value=""; }
  };
  const handleDragStart=(event:DragStartEvent)=>{
    setDragging((event.active.data.current as DragInfo|undefined)||null);
  };
  const handleDragEnd=(event:DragEndEvent)=>{
    setDragging(null);
    const from=event.active.data.current as DragInfo|undefined;
    const to=event.over?.data.current as TargetInfo|undefined;
    if(!from||!to) return;
    let next=data; let description="";
    if(from.kind==="game") {
      if(to.kind==="game") {
        if(from.categoryId==="library"&&to.categoryId==="library")return;
        next=moveGamePlacement(data,from.categoryId,from.gameId,
          to.categoryId==="library"?null:to.categoryId,to.gameId);
        description="Game moved";
      } else if(to.kind==="category-target" || to.kind==="category") {
        next=moveGamePlacement(data,from.categoryId,from.gameId,to.categoryId);
        description="Game moved into category";
      } else if(to.kind==="library-target") {
        next=moveGamePlacement(data,from.categoryId,from.gameId,null);
        description="Game removed from category";
      }
    } else if(from.kind==="category") {
      if(to.kind==="category" || to.kind==="category-target") {
        next=reorderCategories(data,from.categoryId,to.categoryId);
        description="Categories reordered";
      } else if(to.kind==="shelf-target") {
        next=placeCategory(data,from.categoryId,to.shelfId);
        description="Category moved to shelf";
      } else if(to.kind==="dashboard-target") {
        next=placeCategory(data,from.categoryId,"dashboard");
        description="Category moved to Dashboard";
      }
    }
    if(next!==data){
      setUndoData(data);
      setUndoLabel(description);
      setData(next);
    }
  };
  const removeGame = (id: string) => {
    if (!window.confirm("Remove this game from your Library? Its notes and links will be deleted. This cannot be undone.")) return;
    change(d => {
      const notes={...d.notes}; delete notes[id];
      const noteTitles={...(d.noteTitles||{})}; delete noteTitles[id];
      const notePages={...(d.notePages||{})}; delete notePages[id];
      const noteRevisions={...(d.noteRevisions||{})};
      for(const key of Object.keys(noteRevisions)) if(key.startsWith(id+"/"))delete noteRevisions[key];
      return {...d, noteRevisions, games:d.games.filter(g=>g.id!==id), memberships:d.memberships.filter(m=>m.gameId!==id),
        links:d.links.filter(l=>l.gameId!==id), notes, noteTitles,notePages};
    });
    setModal(null);
    go("/library");
  };

  function CategoryRow({ category, index, length }: { category: Category; index: number; length: number }) {
    return (
      <div className="side-category">
        <DropTarget id={"target-category/"+category.id} data={{kind:"category-target",categoryId:category.id}}>
          <button className={"side-category-label " + (currentId===category.id?"active":"")}
            onClick={()=>go("/category/"+category.id)} title={category.name}>
            <span style={{color:category.color}}><LabelIcon name={category.icon} size={16}/></span>
            <span className="truncate">{category.name}</span>
          </button>
        </DropTarget>
        <button className="side-disclose" aria-label={"Show games in "+category.name}
          aria-expanded={expanded===category.id}
          onClick={()=>setExpanded(v=>v===category.id?null:category.id)}>
          {expanded===category.id?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
        </button>
        {expanded===category.id && <div className="side-sublist">
          <SortableContext items={gamesIn(category.id).map(g=>"side-game/"+category.id+"/"+g.id)}
            strategy={verticalListSortingStrategy}>
          {gamesIn(category.id).map((g,i)=><SortableItem
            id={"side-game/"+category.id+"/"+g.id} key={g.id}
            data={{kind:"game",categoryId:category.id,gameId:g.id}}>
            <div className="side-game">
            <button onClick={()=>go("/game/"+g.id)} className="truncate" title={g.title}>{g.title}</button>
            <span className="side-controls">
              <button aria-label={"Move "+g.title+" up"} disabled={i===0} onClick={()=>moveGame(category.id,g.id,-1)}><ArrowUp size={13}/></button>
              <button aria-label={"Move "+g.title+" down"} disabled={i===gamesIn(category.id).length-1} onClick={()=>moveGame(category.id,g.id,1)}><ArrowDown size={13}/></button>
            </span>
            </div>
          </SortableItem>)}
          </SortableContext>
          {!gamesIn(category.id).length&&<div className="muted small pad-small">No games yet</div>}
          <div className="side-move">
            <button title="Move category up" disabled={index===0} onClick={()=>moveCategory(category,-1)}><ArrowUp size={13}/> Category</button>
            <button title="Move category down" disabled={index===length-1} onClick={()=>moveCategory(category,1)}><ArrowDown size={13}/></button>
          </div>
        </div>}
      </div>
    );
  }

  function GameCard({ game, list = false, organize = false }: { game: Game; list?: boolean; organize?: boolean }) {
    return <div className={list?"game-row":"game-tile"}>
      <Link className={list?"game-row-link":"game-tile-link"} href={"/game/"+game.id}>
        <Cover game={game}/>
        <div className="game-tile-copy">
          <strong title={game.title}>{game.title}</strong>
          {list&&<p>{notePreview(data.notes[game.id] || "")}</p>}
          {!list&&game.subtitle&&<span>{game.subtitle}</span>}
        </div>
      </Link>
      {organize&&<button className="tile-menu icon-button" title={"Organize "+game.title}
        aria-label={"Organize "+game.title} onClick={()=>openModal("organize",game.id)}><MoreHorizontal size={18}/></button>}
    </div>;
  }

  function Dashboard() {
    return <div className="screen">
      <div className="page-top"><div><div className="eyebrow">YOUR SPACE</div><h1>Dashboard<span className="dot">.</span></h1>
        <p className="subline">Your games, organized your way.</p></div>
        <button className="primary" onClick={()=>openModal("category")}><Plus size={17}/> New category</button>
      </div>
      {!dashboardCategories.length ? <div className="blank-state">
        <div className="blank-symbol"><LayoutDashboard size={35}/></div>
        <h2>Make yourself at home.</h2>
        <p>Start with a category that makes sense to you. Priority, Story Games, Dailies — or something completely different.</p>
        <button className="primary" onClick={()=>openModal("category")}><Plus size={17}/> Create your first category</button>
        <div className="muted small">Or <Link href="/library">add a game to your Library</Link> first.</div>
      </div> :
      <SortableContext items={dashboardCategories.map(c=>"category/"+c.id)} strategy={rectSortingStrategy}>
      <div className="category-grid">{dashboardCategories.map(c=>{
        const games=gamesIn(c.id), top=games.slice(0,4);
        return <SortableItem id={"category/"+c.id} data={{kind:"category",categoryId:c.id}} key={c.id}>
          <Link className="category-preview" href={"/category/"+c.id} style={{"--category-accent":c.color} as React.CSSProperties}>
          <div className="category-head">
            <span className="category-icon" style={{color:c.color,background:c.color+"18"}}><LabelIcon name={c.icon}/></span>
            <div><h2>{c.name}</h2><div className="muted small">{games.length} {games.length===1?"game":"games"}</div></div>
            <ArrowRight className="category-arrow" size={18}/>
          </div>
          <div className="preview-covers">{top.map(g=><Cover key={g.id} game={g}/>)}
            {Array.from({length:Math.max(0,4-top.length)},(_,i)=><div key={i} className="preview-empty"/>)}
          </div>
          <div className="category-foot"><span>{games.length>4?"+"+(games.length-4)+" more":"Your top-ranked games"}</span><span>Open category <ArrowRight size={14}/></span></div>
          </Link>
        </SortableItem>;
      })}</div></SortableContext>}
    </div>;
  }

  function LibraryScreen() {
    const filtered=data.games.filter(g=>(g.title+" "+g.subtitle).toLowerCase().includes(query.toLowerCase()))
      .sort((a,b)=>a.title.localeCompare(b.title));
    return <div className="screen">
      <div className="page-top"><div><div className="eyebrow">THE MASTER COLLECTION</div><h1>All Games<span className="dot">.</span></h1>
        <p className="subline">Every game lives here, even when it appears in several categories.</p></div>
        <button className="primary" onClick={()=>openModal("game")}><Plus size={17}/> Add Game</button></div>
      <div className="library-toolbar">
        <label className="search"><Search size={18}/><input aria-label="Search your games" placeholder="Search your library…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <div className="segment"><button className={libraryView==="gallery"?"selected":""} onClick={()=>setLibraryView("gallery")} title="Gallery view"><LayoutDashboard size={17}/></button>
          <button className={libraryView==="list"?"selected":""} onClick={()=>setLibraryView("list")} title="List view"><List size={17}/></button></div>
      </div>
      {!data.games.length?<div className="blank-state compact"><div className="blank-symbol"><Library size={30}/></div>
        <h2>Your library starts here.</h2><p>Add a game manually now. Game database search is coming in the next milestone.</p>
        <button className="primary" onClick={()=>openModal("game")}><Plus size={17}/> Add a game</button>
      </div>:!filtered.length?<div className="empty-search">No games match “{query}”.</div>:
      <div className={libraryView==="gallery"?"games-grid":"games-list"}>
        {filtered.map(g=><DragItem key={g.id} id={"library-game/"+g.id} data={{kind:"game",categoryId:"library",gameId:g.id}}>
          {GameCard({game:g,list:libraryView==="list",organize:true})}
        </DragItem>)}
      </div>}
    </div>;
  }

  function ShelvesScreen() {
    return <div className="screen">
      <div className="page-top"><div><div className="eyebrow">OUT OF THE LIMELIGHT</div><h1>Shelves<span className="dot">.</span></h1>
      <p className="subline">Keep secondary categories organized and your dashboard clear.</p></div>
      <button className="primary" onClick={()=>openModal("shelf")}><Plus size={17}/> New shelf</button></div>
      {!data.shelves.length?<div className="blank-state compact"><div className="blank-symbol"><Archive size={30}/></div><h2>A little room to breathe.</h2>
      <p>Shelves hold categories you don't need on your main dashboard. Create one whenever you're ready.</p>
      <button className="primary" onClick={()=>openModal("shelf")}><Plus size={17}/> Create shelf</button></div>:
      <div className="shelf-grid">{[...data.shelves].sort((a,b)=>a.order-b.order).map(s=>
        <DropTarget id={"target-shelf/"+s.id} data={{kind:"shelf-target",shelfId:s.id}} key={s.id}>
        <div className="shelf-card">
        <div className="shelf-heading"><Archive size={19}/><strong>{s.name}</strong><span className="muted small">{shelfCategories(s.id).length} categories</span>
          <button className="icon-button" title="Rename shelf" aria-label={"Rename "+s.name} onClick={()=>renameShelf(s.id,s.name)}><Pencil size={15}/></button>
          <button className="icon-button" title="Delete shelf" aria-label={"Delete "+s.name} onClick={()=>deleteShelf(s.id)}><Trash2 size={15}/></button>
        </div>
        {shelfCategories(s.id).map(c=><DragItem key={c.id} id={"shelf-category/"+c.id}
          data={{kind:"category",categoryId:c.id}}>
          <Link className="shelf-category" href={"/category/"+c.id}><LabelIcon name={c.icon}/><span>{c.name}</span><ChevronRight size={16}/></Link>
        </DragItem>)}
        {!shelfCategories(s.id).length&&<p className="muted small">Move a category here using its settings.</p>}
      </div></DropTarget>)}</div>}
    </div>;
  }

  function CategoryScreen({ category }: { category: Category }) {
    const games=gamesIn(category.id);
    return <div className="screen">
      <div className="breadcrumbs"><Link href="/">Dashboard</Link><ChevronRight size={14}/><span>{category.name}</span></div>
      <div className="page-top"><div className="category-title"><span className="title-icon" style={{color:category.color,background:category.color+"18"}}><LabelIcon name={category.icon} size={26}/></span>
        <div><h1>{category.name}<span className="dot">.</span></h1><p className="subline">{games.length} {games.length===1?"game":"games"} · Your order</p></div></div>
        <div className="page-actions">
          <button className="secondary" onClick={()=>openModal("pick-library",undefined,category.id)}>
            <Library size={16}/> From Library
          </button>
          <button className="primary" onClick={()=>openModal("game",undefined,category.id)}>
            <Plus size={16}/> New game
          </button>
          <div className="segment"><button className={category.view==="gallery"?"selected":""} onClick={()=>setCategory(category.id,{view:"gallery"})} aria-label="Gallery view"><LayoutDashboard size={17}/></button>
          <button className={category.view==="list"?"selected":""} onClick={()=>setCategory(category.id,{view:"list"})} aria-label="List view"><List size={17}/></button></div>
          <button className="secondary icon-square" aria-label="Category settings" title="Category settings" onClick={()=>setOpenCategoryMenu(v=>!v)}><MoreHorizontal size={20}/></button>
        </div></div>
      {openCategoryMenu&&<div className="settings-panel">
        <label>Category name <input value={category.name} onChange={e=>setCategory(category.id,{name:e.target.value})}/></label>
        <label>Where it appears<select value={category.location} onChange={e=>setCategory(category.id,{location:e.target.value,order:data.categories.filter(c=>c.location===e.target.value).length})}>
          <option value="dashboard">Dashboard</option>{data.shelves.map(s=><option key={s.id} value={s.id}>Shelf: {s.name}</option>)}</select></label>
        <div className="setting-caption">Accent color</div><div className="swatches">{colors.map(color=><button key={color} className={"swatch "+(category.color===color?"chosen":"")}
          style={{background:color}} aria-label={"Choose color "+color} onClick={()=>setCategory(category.id,{color})}/>)}</div>
        <div className="setting-caption">Icon</div><div className="icon-choices">{icons.map(icon=><button key={icon} className={category.icon===icon?"chosen":""} onClick={()=>setCategory(category.id,{icon})}><LabelIcon name={icon}/></button>)}</div>
        <button className="danger-text" onClick={()=>removeCategory(category.id)}><Trash2 size={16}/> Delete category (keep games)</button>
      </div>}
      {!games.length?<div className="blank-state compact"><div className="blank-symbol"><Gamepad2 size={30}/></div><h2>Nothing here yet.</h2>
        <p>Create a new game right here, or choose one you've already added to your Library.</p>
        <div className="empty-category-actions">
          <button className="primary" onClick={()=>openModal("game",undefined,category.id)}>
            <Plus size={17}/> Create a game
          </button>
          <button className="secondary" onClick={()=>openModal("pick-library",undefined,category.id)}>
            <Library size={17}/> From Library
          </button>
        </div>
      </div>:<><div className="subtle-hint"><GripVertical size={15}/> Hold a game briefly, then drag to reorder. You can also move games into another category using the sidebar.</div>
        <SortableContext items={games.map(g=>"game/"+category.id+"/"+g.id)}
            strategy={category.view==="gallery"?rectSortingStrategy:verticalListSortingStrategy}>
          <div className={category.view==="gallery"?"games-grid":"games-list"}>
            {games.map(g=><SortableItem id={"game/"+category.id+"/"+g.id} key={g.id}
              data={{kind:"game",categoryId:category.id,gameId:g.id}}>
              {GameCard({game:g,list:category.view==="list",organize:true})}
            </SortableItem>)}
          </div>
        </SortableContext></>}
    </div>;
  }

  function GameScreen({ game }: { game: Game }) {
    const gameLinks=data.links.filter(l=>l.gameId===game.id).sort((a,b)=>a.order-b.order);
    const pageId=noteSelection[game.id]||"current";
    const historyKey=game.id+"/"+pageId;
    const history=data.noteRevisions?.[historyKey]||[];
    const gameCategories=membershipsFor(game.id).map(m=>data.categories.find(c=>c.id===m.categoryId)).filter((c):c is Category=>Boolean(c));
    return <div className="screen workspace-screen">
      <div className="breadcrumbs"><button onClick={()=>router.back()}><ArrowLeft size={14}/> Back</button><ChevronRight size={14}/><span>{game.title}</span></div>
      <div className="workspace-heading"><Cover game={game} className="workspace-cover"/><div className="workspace-intro">
        <div className="eyebrow">GAME WORKSPACE</div><h1>{game.title}</h1>
        {game.subtitle&&<p className="subline">{game.subtitle}</p>}
        <div className="chips">{gameCategories.map(c=><Link key={c.id} href={"/category/"+c.id} className="chip">{c.name}</Link>)}
          {!gameCategories.length&&<span className="muted small">Only in Library</span>}</div>
      </div><button className="secondary icon-square" title="Organize game" aria-label="Organize game" onClick={()=>openModal("organize",game.id)}><MoreHorizontal size={20}/></button></div>
      <section className="workspace-section note-section">
        <div className="note-page-tabs" role="tablist" aria-label="Notes pages">
          <button type="button" role="tab" aria-selected={!noteSelection[game.id]||noteSelection[game.id]==="current"}
            className={!noteSelection[game.id]||noteSelection[game.id]==="current"?"selected":""}
            onClick={()=>setNoteSelection(p=>({...p,[game.id]:"current"}))}>Current</button>
          {(data.notePages?.[game.id]||[]).sort((a,b)=>a.order-b.order).map(page=>
            <button key={page.id} role="tab" aria-selected={noteSelection[game.id]===page.id}
              className={noteSelection[game.id]===page.id?"selected":""}
              onClick={()=>setNoteSelection(p=>({...p,[game.id]:page.id}))}>{page.title}</button>
          )}
          <button className="add-note-page" type="button" onClick={()=>addNotePage(game.id)} title="New notes page">
            <Plus size={15}/> Add page
          </button>
        </div>
        <div className="section-head">
          <div><div className="section-overline">{!noteSelection[game.id]||noteSelection[game.id]==="current"?"CURRENT":"NOTES PAGE"}</div>
            {!noteSelection[game.id]||noteSelection[game.id]==="current"?
              <div className="note-title-row">
                {editingNoteTitle === game.id ? (
                  <>
                    <input className="note-title-input" aria-label="Notebook heading"
                      value={noteTitleDraft} maxLength={80} autoFocus
                      onChange={e=>setNoteTitleDraft(e.target.value)}
                      onBlur={()=>commitNoteTitle(game.id)}
                      onKeyDown={e=>{
                        if(e.key==="Enter"){e.preventDefault();commitNoteTitle(game.id);}
                        if(e.key==="Escape"){e.preventDefault();discardNoteTitleEdit();}
                      }}/>
                    <button className="note-title-control" title="Save title" aria-label="Save notebook heading"
                      onMouseDown={e=>e.preventDefault()} onClick={()=>commitNoteTitle(game.id)}><Check size={16}/></button>
                    <button className="note-title-control" title="Cancel" aria-label="Cancel heading edit"
                      onMouseDown={e=>e.preventDefault()} onClick={discardNoteTitleEdit}><X size={16}/></button>
                  </>
                ):<>
                  <h2>{data.noteTitles?.[game.id]||"Where I left off"}</h2>
                  <button className="note-title-control" aria-label="Rename notebook heading"
                    title="Rename this notebook title" onClick={()=>startEditingNoteTitle(game.id)}><Pencil size={15}/></button>
                </>}
              </div>:
              <div className="note-title-row">
                <h2>{data.notePages?.[game.id]?.find(p=>p.id===noteSelection[game.id])?.title||"Notes"}</h2>
                <button className="note-title-control" aria-label="Rename notes page"
                  onClick={()=>{
                    const p=data.notePages?.[game.id]?.find(p=>p.id===noteSelection[game.id]);
                    if(p)renameNotePage(game.id,p.id,p.title);
                  }}><Pencil size={15}/></button>
                <button className="note-title-control" aria-label="Delete notes page"
                  onClick={()=>deleteNotePage(game.id,noteSelection[game.id])}><Trash2 size={15}/></button>
              </div>
            }
          </div>
          <div className="save-indicator">{saveStatus==="saving"?<><Cloud size={15}/> Saving…</>:
            saveStatus==="error"?<><CloudOff size={15}/> Could not save</>:<><Check size={15}/> Saved locally</>}</div>
        </div>
        {(!noteSelection[game.id]||noteSelection[game.id]==="current")?
          <RichNotes key={game.id+":current:"+(noteRefresh[game.id+"/current"]||0)} note={data.notes[game.id]||""}
            onChange={html=>change(d=>({...d,notes:{...d.notes,[game.id]:html}}))}/>:
          <RichNotes key={game.id+":"+noteSelection[game.id]+":"+(noteRefresh[historyKey]||0)}
            note={data.notePages?.[game.id]?.find(p=>p.id===noteSelection[game.id])?.content||""}
            onChange={html=>change(d=>({...d,notePages:{...(d.notePages||{}),
              [game.id]:(d.notePages?.[game.id]||[]).map(p=>p.id===noteSelection[game.id]?{...p,content:html}:p)}}))}/>
        }
        <div className="note-history-bar">
          <button className="history-action" type="button" onClick={()=>snapshotNote(game.id,pageId)}>
            <BookOpen size={14}/> Save checkpoint
          </button>
          <button className="history-action" type="button"
            onClick={()=>setShowHistory(prev=>({...prev,[historyKey]:!prev[historyKey]}))}>
            <Clock3 size={14}/> History ({history.length})
          </button>
        </div>
        {showHistory[historyKey]&&<div className="note-history-list">
          {history.length?history.map(rev=><div key={rev.id} className="note-history-row">
            <span>{new Date(rev.createdAt).toLocaleString()}</span>
            <button className="secondary small-button" type="button"
              onClick={()=>restoreNote(game.id,pageId,rev.content)}>Restore</button>
          </div>):<p className="muted small">No checkpoints yet. Save one above before major note edits.</p>}
        </div>}
      </section>
      <section className="workspace-section links-section"><div className="section-head"><div><div className="section-overline">TOOLS</div><h2>Quick links</h2></div>
        <button className="secondary small-button" onClick={()=>openModal("link",game.id)}><Plus size={16}/> Add link</button></div>
        {gameLinks.length?<div className="quick-links">{gameLinks.map(l=><div className="quick-link" key={l.id}>
          <a href={l.url} target="_blank" rel="noopener noreferrer"><Link2 size={16}/><span>{l.title}</span><ExternalLink size={14}/></a>
          <button title={"Edit "+l.title} aria-label={"Edit "+l.title} onClick={()=>openModal("edit-link",game.id,undefined,l.id)}><Pencil size={15}/></button>
          <button title={"Remove "+l.title} aria-label={"Remove "+l.title}
            onClick={()=>{if(window.confirm("Remove this quick link?"))change(d=>({...d,links:d.links.filter(x=>x.id!==l.id)}));}}><X size={15}/></button>
        </div>)}</div>:<p className="muted small">Pin a walkthrough, wiki or guide here so it's always one click away.</p>}
      </section>
    </div>;
  }

  return <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={handleDragStart} onDragEnd={handleDragEnd}
      onDragCancel={()=>setDragging(null)}>
    <div className={"app-shell theme-"+(data.theme||"midnight")}>
    <aside className={"sidebar "+(!sidebarOpen?"collapsed ":"")+(mobileMenu?"mobile-open":"")}>
      <div className="brand">
        {sidebarOpen ? (
          <>
            <div className="brand-icon"><Gamepad2 size={23}/></div>
            <div className="brand-copy"><strong>Gaming<span>HQ</span></strong><small>Your games, your space.</small></div>
            <button className="sidebar-collapse" type="button" title="Collapse sidebar" aria-label="Collapse sidebar" onClick={()=>{closeSidebar();setMobileMenu(false);}}>
              <PanelLeftClose size={17}/>
            </button>
          </>
        ) : (
          <button className="brand-icon brand-expand" type="button" aria-label="Expand sidebar" title="Expand sidebar" onClick={expandSidebar}>
            <Gamepad2 size={23}/>
          </button>
        )}
      </div>
      <nav className="nav">
        <div className="nav-label">WORKSPACE</div>
        {sidebarOpen ? (
          <>
            <DropTarget id="target-dashboard" data={{kind:"dashboard-target"}}>
              <Link className={"nav-item "+(section==="dashboard"?"nav-active":"")} href="/"><LayoutDashboard size={18}/><span>Dashboard</span></Link>
            </DropTarget>
            <DropTarget id="target-library" data={{kind:"library-target"}}>
              <Link className={"nav-item "+(section==="library"?"nav-active":"")} href="/library"><Library size={18}/><span>All Games</span></Link>
            </DropTarget>
            <Link className={"nav-item shelf-nav "+(section==="shelves"?"nav-active":"")} href="/shelves"><Archive size={18}/><span>Shelves</span></Link>
          </>
        ) : (
          <>
            <button type="button" className={"nav-item nav-expand "+(section==="dashboard"?"nav-active":"")}
              aria-label="Expand sidebar for Dashboard" title="Expand sidebar · Dashboard" onClick={expandSidebar}><LayoutDashboard size={18}/></button>
            <button type="button" className={"nav-item nav-expand "+(section==="library"?"nav-active":"")}
              aria-label="Expand sidebar for All Games" title="Expand sidebar · All Games" onClick={expandSidebar}><Library size={18}/></button>
            <button type="button" className={"nav-item nav-expand shelf-nav "+(section==="shelves"?"nav-active":"")}
              aria-label="Expand sidebar for Shelves" title="Expand sidebar · Shelves" onClick={expandSidebar}><Archive size={18}/></button>
          </>
        )}
        {sidebarOpen&&<><div className="nav-label nav-label-categories">YOUR CATEGORIES
          <button title="New category" aria-label="New category" onClick={()=>openModal("category")}><Plus size={16}/></button></div>
          <SortableContext items={dashboardCategories.map(c=>"side-category/"+c.id)} strategy={verticalListSortingStrategy}>
          <div className="category-nav">{dashboardCategories.map((c,i)=>
            <SortableItem id={"side-category/"+c.id} key={c.id}
              data={{kind:"category",categoryId:c.id}}>
              {CategoryRow({category:c,index:i,length:dashboardCategories.length})}
            </SortableItem>)}
            {!dashboardCategories.length&&<div className="nav-empty">Your categories will appear here.</div>}
          </div></SortableContext></>}
          {sidebarOpen&&dragging?.kind==="category"&&
            <div className="drag-shelf-targets">
              <div className="nav-label">MOVE CATEGORY TO</div>
              {data.shelves.map(s=><DropTarget key={s.id} id={"target-shelf/"+s.id}
                data={{kind:"shelf-target",shelfId:s.id}} className="sidebar-drop">
                <Archive size={15}/> {s.name}
              </DropTarget>)}
              {!data.shelves.length&&<span className="muted small">Create a Shelf first to move categories here.</span>}
            </div>}
      </nav>
      <div className="sidebar-bottom"><div className="local-badge"><span className="local-dot"/>{sidebarOpen&&<span>{saveStatus==="error"?"Saving error":"Guest mode · Local only"}</span>}</div></div>
    </aside>
    {mobileMenu&&<button className="mobile-overlay" aria-label="Close navigation" onClick={()=>setMobileMenu(false)}/>}
    <div className="main-shell">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-toggle" onClick={()=>{setSidebarOpen(true);setMobileMenu(v=>!v);}} aria-label="Open navigation"><Menu size={20}/></button>
        <button className="icon-button" aria-label="Back" title="Back" onClick={()=>router.back()}><ArrowLeft size={19}/></button>
        <button className="icon-button" aria-label="Forward" title="Forward" onClick={()=>router.forward()}><ArrowRight size={19}/></button>
        <span className="topbar-divider"/><span className="topbar-location">{section==="dashboard"?"Dashboard":section==="library"?"Library":section==="shelves"?"Shelves":section==="category"?currentCategory?.name:currentGame?.title||"Gaming HQ"}</span></div>
        <div className="topbar-right"><span className="guest-chip"><Cloud size={14}/> Guest workspace</span><button className="icon-button" title="Appearance and backups" aria-label="Appearance and backups"
          onClick={()=>{setShowPreferences(true);setBackupMessage("");}}><Settings2 size={18}/></button></div>
      </header>
      <main className="main-content">{!ready?<div className="loading"><span className="pulse-dot"/> Opening your space…</div>:
        section==="dashboard"?Dashboard():section==="library"?LibraryScreen():section==="shelves"?ShelvesScreen():
        section==="category"&&currentCategory?CategoryScreen({category:currentCategory}):
        section==="game"&&currentGame?GameScreen({game:currentGame}):
        <div className="blank-state"><h2>Couldn't find that page.</h2><button className="primary" onClick={()=>go("/")}>Back to dashboard</button></div>}
      </main>
    </div>
    {showPreferences&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowPreferences(false);}}>
      <div className="dialog preferences-dialog" role="dialog" aria-modal="true" aria-label="Gaming HQ preferences">
        <div className="dialog-head"><h2>Preferences</h2>
          <button className="icon-button" aria-label="Close preferences" onClick={()=>setShowPreferences(false)}><X size={20}/></button></div>
        <div className="dialog-fields">
          <div><div className="setting-caption">APPEARANCE</div><p className="muted small">Choose your home base's look.</p></div>
          <div className="theme-grid">
            {([["midnight","Midnight Blue"],["obsidian","Obsidian"],["violet","Dusk Violet"],["teal","Deep Teal"]] as [ThemeName,string][]).map(([id,label])=>
              <button className={"theme-choice theme-preview-"+id+((data.theme||"midnight")===id?" chosen":"")}
                key={id} onClick={()=>change(d=>({...d,theme:id}))}>
                <span className="theme-preview-bar"/><strong>{label}</strong>
                {(data.theme||"midnight")===id&&<Check size={15}/>}
              </button>)}
          </div>
          <div className="dialog-separator"/>
          <div><div className="setting-caption">DATA & BACKUPS</div><p className="muted small">Your notes currently live in this browser, not in a cloud account. Export regularly and before switching preview URLs.</p></div>
          <button className="secondary" onClick={exportBackup}>Download JSON backup</button>
          <input ref={backupInputRef} type="file" accept=".json,application/json" className="hidden-backup-input"
            onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void importBackup(file);}}/>
          <button className="secondary" onClick={()=>backupInputRef.current?.click()}>Import backup (replace this library)</button>
          {backupMessage&&<p role="status" className="muted small">{backupMessage}</p>}
        </div>
        <div className="dialog-footer"><button className="primary" onClick={()=>setShowPreferences(false)}>Done</button></div>
      </div>
    </div>}
    {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={modal.type==="organize"?"Organize game":"Add new item"}>
        <div className="dialog-head"><h2>{modal.type==="game"?"Add a game":modal.type==="edit-game"?"Edit game":
          modal.type==="category"?"New category":modal.type==="shelf"?"New shelf":
          modal.type==="link"?"Add quick link":modal.type==="edit-link"?"Edit quick link":
          modal.type==="pick-library"?"Add from Library":"Organize game"}</h2><button className="icon-button" title="Close" onClick={()=>setModal(null)}><X size={20}/></button></div>
        {(modal.type==="game"||modal.type==="edit-game")&&<div className="dialog-fields"><p className="muted small">Manual entry for now. Automatic game search is planned next.</p>
          <label>Game title<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Kingdom Hearts Final Mix"/></label>
          <label>Subtitle / details <span className="muted">(optional)</span><input value={subtitle} onChange={e=>setSubtitle(e.target.value)} placeholder="e.g. PlayStation 2 · Action RPG"/></label>
          <label>Cover image URL <span className="muted">(optional)</span><input value={coverUrl} onChange={e=>setCoverUrl(e.target.value)} placeholder="https://…"/></label>
          {modal.type==="game"&&<label>Add to a category <span className="muted">(optional)</span><select value={targetCategory} onChange={e=>setTargetCategory(e.target.value)}>
            <option value="">Only add to Library</option>{data.categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}</div>}
        {modal.type==="category"&&<div className="dialog-fields"><label>Category name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Priority, Solo, Multiplayer"/></label>
          <label>Location<select value={targetCategory} onChange={e=>setTargetCategory(e.target.value)}><option value="">Dashboard</option>{data.shelves.map(s=><option key={s.id} value={s.id}>Shelf: {s.name}</option>)}</select></label>
          <label>Accent color</label><div className="swatches">{colors.map(c=><button className={"swatch "+(categoryColor===c?"chosen":"")} style={{background:c}} key={c}
            aria-label={"Color "+c} onClick={()=>setCategoryColor(c)}/>)}</div>
          <label>Icon</label><div className="icon-choices">{icons.map(i=><button className={i===categoryIcon?"chosen":""} key={i} onClick={()=>setCategoryIcon(i)}><LabelIcon name={i}/></button>)}</div></div>}
        {modal.type==="shelf"&&<div className="dialog-fields"><label>Shelf name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Backlog, Completed, Wishlist"/></label>
          <p className="muted small">You can move existing categories into this shelf from their category settings.</p></div>}
        {(modal.type==="link"||modal.type==="edit-link")&&<div className="dialog-fields"><label>URL<input autoFocus value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="https://…"/></label>
          <label>Title <span className="muted">(optional)</span><input value={linkName} onChange={e=>setLinkName(e.target.value)} placeholder="e.g. Walkthrough"/></label></div>}
        {modal.type==="pick-library"&&<div className="dialog-fields">
          <p className="muted small">Choose games for {data.categories.find(c=>c.id===modal.categoryId)?.name || "this category"}. Already-added games remain in your Library and any other categories.</p>
          <label>Search your games
            <input type="search" autoFocus value={pickerQuery} onChange={e=>setPickerQuery(e.target.value)}
              placeholder="Search titles in your Library…"/>
          </label>
          <div className="library-picker">
            {data.games.filter(game=>game.title.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
              .sort((a,b)=>a.title.localeCompare(b.title)).map(game=>{
                const included=data.memberships.some(m=>m.gameId===game.id&&m.categoryId===modal.categoryId);
                return <label className="library-picker-item" key={game.id}>
                  <input type="checkbox" checked={included}
                    onChange={e=>toggleMembership(game.id,modal.categoryId||"",e.target.checked)}/>
                  <span className="library-picker-title">{game.title}</span>
                  {included&&<Check size={15} className="picker-check"/>}
                </label>;
              })}
            {!data.games.length?<p className="muted small">Your Library is empty. Create your first game here.</p>:
              !data.games.some(g=>g.title.toLowerCase().includes(pickerQuery.trim().toLowerCase()))?
              <p className="muted small">No games match that search.</p>:null}
          </div>
          <button className="secondary" onClick={()=>openModal("game",undefined,modal.categoryId)}>
            <Plus size={16}/> Create a new game instead
          </button>
        </div>}
        {modal.type==="organize"&&<div className="dialog-fields">
          <p className="muted small">{data.games.find(g=>g.id===modal.gameId)?.title} can appear in multiple categories. All changes are saved locally.</p>
          <div className="organize-checks">{data.categories.map(c=><label key={c.id}><input type="checkbox"
            checked={data.memberships.some(m=>m.gameId===modal.gameId&&m.categoryId===c.id)}
            onChange={e=>toggleMembership(modal.gameId||"",c.id,e.target.checked)}/><span style={{color:c.color}}><LabelIcon name={c.icon} size={16}/></span>{c.name}</label>)}
            {!data.categories.length&&<p className="muted small">No categories yet. Create one from the Dashboard first.</p>}</div>
          <div className="dialog-separator"/>
          <button className="secondary" onClick={()=>openModal("edit-game",modal.gameId)}><Pencil size={16}/> Edit game title and cover</button>
          <button className="danger-text" onClick={()=>removeGame(modal.gameId||"")}><Trash2 size={16}/> Remove from Library and delete notes</button>
        </div>}
        {error&&<p role="alert" className="field-error">{error}</p>}
        <div className="dialog-footer"><button className="secondary" onClick={()=>setModal(null)}>
          {modal.type==="organize"||modal.type==="pick-library"?"Done":"Cancel"}</button>
          {modal.type!=="organize"&&modal.type!=="pick-library"&&<button className="primary" onClick={modal.type==="game"?addGame:modal.type==="edit-game"?saveEditedGame:
            modal.type==="category"?addCategory:modal.type==="shelf"?addShelf:
            modal.type==="edit-link"?saveEditedLink:addLink}>
            <Plus size={16}/>{modal.type==="game"?"Add game":modal.type==="edit-game"?"Save game":
            modal.type==="category"?"Create category":modal.type==="shelf"?"Create shelf":
            modal.type==="edit-link"?"Save link":"Add link"}</button>}</div>
      </div>
    </div>}
    {undoData&&<div className="undo-toast" role="status">
      <span>{undoLabel}</span><button type="button" onClick={()=>{setData(undoData);setUndoData(null);}}>Undo</button>
      <button type="button" aria-label="Dismiss undo" onClick={()=>setUndoData(null)}><X size={14}/></button>
    </div>}
  </div>
  </DndContext>;
}
