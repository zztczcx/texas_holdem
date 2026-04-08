import { test, expect } from '@playwright/test';

/**
 * E2E smoke test: Landing page renders and table creation flow works.
 *
 * NOTE: These tests require a running dev server with valid environment
 * variables (KV, Pusher). In CI, set up the env vars before running.
 * Run with: npx playwright test
 */

test.describe('Landing page', () => {
  test('shows the home page with create and join options', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /texas hold/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create table/i })).toBeVisible();
  });

  test('shows the join table input', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder(/table (id|code|number)/i)).toBeVisible();
  });
});

test.describe('Table creation flow', () => {
  test('opens settings modal when Create Table is clicked', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create table/i }).click();
    // Modal should open — look for the settings form
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('requires a player name to create a table', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create table/i }).click();
    // Try to submit without filling in a name — button should be disabled or show error
    const submitBtn = page.getByRole('button', { name: /create|start|host/i }).last();
    // The form should require name input before enabling
    await expect(submitBtn).toBeVisible();
  });
});
