import { test, expect } from '@playwright/test';

test.describe('The Alchemist - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
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
    
    // Fill credentials - using default admin/admin
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[autocomplete="current-password"]', 'admin');
    await page.click('button[type="submit"]');
    
    // Wait for login modal to close (authenticated)
    await expect(page.locator('#loginModal')).not.toBeVisible({ timeout: 10000 });
    
    // Verify navbar is visible
    await expect(page.locator('.navbar')).toBeVisible();
  });

  test('should navigate to dashboard after login', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[autocomplete="current-password"]', 'admin');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await expect(page.locator('text=Panel de Control')).toBeVisible({ timeout: 10000 });
    
    // Check stats cards are visible
    await expect(page.locator('text=Total Tareas')).toBeVisible();
    await expect(page.locator('text=Activas')).toBeVisible();
    await expect(page.locator('text=Pendientes')).toBeVisible();
  });

  test('should navigate to tasks view', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[autocomplete="current-password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
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
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[autocomplete="current-password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Navigate to tasks
    await page.click('button[data-bs-target="#offcanvasNavbar"]');
    await page.waitForTimeout(500);
    await page.click('text=Tareas');
    await page.waitForTimeout(2000);
    
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
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[autocomplete="current-password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Open offcanvas and navigate
    await page.click('button[data-bs-target="#offcanvasNavbar"]');
    await page.waitForTimeout(500);
    await page.click('text=Planificador');
    await page.waitForTimeout(1000);
    
    // Verify scheduler view
    await expect(page.locator('text=Planificador (Buffer)')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[autocomplete="current-password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Click logout button
    await page.click('button:has-text("bi-box-arrow-right")');
    await page.waitForTimeout(1000);
    
    // Login modal should appear again
    await expect(page.locator('#loginModal')).toBeVisible();
  });
});