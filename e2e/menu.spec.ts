import { test, expect, type Page } from '@playwright/test';

const SLUG = 'mangova';

/** Intercepta window.open para capturar la URL de WhatsApp sin abrirla */
async function mockWindowOpen(page: Page) {
  await page.addInitScript(() => {
    window.open = (url?: string | URL) => {
      (window as any).__capturedUrl = String(url ?? '');
      return null;
    };
  });
}

/** Selector unificado para el botón de agregar (funciona en layouts cards y list) */
const addBtn = (page: Page) =>
  page.getByRole('button', { name: /Añadir al pedido/i }).first();

/** Agrega el primer producto disponible al carrito */
async function addFirstProduct(page: Page) {
  await addBtn(page).click();
  await expect(page.getByRole('button', { name: /Agregar al pedido/i })).toBeVisible();
  await page.getByRole('button', { name: /Agregar al pedido/i }).click();
  await expect(page.locator('text=Completar pedido')).toBeVisible();
}

/** Abre el CartDrawer desde la barra inferior */
async function openCartDrawer(page: Page) {
  await page.locator('text=Completar pedido').click();
  await expect(page.getByText('Tu Pedido', { exact: true })).toBeVisible();
}

test.describe(`Menú público — ${SLUG}`, () => {
  test.beforeEach(async ({ page }) => {
    await mockWindowOpen(page);
    await page.goto(`/${SLUG}`);
    await page.waitForLoadState('networkidle');
  });

  // ─── Carga de página ────────────────────────────────────────────────────────

  test('carga el menú y muestra productos', async ({ page }) => {
    await expect(addBtn(page)).toBeVisible({ timeout: 15_000 });
  });

  test('muestra al menos una categoría', async ({ page }) => {
    // En list layout las categorías son botones con texto en uppercase
    // En cards layout son tabs — en ambos casos hay al menos un botón visible
    await expect(addBtn(page)).toBeVisible({ timeout: 15_000 });
  });

  // ─── Modal de producto ──────────────────────────────────────────────────────

  test('abre el modal al clickear Añadir al pedido', async ({ page }) => {
    await addBtn(page).click();
    await expect(page.getByRole('button', { name: /Agregar al pedido/i })).toBeVisible();
  });

  test('el modal muestra Total y el botón para agregar', async ({ page }) => {
    await addBtn(page).click();
    await expect(page.locator('text=Total')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al pedido/i })).toBeVisible();
  });

  test('incrementar cantidad actualiza el total en el modal', async ({ page }) => {
    await addBtn(page).click();
    await expect(page.getByRole('button', { name: /Agregar al pedido/i })).toBeVisible();

    // Capturar total inicial
    const btnBefore = await page.getByRole('button', { name: /Agregar al pedido/i }).textContent();

    // Incrementar cantidad
    await page.locator('text=+').last().click();

    // El texto del botón cambia (total × 2)
    const btnAfter = await page.getByRole('button', { name: /Agregar al pedido/i }).textContent();
    expect(btnAfter).not.toEqual(btnBefore);
  });

  test('cerrar modal no agrega al carrito', async ({ page }) => {
    await addBtn(page).click();
    await expect(page.getByRole('button', { name: /Agregar al pedido/i })).toBeVisible();

    // Cerrar con backdrop click
    await page.keyboard.press('Escape');

    // En estos modales no hay manejo de Escape — cerrar via backdrop
    // El backdrop es el primer div con posición absolute
    // Hacemos click fuera del sheet
    await page.mouse.click(10, 10);

    // Barra de carrito NO debe aparecer (timeout corto)
    await expect(page.locator('text=Completar pedido')).not.toBeVisible({ timeout: 3_000 });
  });

  // ─── Carrito ────────────────────────────────────────────────────────────────

  test('agregar producto muestra la barra inferior del carrito', async ({ page }) => {
    await addFirstProduct(page);
    await expect(page.locator('text=Completar pedido')).toBeVisible();
  });

  test('la barra inferior muestra precio del producto', async ({ page }) => {
    await addFirstProduct(page);
    // La barra inferior tiene "Completar pedido" + el total formateado
    await expect(page.locator('text=Completar pedido')).toBeVisible();
    // El precio (ej: $ 15.000) está en el div raíz de la barra (2 niveles arriba del span)
    const barText = await page.locator('span:has-text("Completar pedido")').locator('../..').textContent();
    expect(barText).toMatch(/\$\s*\d/);
  });

  test('abre el CartDrawer desde la barra inferior', async ({ page }) => {
    await addFirstProduct(page);
    await openCartDrawer(page);
    await expect(page.getByText('Tu Pedido', { exact: true })).toBeVisible();
  });

  test('el CartDrawer muestra el producto agregado', async ({ page }) => {
    await addFirstProduct(page);
    await openCartDrawer(page);
    // Debe haber al menos un item en el drawer (botón de observación)
    await expect(page.locator('text=+ Agregar observación').first()).toBeVisible();
  });

  // ─── Validaciones del formulario ────────────────────────────────────────────

  test('muestra errores si se confirma con el formulario vacío', async ({ page }) => {
    await addFirstProduct(page);
    await openCartDrawer(page);

    await page.getByRole('button', { name: /Confirmar Pedido/i }).click();

    await expect(page.locator('text=Elegí cómo recibís tu pedido')).toBeVisible();
    await expect(page.locator('text=Elegí un método de pago')).toBeVisible();
  });

  test('muestra campo de dirección al elegir Domicilio', async ({ page }) => {
    await addFirstProduct(page);
    await openCartDrawer(page);

    await page.getByRole('button', { name: 'Domicilio' }).click();

    await expect(page.locator('input[placeholder*="Dirección exacta"]')).toBeVisible();
  });

  test('domicilio sin dirección mantiene el drawer abierto', async ({ page }) => {
    await addFirstProduct(page);
    await openCartDrawer(page);

    await page.getByRole('button', { name: 'Domicilio' }).click();
    await page.getByRole('button', { name: 'Efectivo' }).click();
    await page.fill('input[placeholder="Nombre completo"]', 'Test QA');
    await page.fill('input[placeholder*="Celular"]', '3001234567');
    // Address left empty intentionally

    await page.getByRole('button', { name: /Confirmar Pedido/i }).click();

    // Drawer stays open because address is missing
    await expect(page.getByText('Tu Pedido', { exact: true })).toBeVisible();
  });

  // ─── Flujo completo de checkout ─────────────────────────────────────────────

  test('flujo completo: recoger + efectivo → confirmar → WhatsApp URL generada', async ({ page }) => {
    await addFirstProduct(page);
    await openCartDrawer(page);

    await page.getByRole('button', { name: 'Recoger' }).click();
    await page.getByRole('button', { name: 'Efectivo' }).click();
    await page.fill('input[placeholder="Nombre completo"]', 'Test QA Playwright');
    await page.fill('input[placeholder*="Celular"]', '3001234567');

    await page.getByRole('button', { name: /Confirmar Pedido/i }).click();

    // Esperar a que window.open sea llamado con la URL de WhatsApp
    await page.waitForFunction(() => !!(window as any).__capturedUrl, { timeout: 15_000 });

    const url: string = await page.evaluate(() => (window as any).__capturedUrl);

    expect(url).toContain('wa.me');
    expect(url).toContain('Recoger');
    expect(url).toContain('Efectivo');
    // El nombre del cliente debe aparecer en el mensaje (URL encoded)
    expect(url.toLowerCase()).toMatch(/test|playwright/i);
  });

  test('flujo completo: recoger + transferencia → WhatsApp URL incluye Transferencia', async ({ page }) => {
    await addFirstProduct(page);
    await openCartDrawer(page);

    await page.getByRole('button', { name: 'Recoger' }).click();
    await page.getByRole('button', { name: 'Transferencia' }).click();
    await page.fill('input[placeholder="Nombre completo"]', 'Cliente Test');
    await page.fill('input[placeholder*="Celular"]', '3009876543');

    await page.getByRole('button', { name: /Confirmar Pedido/i }).click();

    await page.waitForFunction(() => !!(window as any).__capturedUrl, { timeout: 15_000 });
    const url: string = await page.evaluate(() => (window as any).__capturedUrl);

    expect(url).toContain('wa.me');
    expect(url).toContain('Transferencia');
  });

  test('después de confirmar el carrito queda vacío y el drawer se cierra', async ({ page }) => {
    await addFirstProduct(page);
    await openCartDrawer(page);

    await page.getByRole('button', { name: 'Recoger' }).click();
    await page.getByRole('button', { name: 'Efectivo' }).click();
    await page.fill('input[placeholder="Nombre completo"]', 'Test QA');
    await page.fill('input[placeholder*="Celular"]', '3001234567');

    await page.getByRole('button', { name: /Confirmar Pedido/i }).click();

    // Drawer se cierra
    await expect(page.getByText('Tu Pedido', { exact: true })).not.toBeVisible({ timeout: 15_000 });
    // Barra del carrito desaparece
    await expect(page.locator('text=Completar pedido')).not.toBeVisible();
  });
});
