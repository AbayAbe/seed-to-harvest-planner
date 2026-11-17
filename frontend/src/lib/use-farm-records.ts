"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CashEntry, DiseaseLog, FarmRecords, Lahan, ProductPrice } from "@agri/contracts";
import { readWorkspace, writeWorkspace } from "./workspace-store";
import { requestApi } from "./api";
import { emptyRecords } from "../../../backend/src/records/domain";

const local=process.env.NEXT_PUBLIC_DEMO_STATIC==="true";
export function useFarmRecords(){
  const saving=useRef(false);
  const [farms,setFarms]=useState<Lahan[]>([]),[data,setData]=useState<FarmRecords>(emptyRecords);
  const [error,setError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const load=useCallback(async()=>{setError("");try{
    if(local){const w=readWorkspace();setFarms(w.farms);setData(w.records);}
    else{const [f,r]=await Promise.all([requestApi<{lahan:Lahan[]}>("lahan"),requestApi<FarmRecords>("records")]);setFarms(f.lahan);setData(r);}
  }catch(e){setError(e instanceof Error?e.message:"Data belum dapat dibaca.");}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();const listener=()=>void load();window.addEventListener("storage",listener);return()=>window.removeEventListener("storage",listener);},[load]);
  async function save(kind:"prices"|"cash"|"diseases",item:ProductPrice|CashEntry|DiseaseLog){
    if(saving.current)return false;saving.current=true;setBusy(true);setError("");setMessage("");
    try{
      if(local){const w=readWorkspace();const list=w.records[kind] as (ProductPrice|CashEntry|DiseaseLog)[];
        const updated={...w.records,[kind]:[...list.filter(x=>x.id!==item.id),item]};writeWorkspace({...w,records:updated});}
      else { let payload:unknown=item;if(kind==="cash"){const c=item as CashEntry;payload={...c,productId:c.usage?.product.id,quantity:c.usage?.quantity};}await requestApi(`records/${kind}`,JSON.stringify(payload));}
      await load();setMessage("Catatan berhasil disimpan.");return true;
    }catch(e){setError(e instanceof Error?e.message:"Catatan belum tersimpan.");return false;}finally{saving.current=false;setBusy(false);}
  }
  return {farms,data,error,loading,busy,message,save,retry:load,local};
}
