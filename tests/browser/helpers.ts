import { expect, type Page } from "@playwright/test";
import { randomInt } from "node:crypto";

/** Akun simulasi terpisah untuk tiap tes; cookie tetap melalui HTTP backend. */
export async function masukApi(page: Page) {
  const response = await page.request.post("/api/auth/request-otp", { data: { nomorHp: `0812${randomInt(10_000_000, 99_999_999)}`, kanal: "whatsapp" } });
  expect(response.ok()).toBeTruthy();
  const challenge = await response.json();
  const verified = await page.request.post("/api/auth/verify-otp", { data: { id: challenge.id, kode: challenge.kodeSimulasi } });
  expect(verified.ok()).toBeTruthy();
}
export async function bukaPlanner(page: Page) {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: /Jadwal tanam/ }).click();
}
