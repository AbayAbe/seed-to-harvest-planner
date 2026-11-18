"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

interface ScannerControls { stop: () => void }

/** Camera exists only while this component is mounted. Decoding stays on-device. */
export default function CodeScanner({ onRead, onClose }: {
  onRead: (value: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const read = useRef(onRead);
  read.current = onRead;
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let found = false;
    let controls: ScannerControls | undefined;
    let stream: MediaStream | undefined;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
        if (cancelled || !video.current) { stream.getTracks().forEach(track => track.stop()); return; }
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 400 });
        controls = await reader.decodeFromStream(stream, video.current, (result, _error, activeControls) => {
          if (!result || found || cancelled) return;
          found = true;
          activeControls.stop();
          stream?.getTracks().forEach(track => track.stop());
          read.current(result.getText());
        });
        if (cancelled || found) controls.stop();
        else setReady(true);
      } catch (cause) {
        stream?.getTracks().forEach(track => track.stop());
        if (!cancelled) setError(cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Izin kamera belum diberikan. Izinkan kamera di browser, unggah gambar kode, atau ketik kode secara manual."
          : "Kamera belum bisa dibuka. Coba unggah gambar kode atau masukkan kode secara manual.");
      }
    }
    void start();
    return () => { cancelled = true; controls?.stop(); stream?.getTracks().forEach(track => track.stop()); };
  }, []);

  return <section aria-label="Pemindai kode produk" className="reward-camera">
    <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold"><Camera size={20}/>Kamera pemindai</h3><button type="button" className="reward-small-button" onClick={onClose}><X size={18}/>Tutup kamera</button></div>
    <div className="reward-camera-frame"><video ref={video} muted playsInline autoPlay className="h-full w-full object-cover"/><span aria-hidden="true" className="reward-camera-guide"/></div>
    {error ? <p role="alert" className="error-message mt-3">{error}</p> : <p role="status" className="mt-3 text-sm leading-6">{ready ? "Arahkan kode ke dalam bingkai. Hindari pantulan cahaya dan tahan kamera sebentar." : "Menyiapkan kamera…"}</p>}
  </section>;
}
