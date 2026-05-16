import { test, expect } from '@playwright/test';

test.describe('Scheduler Manager - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    // Capture all console logs for debugging
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
      }
    });
    page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));
  });

  test('should load login modal on first visit', async ({ page }) => {
    await page.goto('/');
    
    // Wait for login modal to be visible
    const loginModal = page.locator('#loginModal');
    await expect(loginModal).toBeVisible();
    
    // Check that login form is present
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/');
    
    // Fill invalid credentials
    await page.fill('input[autocomplete="username"]', 'invalid');
    await page.fill('input[autocomplete="current-password"]', 'invalid');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('.alert-danger')).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/');
    
    // Fill credentials
    await page.fill('input[autocomplete="username"]', 'dbladmin');
    await page.fill('input[autocomplete="current-password"]', 'dbl@dmin1236');
    await page.click('button[type="submit"]');
    
    // Wait for login modal to close (authenticated)
    await expect(page.locator('#loginModal')).not.toBeVisible({ timeout: 10000 });
    
    // Verify navbar is visible
    await expect(page.locator('.navbar')).toBeVisible();
  });

  test('should navigate to dashboard after login', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[autocomplete="username"]', 'dbladmin');
    await page.fill('input[autocomplete="current-password"]', 'dbl@dmin1236');
    await page.click('button[type="submit"]');
    
    // Wait for login modal to close
    await expect(page.locator('#loginModal')).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Wait for dashboard to load
    await expect(page.locator('text=Panel de Control')).toBeVisible({ timeout: 10000 });
    
    // Check stats cards are visible
    await expect(page.locator('text=Total Tareas')).toBeVisible();
    await expect(page.getByText('Activas', { exact: true })).toBeVisible();
    await expect(page.getByText('Pendientes', { exact: true })).toBeVisible();
  });

  test('should navigate to tasks view', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[autocomplete="username"]', 'dbladmin');
    await page.fill('input[autocomplete="current-password"]', 'dbl@dmin1236');
    await page.click('button[type="submit"]');
    await expect(page.locator('#loginModal')).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Open offcanvas menu
    await page.click('button[data-bs-target="#offcanvasNavbar"]');
    await page.waitForTimeout(500);
    
    // Click on Tasks link
    await page.click('text=Tareas');
    await page.waitForTimeout(1000);
    
    // Verify tasks view is visible
    await expect(page.locator('text=Gestión de Tareas')).toBeVisible();
  });

  test('should open new task modal', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[autocomplete="username"]', 'dbladmin');
    await page.fill('input[autocomplete="current-password"]', 'dbl@dmin1236');
    await page.click('button[type="submit"]');
    await expect(page.locator('#loginModal')).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Navigate to tasks
    await page.click('button[data-bs-target="#offcanvasNavbar"]');
    await page.waitForTimeout(500);
    await page.click('text=Tareas');
    await page.waitForTimeout(1000);
    
    // Close offcanvas menu
    await page.click('.offcanvas .btn-close');
    await page.waitForTimeout(500);
    
    // Click "Nueva Tarea" button
    await page.click('text=Nueva Tarea');
    await page.waitForTimeout(500);
    
    // Check modal is open
    const taskModal = page.locator('#taskFormModal, .modal.show');
    await expect(taskModal).toBeVisible();
  });

  test('should navigate to scheduler view', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[autocomplete="username"]', 'dbladmin');
    await page.fill('input[autocomplete="current-password"]', 'dbl@dmin1236');
    await page.click('button[type="submit"]');
    await expect(page.locator('#loginModal')).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Open offcanvas and navigate
    await page.click('button[data-bs-target="#offcanvasNavbar"]');
    await page.waitForTimeout(500);
    await page.click('text=Planificador');
    await page.waitForTimeout(1000);
    
    // Close offcanvas
    await page.click('.offcanvas .btn-close');
    await page.waitForTimeout(500);
    
    // Wait for scheduler view heading
    await page.waitForSelector('h4', { timeout: 10000 });
    const headingText = await page.locator('h4').first().textContent();
    console.log(`[TEST] Heading text: "${headingText}"`);
    expect(headingText).toContain('Planificador');
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[autocomplete="username"]', 'dbladmin');
    await page.fill('input[autocomplete="current-password"]', 'dbl@dmin1236');
    await page.click('button[type="submit"]');
    await expect(page.locator('#loginModal')).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Click logout button
    await page.click('button.btn-outline-danger');
    await page.waitForTimeout(1000);
    
    // Login modal should appear again
    await expect(page.locator('#loginModal')).toBeVisible();
  });
});