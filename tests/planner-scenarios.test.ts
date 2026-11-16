import assert from "node:assert/strict";
import { test } from "node:test";
import { SEED_VARIETIES } from "../backend/src/lib/planner/seed-data";
import { createScenarioWeather, WEATHER_SCENARIOS, type WeatherScenarioId } from "../backend/src/lib/planner/scenarios";
import { generateDynamicTimeline, generateTimelineReport, ScheduleReviewError } from "../backend/src/lib/planner/timeline";

const start = "2026-11-01";
const chemical = new Set(["herbicide", "insecticide", "fungicide"]);

test("eight distinct crop plans have unique IDs and a harvest after planting", () => {
  assert.equal(SEED_VARIETIES.length, 8);
  assert.equal(new Set(SEED_VARIETIES.map((seed) => seed.crop)).size, 8);
  assert.equal(new Set(SEED_VARIETIES.map((seed) => seed.id)).size, 8);
  for (const seed of SEED_VARIETIES) {
    assert.equal(new Set(seed.phases.map((phase) => phase.id)).size, seed.phases.length);
    assert.equal(seed.phases[0]?.type, "planting");
    assert.equal(seed.phases[0]?.dayOffset, 0);
    assert.equal(seed.phases.at(-1)?.type, "harvest");
    assert.ok(seed.phases.every((phase) => Number.isSafeInteger(phase.dayOffset) && phase.dayOffset >= 0));
  }
});

test("all 32 crop/weather combinations account for every task and never schedule chemicals in rain", () => {
  for (const seed of SEED_VARIETIES) {
    for (const scenario of WEATHER_SCENARIOS) {
      const report = generateTimelineReport(seed.id, start, { weatherProvider: createScenarioWeather(scenario.id, start) });
      assert.equal(report.tasks.length + report.needsReview.length, seed.phases.length);
      assert.equal(new Set([...report.tasks, ...report.needsReview].map((task) => task.id)).size, seed.phases.length);
      assert.deepEqual(report.tasks.map((task) => task.scheduledDate), report.tasks.map((task) => task.scheduledDate).sort());
      for (const task of report.tasks.filter((task) => chemical.has(task.phase.type))) {
        assert.notEqual(task.forecast.condition, "Rain");
        assert.ok(task.scheduledDate < report.tasks.find((item) => item.phase.type === "harvest")!.scheduledDate);
      }
      if (scenario.id === "dry") {
        assert.equal(report.needsReview.length, 0);
        assert.ok(report.tasks.every((task) => task.delayDays === 0));
      }
    }
  }
});

test("persistent rain preserves planting, observations, and harvest, with no invented application date", () => {
  const report = generateTimelineReport("padi-demo", start, { weatherProvider: createScenarioWeather("persistent-rain", start) });
  assert.deepEqual(report.tasks.map((task) => task.phase.type), ["planting", "monitoring", "harvest"]);
  assert.equal(report.needsReview.length, 2);
  assert.ok(report.needsReview.every((task) => task.reason === "persistent-rain" && !("scheduledDate" in task)));
  assert.ok(report.tasks.every((task) => task.originalDate === task.scheduledDate));
});

test("repeated rain triggers multiple two-day increments for a chili plan", () => {
  const report = generateTimelineReport("cabai-demo", start, { weatherProvider: createScenarioWeather("repeated-rain", start) });
  assert.equal(report.tasks.find((task) => task.phase.type === "fungicide")?.delayDays, 6);
  assert.equal(report.needsReview.length, 0);
});

test("earlier harvest blocks conflicting activities without mutating the crop catalog", () => {
  const before = JSON.stringify(SEED_VARIETIES);
  const report = generateTimelineReport("mentimun-demo", start, { harvestDayOffset: 18, weatherProvider: createScenarioWeather("dry", start) });
  assert.equal(report.tasks.find((task) => task.phase.type === "harvest")?.scheduledDate, "2026-11-19");
  assert.equal(report.needsReview.length, 2);
  assert.ok(report.needsReview.every((task) => task.reason === "harvest-conflict"));
  assert.equal(JSON.stringify(SEED_VARIETIES), before);
  assert.throws(() => generateDynamicTimeline("mentimun-demo", start, { harvestDayOffset: 18, weatherProvider: createScenarioWeather("dry", start) }), ScheduleReviewError);
});

test("dry scenarios and new plans use calendar dates across leap days", () => {
  const report = generateTimelineReport("padi-demo", "2028-02-19", { weatherProvider: createScenarioWeather("dry", "2028-02-19") });
  assert.equal(report.tasks.find((task) => task.phase.type === "monitoring")?.scheduledDate, "2028-02-29");
});

test("invalid scenarios, harvest overrides, and missing weather are rejected", () => {
  assert.throws(() => createScenarioWeather("unknown" as WeatherScenarioId, start), RangeError);
  assert.throws(() => createScenarioWeather("dry", "2026-02-30"), RangeError);
  for (const harvestDayOffset of [0, -1, 2.5, NaN, Infinity]) {
    assert.throws(() => generateTimelineReport("padi-demo", start, { harvestDayOffset }), RangeError);
  }
  assert.throws(() => generateTimelineReport("padi-demo", start, { weatherProvider: () => { throw new Error("Weather unavailable"); } }), /Weather unavailable/);
});
