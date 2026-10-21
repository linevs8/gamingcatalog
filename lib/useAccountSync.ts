"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import type { Data } from "./data";
import { emptyData, saveData } from "./data";
import { combineLibraries } from "./mergeLibraries";
import { libraryHasContent, readCloud, supabaseClient, supabaseConfigured, writeCloud } from "./cloud";

export type AccountPhase = "guest" | "loading" | "choose" | "active" | "conflict";
type Pending = { user:User; remote:Data|null; revision:number|null };
type Props = { data:Data; setData:Dispatch<SetStateAction<Data>>; ready:boolean };

export function useAccountSync({data,setData,ready}:Props) {
  const configured=supabaseConfigured();
  const [user,setUser]=useState<User|null>(null);
  const [phase,setPhase]=useState<AccountPhase>("guest");
  const [pending,setPending]=useState<Pending|null>(null);
  const [syncStatus,setSyncStatus]=useState<"saved"|"saving"|"error">("saved");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const guest=useRef<Data|null>(null);
  const currentData=useRef(data);currentData.current=data;
  const latestUser=useRef<User|null>(null);
  const activePhase=useRef(phase);activePhase.current=phase;
  const revision=useRef<number|null>(null);
  const lastSaved=useRef("");
  const writing=useRef(false);
  const syncFailed=useRef(false);
  const nextRetryAt=useRef(0);
  const loadingId=useRef("");
  const generation=useRef(0);

  useEffect(()=> {
    if(ready && phase==="guest") guest.current=data;
  },[ready,phase,data]);

  const loadUser=useCallback(async (nextUser:User|null)=>{
    if(!nextUser) return;
    if(loadingId.current===nextUser.id) return;
    if(latestUser.current?.id===nextUser.id && (activePhase.current==="active"||activePhase.current==="choose"))return;
    const run=++generation.current;
    loadingId.current=nextUser.id;
    setPhase("loading");setError("");setUser(nextUser);latestUser.current=nextUser;
    try {
      const remote=await readCloud(nextUser.id);
      if(run!==generation.current)return;
      const local=guest.current||emptyData();
      if(libraryHasContent(local)) {
        setPending({user:nextUser,remote:remote?.snapshot||null,revision:remote?.revision??null});
        setPhase("choose");
      } else if(remote) {
        setData(remote.snapshot);
        revision.current=remote.revision;
        lastSaved.current=JSON.stringify(remote.snapshot);
        setPending(null);setPhase("active");setSyncStatus("saved");
      } else {
        const clean=emptyData();
        const remoteRevision=await writeCloud(nextUser.id,clean,null);
        if(run!==generation.current)return;
        setData(clean);revision.current=remoteRevision;
        lastSaved.current=JSON.stringify(clean);
        setPending(null);setPhase("active");setSyncStatus("saved");
      }
    } catch(e) {
      if(run===generation.current){
        setError(e instanceof Error?e.message:"Could not load your cloud library.");
        setPhase("conflict");setSyncStatus("error");
      }
    } finally {if(run===generation.current) loadingId.current="";}
  },[setData]);

  useEffect(()=>{
    if(!ready||!configured)return;
    const client=supabaseClient();
    if(!client)return;
    let live=true;
    void client.auth.getUser().then(({data,error})=>{
      if(!live)return;
      if(error){setError(error.message);return;}
      if(data.user)void loadUser(data.user);
    });
    const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
      if(!live)return;
      if(event==="SIGNED_OUT") {
        generation.current+=1;loadingId.current="";
        latestUser.current=null;setUser(null);setPending(null);
        setPhase("guest");setSyncStatus("saved");setError("");setNotice("");
        setData(guest.current||emptyData());
      }else if(event==="SIGNED_IN"||event==="INITIAL_SESSION") {
        if(session?.user)queueMicrotask(()=>{if(live)void loadUser(session.user);});
      }
    });
    return ()=>{live=false;subscription.unsubscribe();};
  },[ready,configured,loadUser,setData]);

  const activate=async (choice:"cloud"|"local"|"merge")=>{
    if(!pending)return;
    setPhase("loading");setError("");
    const {user:selectedUser,remote,revision:oldRevision}=pending;
    try{
      if(choice==="local" && remote && !window.confirm(
        "Replace the cloud library with this browser's data? The previous cloud copy will be overwritten. Download a backup first if you need it."
      )) {setPhase("choose");return;}
      const next=choice==="cloud" ? remote||emptyData() :
        choice==="merge" && remote?combineLibraries(remote,guest.current||emptyData()) :
        guest.current||emptyData();
      const nextRevision=choice==="cloud"&&remote ? oldRevision :
        await writeCloud(selectedUser.id,next,oldRevision);
      setData(next);lastSaved.current=JSON.stringify(next);
      revision.current=nextRevision;
      setPending(null);setPhase("active");setSyncStatus("saved");
      setNotice(choice==="cloud"?"Cloud library loaded.":
        choice==="merge"?"Libraries combined and saved.":"Local library uploaded.");
    }catch(e){
      setError(e instanceof Error?e.message:"Couldn't prepare your library.");
      setPhase("choose");setSyncStatus("error");
    }
  };

  const flush=useCallback(async ()=>{
    if(writing.current||activePhase.current!=="active"||!latestUser.current||Date.now()<nextRetryAt.current)return;
    const snapshot=currentData.current;
    const json=JSON.stringify(snapshot);
    if(json===lastSaved.current)return;
    writing.current=true;setSyncStatus("saving");
    const userId=latestUser.current.id,run=generation.current;
    try{
      const newRevision=await writeCloud(userId,snapshot,revision.current);
      if(run!==generation.current)return;
      revision.current=newRevision;lastSaved.current=json;
      syncFailed.current=false;nextRetryAt.current=0;
      setSyncStatus("saved");setError("");
    }catch(e){
      if(run!==generation.current)return;
      syncFailed.current=true;nextRetryAt.current=Date.now()+12_000;
      setSyncStatus("error");setError(e instanceof Error?e.message:"Cloud save failed.");
      if(e instanceof Error&&e.name==="SyncConflict")setPhase("conflict");
    }finally {writing.current=false;}
  },[]);

  useEffect(()=>{
    if(phase!=="active")return;
    const interval=window.setInterval(()=>{void flush();},1400);
    const onVisibility=()=>{if(document.visibilityState==="hidden")void flush();};
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>{window.clearInterval(interval);document.removeEventListener("visibilitychange",onVisibility);};
  },[phase,flush]);

  const sendEmail=async (email:string)=>{
    const client=supabaseClient();
    if(!client)throw new Error("Account sign-in is not configured.");
    const {error}=await client.auth.signInWithOtp({
      email:email.trim(),options:{emailRedirectTo:window.location.origin+"/",shouldCreateUser:true}
    });
    if(error)throw error;
    setNotice("Check your email for your sign-in link.");
  };
  const signInGoogle=async ()=>{
    await saveData(guest.current||currentData.current);
    const client=supabaseClient();
    if(!client)throw new Error("Account sign-in is not configured.");
    const {error}=await client.auth.signInWithOAuth({
      provider:"google",options:{redirectTo:window.location.origin+"/"}
    });
    if(error)throw error;
  };
  const signOut=async ()=>{
    const client=supabaseClient();
    if(!client)return;
    if(activePhase.current==="active") {
      await flush();
      if(syncFailed.current) {
        if(!window.confirm("Some changes may not be in the cloud. Download a backup before signing out. Continue?"))return;
      }
    }else if(activePhase.current==="conflict"&&!window.confirm(
      "Cloud syncing is paused. Download a backup first if needed. Sign out anyway?"
    ))return;
    const {error}=await client.auth.signOut();
    if(error)throw error;
  };

  return {
    configured,user,phase,pending,syncStatus,error,notice,
    activate,sendEmail,signInGoogle,signOut,flush
  };
}
