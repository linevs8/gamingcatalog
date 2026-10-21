"use client";

import { useState } from "react";
import { Cloud, LogIn, Mail, ShieldCheck, X } from "lucide-react";
import type { useAccountSync } from "@/lib/useAccountSync";

type Account = ReturnType<typeof useAccountSync>;

export default function AccountDialog({account,onClose}:{account:Account;onClose:()=>void}) {
  const [email,setEmail]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const run=async (action:()=>Promise<void>)=>{
    setBusy(true);setMessage("");
    try{await action();}catch(e){setMessage(e instanceof Error?e.message:"Something went wrong. Try again.");}
    finally{setBusy(false);}
  };
  const blocked=account.phase==="choose"||account.phase==="loading";
  const content=()=>{
    if (!account.configured) return <>
      <p className="account-lead">Sign-in is being connected. You can keep using Gaming HQ without an account.</p>
      <p className="muted small">Cloud accounts require a Supabase project and a private library database.</p>
    </>;
    if(account.phase==="loading")return <p className="account-lead">Opening your account…</p>;
    if(account.phase==="choose"&&account.pending) {
      const hasCloud=Boolean(account.pending.remote);
      return <>
        <p className="account-lead">This browser has a guest library. Choose what to keep when connecting your account.</p>
        <div className="account-choice-list">
          {hasCloud&&<button type="button" className="account-choice" onClick={()=>void account.activate("cloud")}>
            <Cloud size={19}/><span><strong>Use cloud library</strong><small>Keep the account's existing data. Your guest copy remains in this browser.</small></span>
          </button>}
          {hasCloud&&<button type="button" className="account-choice" onClick={()=>void account.activate("merge")}>
            <ShieldCheck size={19}/><span><strong>Combine libraries</strong><small>Keep existing cloud games and add your guest games and notes.</small></span>
          </button>}
          <button type="button" className="account-choice" onClick={()=>void account.activate("local")}>
            <LogIn size={19}/><span><strong>{hasCloud?"Replace cloud with guest":"Upload guest library"}</strong>
            <small>{hasCloud?"Replace account data with this browser's library.":"Save this browser's library to your account."}</small></span>
          </button>
        </div>
        {account.error&&<p role="alert" className="field-error">{account.error}</p>}
        <button type="button" className="account-back-to-guest" onClick={()=>void run(account.signOut)}>
          Continue without an account
        </button>
        <p className="muted small">Your guest copy stays in this browser. Back up important data before replacing a cloud library.</p>
      </>;
    }
    if(account.phase==="conflict")return <>
      <p className="account-lead">Cloud sync needs your attention.</p>
      <p role="alert" className="field-error">{account.error || "A newer library was saved elsewhere."}</p>
      <p className="muted small">Your current notes are still on this screen. Download a backup in Preferences before reloading or signing out.</p>
      <button type="button" className="secondary" onClick={()=>void run(account.signOut)}>Sign out</button>
    </>;
    if(account.user&&account.phase==="active")return <>
      <p className="account-lead"><strong>{account.user.email||"Signed in"}</strong></p>
      <div className="account-status"><Cloud size={17}/>
        {account.syncStatus==="saving"?"Saving to cloud…":account.syncStatus==="error"?"Cloud save error":"Cloud library connected"}
      </div>
      {account.error&&<p role="alert" className="field-error">{account.error}</p>}
      {account.notice&&<p className="muted small">{account.notice}</p>}
      <div className="account-actions">
        <button type="button" className="secondary" disabled={busy} onClick={()=>void run(account.flush)}>Save now</button>
        <button type="button" className="secondary" disabled={busy} onClick={()=>void run(account.signOut)}>Sign out</button>
      </div>
    </>;
    return <>
      <p className="account-lead">Save your games and notes across devices. Guest mode stays available.</p>
      {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED==="true"&&<>
        <button type="button" className="account-google" disabled={busy}
          onClick={()=>void run(account.signInGoogle)}>Continue with Google</button>
        <div className="account-or">or use your email</div>
      </>}
      <form onSubmit={e=>{e.preventDefault();void run(()=>account.sendEmail(email));}}>
        <label className="account-email-label" htmlFor="account-email">Email address</label>
        <div className="account-email"><Mail size={17}/>
          <input id="account-email" type="email" required autoComplete="email"
            placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/>
        </div>
        <button type="submit" className="primary account-email-submit" disabled={busy||!email.trim()}>
          {busy?"Sending…":"Email me a sign-in link"}
        </button>
      </form>
      {account.notice&&<p className="account-success" role="status">{account.notice}</p>}
      {message&&<p className="field-error" role="alert">{message}</p>}
      <p className="muted small">No password needed. Only you can access your saved library.</p>
    </>;
  };
  return <div className="modal-backdrop account-backdrop" onMouseDown={e=>{
    if(!blocked&&e.target===e.currentTarget)onClose();
  }}>
    <div className="dialog account-dialog" role="dialog" aria-modal="true" aria-label="Gaming HQ account">
      <div className="dialog-head"><h2>{account.phase==="choose"?"Connect your library":
        account.phase==="active"?"Your account":"Your Gaming HQ account"}</h2>
        {!blocked&&<button type="button" className="icon-button" aria-label="Close account" onClick={onClose}><X size={20}/></button>}
      </div>
      {content()}
    </div>
  </div>;
}
