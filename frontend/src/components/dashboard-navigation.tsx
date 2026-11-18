"use client";
import { createContext, useContext, type ReactNode } from "react";
export type DashboardView = "lahan" | "timeline" | "tank-mix" | "klinik" | "keuangan" | "riwayat" | "panduan" | "undian";
export interface ProductSelection { productId: string; view: DashboardView; token: number }
export const DashboardNavigation = createContext<{
  view:DashboardView;
  navigate:(view:DashboardView)=>void;
  selection:ProductSelection|null;
  chooseProduct:(productId:string,view:DashboardView)=>void;
}|null>(null);
export const useDashboardNavigation = () => useContext(DashboardNavigation);
export function DashboardLink({to,children,className}:{to:DashboardView;children:ReactNode;className?:string}) {
  const nav=useDashboardNavigation();
  return nav?<button type="button" className={className} onClick={()=>nav.navigate(to)}>{children}</button>:<a className={className} href={to==="lahan"?"../":`../${to}/`}>{children}</a>;
}
