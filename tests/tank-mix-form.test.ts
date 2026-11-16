import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_TANK_MIX, evaluateTankMix } from "../backend/src/lib/tank-mix/form";
import { formatApproximate, parseDecimal } from "../frontend/src/lib/tank-mix/form";

test("blank form explains all missing inputs without generating a recipe", () => {
  const state = evaluateTankMix(EMPTY_TANK_MIX);
  assert.equal(state.result, null);
  assert.deepEqual(Object.keys(state.errors).sort(), ["area", "capacity", "dose", "productId", "water"]);
});

test("manual Indonesian decimal inputs produce the expected recipe", () => {
  const state = evaluateTankMix({ productId: "nativo", area: "0,5", capacity: "20", dose: "400", water: "200" });
  assert.deepEqual(state.errors, {});
  assert.equal(state.result?.numberOfTanks, 5);
  assert.equal(state.result?.dosePerTank, 40);
});

test("invalid, grouped and overflowing values never produce a recipe", () => {
  for (const area of ["0", "-1", "abc", "1.000,5", "Infinity", "1e5"]) {
    const state = evaluateTankMix({ productId: "decis", area, capacity: "15", dose: "400", water: "200" });
    assert.equal(state.result, null);
    assert.ok(state.errors.area);
  }
  const overflow = evaluateTankMix({ productId: "nativo", area: "9".repeat(300), capacity: "1", dose: "999999999999", water: "999999999999" });
  assert.equal(overflow.result, null);
  assert.ok(overflow.errors.general);
});

test("rounding is marked as approximate and tiny quantities do not display as zero", () => {
  assert.equal(formatApproximate(400 / 14), "≈ 28,57");
  assert.equal(formatApproximate(40), "40");
  assert.equal(formatApproximate(0.0004), "0,0004");
  assert.equal(parseDecimal(" .5 "), 0.5);
});
