import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { CatalogResponse, TimelineReport, TankMixResult, ApiErrorResponse } from "@agri/contracts";
import { createApiServer } from "../backend/src/app";

const server = createApiServer();
let base: string;
before(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
const example = { productId: "nativo", area: "1", capacity: "15", dose: "400", water: "200" };
const plan = { seedId: "padi-demo", startDate: "2026-11-01", scenario: "persistent-rain", harvestDayOffset: 110 };
function post(path: string, data: unknown) {
  return fetch(`${base}/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

test("independent backend serves health and the complete catalog", async () => {
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).service, "agri-backend");
  const response = await fetch(`${base}/api/catalog`);
  const catalog: CatalogResponse = await response.json();
  assert.equal(catalog.seeds.length, 8);
  assert.equal(catalog.products.length, 22);
  assert.equal(catalog.scenarios.length, 4);
  assert.equal(catalog.products.find((item) => item.id === "nativo")?.unit, "g");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("HTTP timeline retains manual reviews and calculates rain delays", async () => {
  const rain = await post("timeline", plan);
  assert.equal(rain.status, 200);
  const report: TimelineReport = await rain.json();
  assert.equal(report.tasks.length, 3);
  assert.equal(report.needsReview.length, 2);
  assert.ok(report.needsReview.every((item) => item.reason === "persistent-rain" && !("scheduledDate" in item)));
  const mixed = await post("timeline", { ...plan, seedId: "dekalb-dk771-corn", scenario: "mixed", harvestDayOffset: 100 });
  const result: TimelineReport = await mixed.json();
  assert.equal(result.tasks.find((task) => task.phase.type === "herbicide")?.scheduledDate, "2026-11-18");
});

test("HTTP tank mix computes equal water fills, decimal commas, and ml units", async () => {
  const response = await post("tank-mix", example);
  assert.equal(response.status, 200);
  const result: TankMixResult = await response.json();
  assert.equal(result.numberOfTanks, 14);
  assert.equal(result.dosePerTank, 400 / 14);
  assert.equal(result.waterPerTank, 200 / 14);
  const decimal: TankMixResult = await (await post("tank-mix", { ...example, productId: "decis", area: "0,5", capacity: "20" })).json();
  assert.equal(decimal.numberOfTanks, 5);
  assert.equal(decimal.doseUnit, "ml");
});

test("direct API callers cannot bypass input and domain validation", async () => {
  for (const body of [{ ...example, area: "0" }, { ...example, capacity: "-1" }, { ...example, dose: "Infinity" }, { ...example, productId: "unknown" }, { ...example, area: "9".repeat(300), water: "999999999999" }]) {
    const response = await post("tank-mix", body);
    assert.equal(response.status, 400);
    const error: ApiErrorResponse = await response.json();
    assert.equal(error.error.code, "VALIDATION_ERROR");
    assert.ok(error.error.fields);
    assert.ok(!("result" in error));
  }
  for (const body of [{ ...plan, seedId: "unknown" }, { ...plan, startDate: "2026-02-30" }, { ...plan, harvestDayOffset: 0 }, { ...plan, scenario: "live" }, { ...plan, harvestDayOffset: 1e15 }]) {
    assert.equal((await post("timeline", body)).status, 400);
  }
  assert.equal((await post("tank-mix", { ...example, area: 1 })).status, 400);
  assert.equal((await post("tank-mix", { ...example, doseUnit: "ml" })).status, 400);
});

test("HTTP boundary rejects malformed, oversized, and unsupported requests", async () => {
  for (const raw of ["{", "null", "[]"]) {
    assert.equal((await fetch(`${base}/api/tank-mix`, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw })).status, 400);
  }
  assert.equal((await post("tank-mix", { ...example, area: "1".repeat(20_000) })).status, 413);
  assert.equal((await fetch(`${base}/api/tank-mix`, { method: "POST", body: "{}" })).status, 415);
  const wrongMethod = await fetch(`${base}/api/timeline`);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "POST");
  assert.equal((await fetch(`${base}/api/missing`)).status, 404);
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
});

test("native API delegates clinic multipart requests to Express", async () => {
  const data = new FormData(); data.set("crop", "tomat"); data.set("tankLiters", "16");
  const response = await fetch(`${base}/api/clinic/identify`, { method: "POST", body: data });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "FARM_REQUIRED");
});
