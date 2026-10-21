"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Data } from "./data";
import { validateImport } from "./data";

let instance: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabaseClient(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  if (!instance) {
    instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce"
        }
      }
    );
  }
  return instance;
}

export type CloudRecord = { snapshot: Data; revision: number };

export async function readCloud(userId: string): Promise<CloudRecord | null> {
  const client = supabaseClient();
  if (!client) throw new Error("Account services are not configured.");
  const { data, error } = await client.from("user_libraries")
    .select("snapshot,revision").eq("user_id",userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {snapshot:validateImport(data.snapshot),revision:Number(data.revision)};
}

export class SyncConflict extends Error {
  constructor() { super("Your cloud library changed on another device. Your changes are still on this screen. Download a backup, then reload to resolve."); }
}

export async function writeCloud(userId:string,snapshot:Data,previousRevision:number|null):Promise<number> {
  const client=supabaseClient();
  if (!client) throw new Error("Account services are not configured.");
  if(previousRevision===null){
    const {data,error}=await client.from("user_libraries").insert({
      user_id:userId,snapshot,revision:1
    }).select("revision").single();
    if(error) {
      if(error.code==="23505") throw new SyncConflict();
      throw new Error(error.message);
    }
    return Number(data.revision);
  }
  const {data,error}=await client.from("user_libraries").update({
    snapshot,revision:previousRevision+1,updated_at:new Date().toISOString()
  }).eq("user_id",userId).eq("revision",previousRevision)
    .select("revision").maybeSingle();
  if(error) throw new Error(error.message);
  if(!data) throw new SyncConflict();
  return Number(data.revision);
}

export function libraryHasContent(data:Data):boolean {
  return Boolean(data.games.length||data.categories.length||data.shelves.length||
    data.links.length||Object.values(data.notes).some(Boolean)||
    Object.values(data.notePages||{}).some(p=>p.length));
}
