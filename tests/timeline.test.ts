import assert from "node:assert/strict";
import { test } from "node:test";
import { SEED_VARIETIES } from "../backend/src/lib/planner/seed-data";
import {
  generateDynamicTimeline,
  MAX_RAIN_RESCHEDULES,
} from "../backend/src/lib/planner/timeline";
import type {
  CalendarDate,
  WeatherForecastProvider,
} from "../backend/src/lib/planner/types";
import { getMockWeatherForecast } from "../backend/src/lib/planner/weather";

const SEED_ID = "dekalb-dk771-corn";

function forecastWithRainOn(...dates: CalendarDate[]): WeatherForecastProvider {
  const rainyDates = new Set(dates);
  return (date) => ({
    date,
    condition: rainyDates.has(date) ? "Rain" : "Clear",
    source: "mock",
  });
}

test("clear weather keeps all five lifecycle dates anchored to planting", () => {
  const tasks = generateDynamicTimeline(SEED_ID, "2026-11-01", {
    weatherProvider: forecastWithRainOn(),
  });

  assert.deepEqual(tasks.map((task) => task.scheduledDate), [
    "2026-11-01", "2026-11-16", "2026-12-16", "2026-12-31", "2027-02-09",
  ]);
  for (const task of tasks) {
    assert.equal(task.scheduledDate, task.originalDate);
    assert.equal(task.status, "scheduled");
    assert.equal(task.delayDays, 0);
    assert.equal(task.warning, null);
    assert.equal(task.forecast.date, task.scheduledDate);
  }
});

test("each chemical category is delayed by two days without shifting other tasks", () => {
  for (const rainyDate of ["2026-11-16", "2026-12-16", "2026-12-31"]) {
    const tasks = generateDynamicTimeline(SEED_ID, "2026-11-01", {
      weatherProvider: forecastWithRainOn(rainyDate),
    });
    const delayed = tasks.filter((task) => task.status === "rescheduled");

    assert.equal(delayed.length, 1);
    const task = delayed[0]!;
    assert.equal(task.originalDate, rainyDate);
    assert.equal(task.delayDays, 2);
    assert.equal(task.warning, "Delayed due to rain risk");
    assert.equal(task.originalForecast.condition, "Rain");
    assert.equal(task.forecast.condition, "Clear");
    assert.equal(task.forecast.date, task.scheduledDate);
    for (const unchanged of tasks.filter((item) => item !== task)) {
      assert.equal(unchanged.scheduledDate, unchanged.originalDate);
    }
  }
});

test("planting stays on Day 0 even during rain", () => {
  const tasks = generateDynamicTimeline(SEED_ID, "2026-11-01", {
    weatherProvider: forecastWithRainOn("2026-11-01"),
  });
  assert.equal(tasks[0]!.scheduledDate, "2026-11-01");
  assert.equal(tasks[0]!.forecast.condition, "Rain");
  assert.equal(tasks[0]!.status, "scheduled");
  assert.equal(tasks[0]!.warning, null);
});

test("a rainy postponed date is checked again in another two-day increment", () => {
  const tasks = generateDynamicTimeline(SEED_ID, "2026-11-01", {
    weatherProvider: forecastWithRainOn("2026-11-16", "2026-11-18"),
  });
  const herbicide = tasks.find((task) => task.phase.type === "herbicide")!;
  assert.equal(herbicide.scheduledDate, "2026-11-20");
  assert.equal(herbicide.delayDays, 4);
  assert.equal(herbicide.forecast.condition, "Clear");
});

test("persistent rain terminates instead of returning a chemical task in rain", () => {
  let calls = 0;
  assert.throws(() => generateDynamicTimeline(SEED_ID, "2026-11-01", {
    weatherProvider: (date) => {
      calls += 1;
      return { date, condition: "Rain", source: "mock" };
    },
  }), /Manual review is required/);
  // One planting forecast, one original herbicide forecast, seven retries.
  assert.equal(calls, MAX_RAIN_RESCHEDULES + 2);
});

