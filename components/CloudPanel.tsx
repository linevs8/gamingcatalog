"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Data } from "@/lib/data";
import { cloudClient } from "@/lib/cloud";
import { validateImport } from "@/lib/data";

type Remote = { data: unknown; revision: number; updated_at: string };
type Props = { localData: Data; localSaveStatus: "saving" | "saved" | "error"; onRestore: (value: Data) => Promise<void> };

export default function CloudPanel({ localData, localSaveStatus, onRestore }: Props) {
  const client = useMemo(() => cloudClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [remote, setRemote] = useState<Remote | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const lastSynced = useRef("");
  const signature = useMemo(() => JSON.stringify(localData), [localData]);

  useEffect(() => {
    if (!client) return;
    let mounted = true;
    void client.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      setUser(error ? null : data.user);
    });
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        setRemote(null);
        setLoaded(false);
        setAutoSync(false);
        lastSynced.current = "";
      }
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [client]);

  const loadRemote = async () => {
    if (!client || !user) return;
    setBusy(true); setStatus("");
    try {
      const { data, error } = await client.from("playquill_snapshots")
        .select("data,revision,updated_at").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      setRemote(data as Remote | null);
      setLoaded(true);
      setAutoSync(false);
      lastSynced.current = "";
      setStatus(data ? "Cloud library found. Choose whether to upload or restore."
        : "No cloud library yet. Upload your current library when you're ready.");
    } catch (err) {
      setLoaded(false);
      setStatus("Couldn't check the cloud library: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally { setBusy(false); }
  };

  const requestEmailLink = async () => {
    if (!client || !email.trim()) return;
    setBusy(true); setStatus("");
    try {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + "/" },
      });
      if (error) throw error;
      setStatus("Check your email for the sign-in link. This local library remains unchanged.");
    } catch (err) {
      setStatus("Sign-in failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally { setBusy(false); }
  };

  const signInWithGoogle = async () => {
    if (!client) return;
    setBusy(true); setStatus("");
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/" },
    });
    if (error) {
      setStatus("Google sign-in is unavailable: " + error.message);
      setBusy(false);
    }
  };

  const upload = async () => {
    if (!client || !user || !loaded || localSaveStatus !== "saved") return;
    const action = remote
      ? "REPLACE your saved CLOUD library with this device's current library? Other devices will need to restore the new copy. Export a JSON backup first."
      : "Create a private CLOUD copy of the library currently on this device? Export a JSON backup first.";
    if (!window.confirm(action)) return;
    setBusy(true); setStatus("");
    try {
      const payload = validateImport(localData);
      if (remote) {
        // Compare-and-swap: don't silently overwrite a newer cloud revision.
        const { data, error } = await client.from("playquill_snapshots")
          .update({ data: payload, revision: remote.revision + 1, updated_at: new Date().toISOString() })
          .eq("user_id", user.id).eq("revision", remote.revision)
          .select("data,revision,updated_at").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Cloud data changed on another device. Refresh cloud status before deciding what to do.");
        setRemote(data as Remote);
      } else {
        const { data, error } = await client.from("playquill_snapshots")
          .insert({ user_id: user.id, data: payload, revision: 1 })
          .select("data,revision,updated_at").single();
        if (error) throw error;
        setRemote(data as Remote);
      }
      lastSynced.current = signature;
      setStatus("Cloud library uploaded successfully. This device's local library is unchanged.");
    } catch (err) {
      setStatus("Upload failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally { setBusy(false); }
  };

  const restore = async () => {
    if (!remote) return;
    if (!window.confirm("REPLACE this device's LOCAL library with the cloud copy? Export a JSON backup of this device first. This cannot be undone.")) return;
    setBusy(true); setStatus("");
    try {
      const validated = validateImport(remote.data);
      await onRestore(validated);
      lastSynced.current = JSON.stringify(validated);
      setStatus("Cloud library restored to this device.");
    } catch (err) {
      setStatus("Restore failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally { setBusy(false); }
  };

  return <div className="cloud-panel">
    <div className="setting-caption">OPTIONAL CLOUD LIBRARY</div>
    {!client ? <p className="muted small">
      Cloud sign-in is not configured for this deployment. Your local library and JSON backups still work.
    </p> : !user ? <>
      <p className="muted small">Sign in to keep a separate private cloud copy. Nothing uploads automatically.</p>
      <label>Email for sign-in link
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
          autoComplete="email" placeholder="you@example.com" disabled={busy}/>
      </label>
      <button className="secondary" disabled={busy || !email.includes("@")} onClick={()=>void requestEmailLink()}>
        Send sign-in link
      </button>
      {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && <button className="secondary"
        disabled={busy} onClick={()=>void signInWithGoogle()}>
        Continue with Google
      </button>}
    </> : <>
      <p className="muted small">Signed in as {user.email || "your account"}. Your local changes are never overwritten automatically.</p>
      <button className="secondary" disabled={busy} onClick={()=>void loadRemote()}>Check cloud library</button>
      {loaded && <>
        {remote ? <p className="muted small">
          Cloud copy saved {new Date(remote.updated_at).toLocaleString()} · revision {remote.revision}
        </p> : <p className="muted small">This account has no cloud library yet.</p>}
        <button className="secondary" disabled={busy} onClick={()=>void upload()}>
          {remote ? "Replace cloud copy with this device…" : "Upload this library to cloud…"}
        </button>
        {remote && <button className="secondary" disabled={busy} onClick={()=>void restore()}>
          Restore cloud copy to this device…
        </button>}
      </>}
      <button className="secondary small-button" disabled={busy} onClick={()=>void client.auth.signOut()}>
        Sign out
      </button>
    </>}
    {status && <p className="muted small" role="status">{status}</p>}
  </div>;
}
