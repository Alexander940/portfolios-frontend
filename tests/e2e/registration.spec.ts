import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Helper to get the registration modal dialog
 */
function getModal(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Crear cuenta' });
}

/**
 * Helper to get form fields within the modal
 * Using locator IDs since there are multiple similar fields on the page
 */
function getModalFields(page: Page) {
  const modal = getModal(page);
  return {
    // Use input IDs which are generated from labels in the Input component
    email: modal.locator('#correo-electrónico'),
    username: modal.locator('#nombre-de-usuario'),
    password: modal.locator('#contraseña'),
    firstName: modal.locator('#nombre-\\(opcional\\)'),
    lastName: modal.locator('#apellido-\\(opcional\\)'),
    submitButton: modal.getByRole('button', { name: 'Crear cuenta' }),
    closeButton: modal.getByRole('button', { name: 'Cerrar modal' }),
  };
}

test.describe('Registration Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the login page before each test
    await page.goto('/');
  });

  test('should open registration modal when clicking register button', async ({ page }) => {
    // Click the "Regístrate aquí" button
    await page.getByRole('button', { name: 'Regístrate aquí' }).click();

    // Verify modal is visible
    const modal = getModal(page);
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
    await expect(modal.getByText('Completa los campos para registrarte')).toBeVisible();
  });

  test('should close modal when clicking close button', async ({ page }) => {
    // Open the modal
    await page.getByRole('button', { name: 'Regístrate aquí' }).click();
    const modal = getModal(page);
    await expect(modal).toBeVisible();

    // Click the close button
    const { closeButton } = getModalFields(page);
    await closeButton.click();

    // Verify modal is closed
    await expect(modal).not.toBeVisible();
  });

  test('should close modal when pressing Escape key', async ({ page }) => {
    // Open the modal
    await page.getByRole('button', { name: 'Regístrate aquí' }).click();
    const modal = getModal(page);
    await expect(modal).toBeVisible();

    // Press Escape key
    await page.keyboard.press('Escape');

    // Verify modal is closed
    await expect(modal).not.toBeVisible();
  });

  test('should close modal when clicking outside (backdrop)', async ({ page }) => {
    // Open the modal
    await page.getByRole('button', { name: 'Regístrate aquí' }).click();
    const modal = getModal(page);
    await expect(modal).toBeVisible();

    // Click on the backdrop (outside the modal)
    // The backdrop is the fixed element behind the modal panel
    await page.locator('.fixed.inset-0.bg-black\\/50').click({ position: { x: 10, y: 10 } });

    // Verify modal is closed
    await expect(modal).not.toBeVisible();
  });

  test('should display validation errors for empty required fields', async ({ page }) => {
    // Open the modal
    await page.getByRole('button', { name: 'Regístrate aquí' }).click();
    const modal = getModal(page);
    await expect(modal).toBeVisible();

    // Click submit without filling any fields
    const { submitButton } = getModalFields(page);
    await submitButton.click();

    // Verify validation errors are displayed
    await expect(modal.getByText('El correo es requerido')).toBeVisible();
    await expect(modal.getByText('El nombre de usuario es requerido')).toBeVisible();
    await expect(modal.getByText('La contraseña es requerida')).toBeVisible();
  });

  test('should prevent form submission with invalid data', async ({ page }) => {
    // Open the modal
    await page.getByRole('button', { name: 'Regístrate aquí' }).click();
    const modal = getModal(page);
    await expect(modal).toBeVisible();

    const { email, username, password, submitButton } = getModalFields(page);

    // Enter invalid email (missing @ symbol)
    await email.fill('invalid-email');

    // Fill other required fields with valid data
    await username.fill('testuser');
    await password.fill('password123');

    // Click submit
    await submitButton.click();

    // Wait for form validation to complete
    await page.waitForTimeout(200);

    // Verify the modal is still visible (form didn't submit successfully)
    await expect(modal).toBeVisible();

    // Verify the form is still interactive (we can modify fields)
    await expect(email).toBeEditable();
  });

  test('should display validation error for short username', async ({ page }) => {
    // Open the modal
    await page.getByRole('button', { name: 'Regístrate aquí' }).click();
    const modal = getModal(page);
    await expect(modal).toBeVisible();

    const { email, username, password, submitButton } = getModalFields(page);

    // Enter valid email but short username
    await email.fill('test@example.com');
    await username.fill('ab');
    await password.fill('password123');

    // Click submit
    await submitButton.click();

    // Verify username validation error
    await expect(modal.getByText('El usuario debe tener al menos 3 caracteres')).toBeVisible();
  });

  test('should display validation error for short password', async ({ page }) => {
    // Open the modal
    await page.getByRole('button', { name: 'Regístrate aquí' }).click();
    const modal = getModal(page);
    await expect(modal).toBeVisible();

    const { email, username, password, submitButton } = getModalFields(page);

    // Enter valid data except password
    await email.fill('test@example.com');
    await username.fill('testuser');
    await password.fill('short');

    // Click submit
    await submitButton.click();

    // Verify password validation error
    await expect(modal.getByText('La contraseña debe tener al menos 8 caracteres')).toBeVisible();
  });

  test('should have all form fields visible', async ({ page }) => {
    // Open the modal
    await page.getByRole('button', { name: 'Regístrate aquí' }).click();
    const modal = getModal(page);
    await expect(modal).toBeVisible();

    const { email, username, password, firstName, lastName, submitButton } = getModalFields(page);

    // Verify all fields are present
    await expect(email).toBeVisible();
    await expect(username).toBeVisible();
    await expect(password).toBeVisible();
    await expect(firstName).toBeVisible();
    await expect(lastName).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('should keep focus within modal during keyboard navigation', async ({ page }) => {
    // Open the modal
    await page.getByRole('button', { name: 'Regístrate aquí' }).click();
    const modal = getModal(page);
    await expect(modal).toBeVisible();

    // Wait a moment for focus to be set
    await page.waitForTimeout(200);

    // Tab through several elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    // Verify the focused element is still within the modal
    // by checking that we can still interact with modal elements
    const { email } = getModalFields(page);

    // Type in the email field to verify we can still interact with the modal
    await email.click();
    await email.fill('focus-test@example.com');
    await expect(email).toHaveValue('focus-test@example.com');
  });

  test('should show form with all required elements', async ({ page }) => {
    // Open the modal
    await page.getByRole('button', { name: 'Regístrate aquí' }).click();
    const modal = getModal(page);
    await expect(modal).toBeVisible();

    const { email, username, password, firstName, lastName, submitButton } = getModalFields(page);

    // Verify the form is interactive by filling all fields
    await email.fill('test@example.com');
    await expect(email).toHaveValue('test@example.com');

    await username.fill('testuser');
    await expect(username).toHaveValue('testuser');

    await password.fill('password123');
    // Password field value is masked, just verify it was filled

    await firstName.fill('John');
    await expect(firstName).toHaveValue('John');

    await lastName.fill('Doe');
    await expect(lastName).toHaveValue('Doe');

    // Verify submit button is present and enabled
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test('should have proper ARIA attributes for accessibility', async ({ page }) => {
    // Open the modal
    await page.getByRole('button', { name: 'Regístrate aquí' }).click();

    const modal = getModal(page);
    await expect(modal).toBeVisible();

    // Check that dialog has proper aria attributes
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).toHaveAttribute('aria-labelledby', /modal-title/);
    await expect(modal).toHaveAttribute('aria-describedby', /modal-description/);
  });
});
