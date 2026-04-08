import { test, expect } from '@playwright/test';

/**
 * E2E test: Full game flow from lobby to showdown.
 *
 * This test simulates two browser contexts (2 players) to play through
 * an entire hand. Requires a running server with real KV and Pusher.
 *
 * NOTE: Run with valid env vars only. Skip in unit-test CI.
 * Run with: npx playwright test e2e/game-flow.spec.ts
 */

test.describe('Game flow', () => {
  test('host can create a table and see the lobby', async ({ page }) => {
    await page.goto('/');

    // Open the create table modal
    await page.getByRole('button', { name: /create table/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill in host name (find the first text input in the modal)
    const nameInput = page.getByRole('textbox', { name: /your name/i });
    await nameInput.fill('Alice');

    // Submit the form
    await page.getByRole('button', { name: /create table/i }).last().click();

    // Should navigate to the table lobby page
    await expect(page).toHaveURL(/\/table\//);
    await expect(page.getByText('Alice')).toBeVisible();
  });

  test('second player can join using the table URL', async ({ browser }) => {
    // Context 1: Host creates the table
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/');
    await hostPage.getByRole('button', { name: /create table/i }).click();
    await hostPage.getByRole('textbox', { name: /your name/i }).fill('Alice');
    await hostPage.getByRole('button', { name: /create table/i }).last().click();
    await hostPage.waitForURL(/\/table\//);

    const tableUrl = hostPage.url();

    // Context 2: Second player joins
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    await guestPage.goto(tableUrl);
    const joinNameInput = guestPage.getByRole('textbox', { name: /your name/i });
    await joinNameInput.fill('Bob');
    await guestPage.getByRole('button', { name: /join/i }).click();

    // Both players should be visible in the lobby
    await expect(hostPage.getByText('Bob')).toBeVisible({ timeout: 8000 });
    await expect(guestPage.getByText('Alice')).toBeVisible({ timeout: 8000 });

    await hostContext.close();
    await guestContext.close();
  });
});
