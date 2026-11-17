"use client";
import {createContext,useContext} from "react";
import {Bookmark,Scale} from "lucide-react";
const button="inline-flex min-h-[64px] items-center justify-center gap-2 rounded-xl border border-emerald-800 px-4 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4";
export type PocketContextValue={saved:string[];toggle:(id:string)=>void;compared:string[];compare:(id:string)=>void;ready:boolean};
export const PocketContext=createContext<PocketContextValue|null>(null);
export function PocketProductActions({id}:{id:string}) {
  const ctx=useContext(PocketContext);
  if(!ctx)return null;
  return <div className="flex flex-wrap gap-2 border-t border-slate-200 p-4"><SaveButton id={`product:${id}`}/><button type="button" className={button} aria-pressed={ctx.compared.includes(id)} disabled={!ctx.compared.includes(id)&&ctx.compared.length>=3} onClick={()=>ctx.compare(id)}><Scale size={18}/>{ctx.compared.includes(id)?"Hapus pembanding":"Bandingkan"}</button></div>;
}
export function SaveButton({id}:{id:string}) {
  const ctx=useContext(PocketContext);
  if(!ctx)return null;
  const active=ctx.saved.includes(id);
  return <button type="button" className={`${button} ${active?"bg-emerald-900 text-white":"bg-white text-emerald-950"}`} disabled={!ctx.ready} aria-pressed={active} onClick={()=>ctx.toggle(id)}><Bookmark size={18} fill={active?"currentColor":"none"}/>{active?"Tersimpan":"Simpan"}</button>;
}
