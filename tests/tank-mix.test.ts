import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateTankMix, TankMixInputError } from "../backend/src/lib/tank-mix/calculate";
import { DEMO_AGRI_PRODUCTS } from "../backend/src/lib/tank-mix/products";
import type { AgriProduct } from "../backend/src/lib/tank-mix/types";

const product = DEMO_AGRI_PRODUCTS[0]!;
function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12, `${actual} != ${expected}`);
}

test("one hectare with a 15 L tank divides both product and water over 14 trips", () => {
  const result = calculateTankMix(1, 15, product);
  assert.equal(result.totalChemicalNeeded, 400);
  assert.equal(result.totalWaterNeeded, 200);
  assert.equal(result.numberOfTanks, 14);
  close(result.dosePerTank, 28.571428571428573);
  close(result.waterPerTank, 14.285714285714286);
});

test("20 L exact fills require ten trips of 40 g and 20 L", () => {
  assert.deepEqual(calculateTankMix(1, 20, product), {
    totalChemicalNeeded: 400, totalWaterNeeded: 200, numberOfTanks: 10,
    doseUnit: "g", dosePerTank: 40, waterPerTank: 20,
  });
});

test("a small plot uses one partial tank", () => {
  const result = calculateTankMix(0.025, 15, product);
  assert.equal(result.numberOfTanks, 1);
  assert.equal(result.waterPerTank, 5);
  assert.equal(result.dosePerTank, 10);
});

test("decimal noise at an exact boundary does not add a trip", () => {
  assert.equal(calculateTankMix(0.07, 14, product).numberOfTanks, 1);
  assert.equal(calculateTankMix(0.07000001, 14, product).numberOfTanks, 2);
});

test("product/water totals and concentration are conserved without exceeding capacity", () => {
  for (const area of [0.01, 0.07, 0.1, 0.5, 1, 2.75, 100]) {
    for (const capacity of [7.5, 14, 15, 20, 1000]) {
      const result = calculateTankMix(area, capacity, product);
      close(result.dosePerTank * result.numberOfTanks, result.totalChemicalNeeded);
      close(result.waterPerTank * result.numberOfTanks, result.totalWaterNeeded);
      close(result.dosePerTank / result.waterPerTank, 2);
      assert.ok(result.waterPerTank <= capacity + 1e-12);
    }
  }
});

test("zero, negative, non-finite, and nonnumeric inputs are rejected with their field", () => {
  for (const value of [0, -1, NaN, Infinity, -Infinity, "1", null, undefined]) {
    assert.throws(() => calculateTankMix(value as number, 15, product),
      (error: unknown) => error instanceof TankMixInputError && error.field === "area");
    assert.throws(() => calculateTankMix(1, value as number, product),
      (error: unknown) => error instanceof TankMixInputError && error.field === "tankCapacity");
  }
});

test("invalid product specs are rejected", () => {
  for (const invalid of [null, {}, { ...product, doseUnit: "kg" }, { ...product, id: "" },
    { ...product, dosePerHectare: 0 }, { ...product, waterVolumePerHectare: -1 },
    { ...product, dosePerHectare: Infinity }, { ...product, waterVolumePerHectare: NaN }]) {
    assert.throws(() => calculateTankMix(1, 15, invalid as AgriProduct), TankMixInputError);
  }
});

test("numeric overflow, unsafe trip counts and underflow are rejected", () => {
  assert.throws(() => calculateTankMix(Number.MAX_VALUE, 15, product), RangeError);
  assert.throws(() => calculateTankMix(1, Number.MIN_VALUE, product), RangeError);
  assert.throws(() => calculateTankMix(Number.MIN_VALUE, 15,
    { ...product, dosePerHectare: Number.MIN_VALUE }), RangeError);
});

test("calculation supports a liquid unit and does not mutate supplied specs", () => {
  const liquid: AgriProduct = Object.freeze({ ...product, doseUnit: "ml", dosePerHectare: 600 });
  const before = JSON.stringify(liquid);
  const result = calculateTankMix(0.5, 20, liquid);
  assert.equal(result.doseUnit, "ml");
  assert.equal(result.dosePerTank, 60);
  assert.equal(JSON.stringify(liquid), before);
  assert.deepEqual(result, calculateTankMix(0.5, 20, liquid));
});
