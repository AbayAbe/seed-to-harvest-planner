import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import type { ClinicAnalysis, ClinicResult } from "@agri/contracts";
import { createClinicApp } from "../backend/src/clinic/router";
import { matchCatalog, ClinicError, createVisionAnalyzer, type VisionAnalyzer } from "../backend/src/clinic/service";

const observation: ClinicAnalysis = { status: "suspected", observedCrop: "tomat", diseaseCode: "tomato_early_blight", diseaseName: "Dugaan bercak kering", cause: "Perlu konfirmasi", evidence: ["Bercak daun"], confidence: "high", nextStep: "Periksa bersama penyuluh." };
async function withServer(analyze: VisionAnalyzer, run: (url: string) => Promise<void>) {
  const server = createServer(createClinicApp(["https://example.com"], analyze));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/clinic/identify`); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
async function photo() { return sharp({ create: { width: 20, height: 20, channels: 3, background: "green" } }).png().toBuffer(); }
function form(buffer: Buffer, crop = "tomat", tank = "16") {
  const data = new FormData(); data.set("image", new Blob([new Uint8Array(buffer)], { type: "image/png" }), "leaf.png"); data.set("crop", crop); data.set("tankLiters", tank); return data;
}
test("catalog computes units and refuses uncertainty, mismatched crops and unknown diseases", () => {
  const result = matchCatalog(observation, "tomat", 16);
  assert.equal(result.product?.dosePerTank, 32);
  assert.equal(result.product?.unit, "ml");
  assert.equal(result.product?.catalogMode, "dummy");
  assert.equal(matchCatalog({ ...observation, confidence: "low" }, "tomat", 16).product, null);
  assert.equal(matchCatalog({ ...observation, status: "healthy" }, "tomat", 16).product, null);
  assert.equal(matchCatalog(observation, "padi", 16).product, null);
  assert.equal(matchCatalog({ ...observation, diseaseCode: "other" }, "tomat", 16).product, null);
  assert.throws(() => matchCatalog(observation, "tomat", 0));
});
test("multipart photo is decoded, sanitized and sent to injected Vision analyzer", async () => {
  let calls = 0;
  await withServer(async (image, crop) => {
    calls++; assert.equal(crop, "tomat"); const metadata = await sharp(image).metadata();
    assert.equal(metadata.format, "jpeg"); assert.equal(metadata.exif, undefined);
    return observation;
  }, async url => {
    const response = await fetch(url, { method: "POST", body: form(await photo()), headers: { Origin: "https://example.com" } });
    assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "https://example.com");
    const result = await response.json() as ClinicResult;
    assert.equal(result.product?.dosePerTank, 32); assert.equal(calls, 1);
  });
});
test("invalid bytes, oversize, missing image, duplicate files, wrong crop and denied origin never reach AI", async () => {
  await withServer(async () => { assert.fail("AI must not be called"); }, async url => {
    let r = await fetch(url, { method: "POST", body: form(Buffer.from("not a photo")) }); assert.equal(r.status, 415);
    r = await fetch(url, { method: "POST", body: form(Buffer.alloc(5 * 1024 * 1024 + 1)) }); assert.equal(r.status, 413);
    const empty = new FormData(); empty.set("crop", "tomat"); empty.set("tankLiters", "16");
    r = await fetch(url, { method: "POST", body: empty }); assert.equal(r.status, 400);
    r = await fetch(url, { method: "POST", body: form(await photo(), "bad") }); assert.equal(r.status, 400);
    r = await fetch(url, { method: "POST", body: form(await photo(), "tomat", "-1") }); assert.equal(r.status, 400);
    const duplicate = form(await photo()); duplicate.append("image", new Blob([new Uint8Array(await photo())], { type: "image/png" }), "second.png");
    r = await fetch(url, { method: "POST", body: duplicate }); assert.equal(r.status, 400);
    r = await fetch(url, { method: "POST", body: form(await photo()), headers: { Origin: "https://evil.example" } }); assert.equal(r.status, 403);
    r = await fetch(url, { method: "OPTIONS", headers: { Origin: "https://example.com" } }); assert.equal(r.status, 204);
  });
});
test("malformed AI response and provider error return safe JSON without internal errors", async () => {
  await withServer(async () => ({ garbage: true } as unknown as ClinicAnalysis), async url => {
    const r = await fetch(url, { method: "POST", body: form(await photo()) }); assert.equal(r.status, 502);
    assert.equal((await r.json()).error.code, "CLINIC_FAILED");
  });
  await withServer(async () => { throw new ClinicError(504, "AI_TIMEOUT", "Analisis terlalu lama."); }, async url => {
    const r = await fetch(url, { method: "POST", body: form(await photo()) }); assert.equal(r.status, 504);
  });
  await withServer(async () => { throw new Error("secret-key-must-not-leak"); }, async url => {
    const r = await fetch(url, { method: "POST", body: form(await photo()) }); assert.equal(r.status, 502);
    assert.ok(!(await r.text()).includes("secret-key"));
  });
});
test("unconfigured provider fails without sending the photo", async () => {
  const old = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  try { await assert.rejects(createVisionAnalyzer()(Buffer.alloc(0), "tomat", new AbortController().signal), (e: unknown) => e instanceof ClinicError && e.status === 503); }
  finally { if (old !== undefined) process.env.OPENAI_API_KEY = old; }
});