test("a dry date on the final allowed retry is accepted", () => {
  let herbicideForecasts = 0;
  const tasks = generateDynamicTimeline(SEED_ID, "2026-11-01", {
    weatherProvider: (date) => {
      if (date >= "2026-11-16" && date <= "2026-11-30") {
        herbicideForecasts += 1;
        return { date, condition: date === "2026-11-30" ? "Clear" : "Rain", source: "mock" };
      }
      return { date, condition: "Clear", source: "mock" };
    },
  });
  const herbicide = tasks.find((task) => task.phase.type === "herbicide")!;
  assert.equal(herbicideForecasts, 8);
  assert.equal(herbicide.delayDays, 14);
  assert.equal(herbicide.scheduledDate, "2026-11-30");
});

test("the deterministic mock provides the expected end-to-end example", () => {
  const tasks = generateDynamicTimeline(SEED_ID, "2026-11-01");
  assert.deepEqual(tasks.map((task) => task.scheduledDate), [
    "2026-11-01", "2026-11-18", "2026-12-16", "2027-01-02", "2027-02-09",
  ]);
  assert.deepEqual(tasks.map((task) => task.delayDays), [0, 2, 0, 2, 0]);
  assert.deepEqual(getMockWeatherForecast("2026-11-16"), {
    date: "2026-11-16", condition: "Rain", source: "mock",
  });
  assert.deepEqual(tasks, generateDynamicTimeline(SEED_ID, "2026-11-01"));
});

test("leap days and month boundaries use calendar-day arithmetic", () => {
  const tasks = generateDynamicTimeline(SEED_ID, "2028-02-14", {
    weatherProvider: forecastWithRainOn(),
  });
  assert.deepEqual(tasks.map((task) => task.originalDate), [
    "2028-02-14", "2028-02-29", "2028-03-30", "2028-04-14", "2028-05-24",
  ]);
});

test("calendar dates remain correct across daylight-saving transitions", () => {
  const tasks = generateDynamicTimeline(SEED_ID, "2026-03-01", {
    weatherProvider: forecastWithRainOn(),
  });
  assert.deepEqual(tasks.map((task) => task.originalDate), [
    "2026-03-01", "2026-03-16", "2026-04-15", "2026-04-30", "2026-06-09",
  ]);
});

test("invalid dates, timestamps, and unknown seeds are rejected", () => {
  for (const invalid of ["", "2026-2-01", "2026-02-29", "2026-04-31", "2026-13-01", "2026-11-01T00:00:00Z"]) {
    assert.throws(() => generateDynamicTimeline(SEED_ID, invalid), RangeError);
    assert.throws(() => getMockWeatherForecast(invalid), RangeError);
  }
  assert.throws(() => generateDynamicTimeline("missing-seed", "2026-11-01"), /Unknown seed/);
});

test("a forecast for the wrong day is rejected and provider failures propagate", () => {
  assert.throws(() => generateDynamicTimeline(SEED_ID, "2026-11-01", {
    weatherProvider: () => ({ date: "2026-11-02", condition: "Clear", source: "mock" }),
  }), /Invalid or missing weather forecast/);
  assert.throws(() => generateDynamicTimeline(SEED_ID, "2026-11-01", {
    weatherProvider: () => { throw new Error("Weather unavailable"); },
  }), /Weather unavailable/);
});

test("timeline generation preserves seed data and produces JSON-safe values", () => {
  const before = JSON.stringify(SEED_VARIETIES);
  const tasks = generateDynamicTimeline(SEED_ID, "2026-11-01");
  assert.equal(JSON.stringify(SEED_VARIETIES), before);
  assert.deepEqual(JSON.parse(JSON.stringify(tasks)), tasks);
  assert.equal(new Set(tasks.map((task) => task.id)).size, tasks.length);

  const clearTasks = generateDynamicTimeline(SEED_ID, "2026-11-01", {
    weatherProvider: forecastWithRainOn(),
  });
  assert.deepEqual(tasks.map((task) => task.id), clearTasks.map((task) => task.id));
});
