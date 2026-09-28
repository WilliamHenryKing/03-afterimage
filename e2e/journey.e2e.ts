import { expect, test } from "@playwright/test";

test("focus the lens, compose a night, resolve a clash and issue the demo pass", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#arrival").waitFor({ state: "detached", timeout: 60_000 });

  // Focus: the identity resolves and the programme opens.
  await page.getByRole("button", { name: "Focus for me" }).click();
  await expect(page.getByText("Lens in focus. The festival identity has resolved.")).toBeAttached();
  await expect(page.getByRole("tab", { name: "Programme" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Save two overlapping Friday performances and one later set.
  await page.getByRole("button", { name: "Save Chromatic Aberration" }).click();
  await page.getByRole("button", { name: "Save Pressure Garden" }).click();
  await page.getByRole("button", { name: "Save Slow Meridian" }).click();
  await expect(page).toHaveURL(/#night=CA\.PG\.SM/);

  // Resolve the clash in My night.
  await page.getByRole("tab", { name: /My night/ }).click();
  await expect(page.getByRole("heading", { name: "1 clash: choose one" })).toBeVisible();
  await page.getByRole("button", { name: /Chromatic Aberration.*Keep this/ }).click();
  await expect(page.getByRole("heading", { name: /clash/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove Pressure Garden" })).toHaveCount(0);

  // Pass: the Friday pass fits; issue the demo ticket.
  await page.getByRole("tab", { name: "Pass" }).click();
  await expect(page.getByRole("radio", { name: /Friday night/ })).toBeChecked();
  await page.getByRole("button", { name: "Issue demo pass" }).click();

  const ticket = page.getByRole("dialog", { name: "Your demo ticket" });
  await expect(ticket).toBeVisible();
  await expect(ticket.getByText("Demo ticket — no purchase made")).toBeVisible();
  await expect(ticket.getByText("Chromatic Aberration")).toBeVisible();
  await expect(ticket.getByText("Slow Meridian")).toBeVisible();
  await expect(ticket.getByText("£38")).toBeVisible();
});
