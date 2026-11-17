"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Beaker, Check, Droplets, FlaskConical, Info, RotateCcw, Scale } from "lucide-react";
import type { FormErrors, ProductCatalogItem, TankMixResult } from "@agri/contracts";
import { ApiError, requestApi } from "../lib/api";
import { EMPTY_TANK_MIX, parseDecimal, validateTankMix, formatApproximate, formatQuantity, type TankMixForm } from "../lib/tank-mix/form";

import AnimatedTank from "./micro-interactions/AnimatedTank";
import { ProductReference } from "./bayer-reference";
import { useDashboardNavigation } from "./dashboard-navigation";

export default function KalkulatorDosis({ products: PRODUCT_CATALOG, luasAwal = null }: { products: readonly ProductCatalogItem[]; luasAwal?: number | null }) {
  const navigation = useDashboardNavigation();
  const uid = useId();
  const [form, setForm] = useState<TankMixForm>({ ...EMPTY_TANK_MIX, area: luasAwal === null ? "" : String(luasAwal) });
  const [attempted, setAttempted] = useState(false);
  const [result, setResult] = useState<TankMixResult | null>(null);
  const [pending, setPending] = useState(false);
  const [serverErrors, setServerErrors] = useState<FormErrors>({});
  const requestRef = useRef<AbortController | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof TankMixForm, boolean>>>({});
  const resultRef = useRef<HTMLDivElement>(null);
  const product = PRODUCT_CATALOG.find((item) => item.id === form.productId);
  const localErrors = useMemo(() => validateTankMix(form, PRODUCT_CATALOG), [form, PRODUCT_CATALOG]);
  const evaluation = { errors: { ...localErrors, ...serverErrors } };
  const completed = (Object.keys(EMPTY_TANK_MIX) as (keyof TankMixForm)[]).filter((key) => !evaluation.errors[key]).length;
  const unit = product?.unit === "ml" ? "ml" : "gram";

  useEffect(() => {
    if (result) resultRef.current?.focus({ preventScroll: false });
  }, [result]);
  useEffect(() => () => requestRef.current?.abort(), []);

  function invalidateResult() {
    requestRef.current?.abort();
    setResult(null);
    setPending(false);
    setServerErrors({});
  }

  useEffect(() => {
    const selection=navigation?.selection;
    if(selection?.view!=="tank-mix"||!PRODUCT_CATALOG.some(p=>p.id===selection.productId))return;
    setForm(current=>({...current,productId:selection.productId,dose:"",water:""}));
    requestRef.current?.abort();setResult(null);setPending(false);setServerErrors({});setAttempted(false);setTouched({});
  },[navigation?.selection,PRODUCT_CATALOG]);

  function change(key: keyof TankMixForm, value: string) {
    setForm((current) => key === "productId"
      ? { ...current, productId: value, dose: "", water: "" }
      : { ...current, [key]: value });
    invalidateResult();
    if (key === "productId") { setAttempted(false); setTouched({}); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    const formElement = event.currentTarget;
    invalidateResult();
    if (Object.keys(localErrors).length) {
      const invalidKey = (Object.keys(EMPTY_TANK_MIX) as (keyof TankMixForm)[]).find((key) => localErrors[key]);
      if (invalidKey) (formElement.elements.namedItem(invalidKey) as HTMLInputElement | HTMLSelectElement | null)?.focus();
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    try {
      const recipe = await requestApi<TankMixResult>("tank-mix", JSON.stringify(form), controller.signal);
      if (!controller.signal.aborted) { setResult(recipe); setHasCalculated(true); }
    } catch (error) {
      if (!controller.signal.aborted) {
        const errors = error instanceof ApiError && error.fields
          ? error.fields : { general: error instanceof Error ? error.message : "Perhitungan belum berhasil. Coba lagi." };
        setServerErrors(errors);
        const invalidKey = (Object.keys(EMPTY_TANK_MIX) as (keyof TankMixForm)[]).find((key) => errors[key]);
        if (invalidKey) (formElement.elements.namedItem(invalidKey) as HTMLInputElement | HTMLSelectElement | null)?.focus();
      }
    } finally {
      if (requestRef.current === controller) setPending(false);
    }
  }

  function reset() {
    invalidateResult();
    setForm({ ...EMPTY_TANK_MIX }); setAttempted(false); setHasCalculated(false); setTouched({});
  }

  function input(key: "area" | "capacity" | "dose" | "water", label: string, suffix: string, placeholder: string) {
    const error = attempted || touched[key] ? evaluation.errors[key] : undefined;
    const disabled = (key === "dose" || key === "water") && !product;
    return <div><label className="field-label" htmlFor={`${uid}-${key}`}>{label}</label><div className="input-with-unit"><input name={key} id={`${uid}-${key}`} type="text" inputMode="decimal" autoComplete="off" value={form[key]} disabled={disabled} onChange={(event) => change(key, event.target.value)} onBlur={() => setTouched((current) => ({ ...current, [key]: true }))} placeholder={placeholder} aria-invalid={!!error} aria-describedby={error ? `${uid}-${key}-error` : `${uid}-number-help`} className="field-input" /><span aria-hidden="true">{suffix}</span></div><span className="sr-only">Satuan {suffix}</span>{error && <p id={`${uid}-${key}-error`} className="field-error">{error}</p>}</div>;
  }

  return <div className="calculator-grid">
    <form noValidate onSubmit={submit} className="surface mix-form">
      <div className="form-heading"><div><p className="section-kicker">RINCIAN PENYEMPROTAN</p><h2>Mulai dengan kebutuhan Anda</h2></div><span className="form-counter">{completed}/5 terisi</span></div>
      <fieldset className="form-section"><legend><span className="step-number">01</span> Pilih produk</legend><label className="field-label sr-only" htmlFor={`${uid}-productId`}>Produk Bayer</label><select name="productId" id={`${uid}-productId`} className="field-input" value={form.productId} onChange={(event) => change("productId", event.target.value)} aria-invalid={attempted && !!evaluation.errors.productId} aria-describedby={attempted && evaluation.errors.productId ? `${uid}-product-error` : undefined}><option value="">Pilih produk Bayer…</option>{["Fungisida", "Insektisida", "Herbisida"].map((category) => <optgroup label={category} key={category}>{PRODUCT_CATALOG.filter((item) => item.category === category).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select>{attempted && evaluation.errors.productId && <p id={`${uid}-product-error`} className="field-error">{evaluation.errors.productId}</p>}
        {product && <div className="selected-product"><span className="badge badge-green">{product.category}</span><a className="reference-link" href={product.source} target="_blank" rel="noreferrer">Informasi Bayer <ArrowUpRight size={16}/><span className="sr-only"> (buka tab baru)</span></a></div>}
        {product && <ProductReference productId={product.id}/>}
      </fieldset>
      <fieldset className="form-section"><legend><span className="step-number">02</span> Lahan & tangki</legend><div className="grid gap-5 sm:grid-cols-2">{input("area", "Luas lahan (hektare)", "ha", "Contoh: 1")}{input("capacity", "Kapasitas tangki (liter)", "L", "Contoh: 15")}</div><p id={`${uid}-number-help`} className="field-help">Koma atau titik boleh: 0,5 = setengah hektare. Tanpa pemisah ribuan.</p></fieldset>
      <fieldset className="form-section"><legend><span className="step-number">03</span> Takaran pada label</legend><div className="label-guidance"><Info size={18}/><p>Gunakan dosis untuk <strong>tanaman dan sasaran yang sesuai</strong>. Kalkulator ini menerima dosis per hektare. Jika label memakai dosis per liter, tanyakan konversinya kepada petugas pertanian.</p></div><div className="mt-5 grid gap-5 sm:grid-cols-2">{input("dose", `Dosis produk (${unit}/ha)`, `${unit}/ha`, product ? "Dari label" : "Pilih produk dulu")}{input("water", "Air per hektare (liter/ha)", "L/ha", product ? "Sesuai petunjuk" : "Pilih produk dulu")}</div><p className="field-help">Produk diganti → takaran dikosongkan agar tidak tertukar.</p></fieldset>
      {attempted && evaluation.errors.general && <p role="alert" className="error-message mb-4">{evaluation.errors.general}</p>}
      <div className="form-actions"><button type="submit" className="primary-button" disabled={pending}><FlaskConical size={20}/> {pending ? "Sedang menghitung…" : "Hitung campuran"} <ArrowRight size={19}/></button><button type="button" className="reset-button" onClick={reset} aria-label="Kosongkan semua isian"><RotateCcw size={18}/><span>Kosongkan</span></button></div>
    </form>

    <div className="result-column">
      <AnimatedTank fillPercentage={result ? result.waterPerTank / parseDecimal(form.capacity) * 100 : 0} label={result ? "Isi air setiap pengisian tangki" : "Tangki menunggu hasil perhitungan"} className="mb-5"/>
      <div ref={resultRef} tabIndex={-1} className={`mix-result ${result ? "has-result" : ""}`} aria-label="Hasil perhitungan" aria-busy={pending}>
        <div className="result-header"><span className="light-eyebrow">RESEP PER TANGKI</span><Beaker size={23}/></div>
        {result ? <div><p className="result-product">{product?.name}</p><div className="recipe-amount"><FlaskConical size={22}/><p><strong>{formatApproximate(result.dosePerTank)}</strong><span>{unit} obat</span></p></div><div className="recipe-divider"><span/>dicampur dengan<span/></div><div className="recipe-amount"><Droplets size={22}/><p><strong>{formatApproximate(result.waterPerTank)}</strong><span>liter air</span></p></div><div className="repeat-callout"><span>{formatQuantity(result.numberOfTanks)}×</span><p>pengisian tangki<br/><strong>dengan takaran yang sama</strong></p></div><p className="result-explanation">Tangki {form.capacity} liter tidak harus diisi penuh. Gunakan jumlah air di atas agar total campuran tetap sesuai.</p></div> : <div className="result-empty"><div className="empty-beaker"><Beaker size={55} strokeWidth={1}/><Droplets size={23}/></div><h2>{pending ? "Sedang menghitung…" : hasCalculated ? "Angka berubah." : "Resep Anda, di sini."}</h2><p>{pending ? "Tunggu sebentar. Takaran Anda sedang dihitung." : hasCalculated ? "Tekan Hitung campuran untuk memperbarui hasil dengan angka yang baru." : "Isi rincian di samping, lalu tekan Hitung campuran untuk melihat takaran setiap tangki."}</p><div className="result-progress" aria-label={`${completed} dari 5 isian lengkap`}>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= completed ? "filled" : ""}/>)}</div><small>{completed} dari 5 isian lengkap</small></div>}
      </div>
      {result && <><button type="button" className="primary-button w-full mb-4" onClick={() => { try { sessionStorage.setItem("cyphera:cash-draft", JSON.stringify({ name: product?.name, unit: result.doseUnit, quantity: Number(result.totalChemicalNeeded.toFixed(3)) })); if (navigation) navigation.navigate("keuangan"); else window.location.assign("./keuangan/"); } catch { setServerErrors({ general: "Belum bisa membawa hasil. Buka Buku Kas dan masukkan total pemakaian secara manual." }); } }}>Catat biaya di Buku Kas <ArrowUpRight size={20}/></button><div className="total-cards"><div className="surface"><Scale size={19}/><span>Total obat</span><strong>{formatApproximate(result.totalChemicalNeeded)} <small>{unit}</small></strong></div><div className="surface"><Droplets size={19}/><span>Total air</span><strong>{formatApproximate(result.totalWaterNeeded)} <small>liter</small></strong></div></div><p className="result-footnote">≈ berarti pembulatan tampilan. Total obat adalah kebutuhan bahan, bukan jumlah kemasan.</p></>}
      <div className="mix-tip"><span className="tip-icon"><Check size={19}/></span><div><h3>Satu produk, satu perhitungan.</h3><p>Hasil mengikuti angka yang Anda masukkan. Pastikan sesuai label produk; kalkulator tidak menentukan kecocokan obat untuk tanaman.</p></div></div>
    </div>
    <p role="status" className="sr-only">{result ? `Hasil: ${formatApproximate(result.dosePerTank)} ${unit} obat dan ${formatApproximate(result.waterPerTank)} liter air per pengisian. ${result.numberOfTanks} pengisian.` : pending ? "Sedang menghitung campuran." : "Hasil belum dihitung."}</p>
  </div>;
}
