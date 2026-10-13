# Plan: Centro de ayuda para restaurantes

## Objetivo

Que un restaurante aprenda a operar Pide tu Antojo **sin soporte humano**, con guías que
**muestran** el flujo (simuladores animados, videos, tours) en vez de solo describirlo.

- **Ubicación:** `/dashboard/ayuda` (solo usuarios logueados).
- **Audiencia principal:** `restaurant_admin`. **Secundaria:** `restaurant_employee`.
- **Tono:** tuteo, cercano y directo ("toca aquí, listo").
- **Restaurante demo:** "Antojos Demo" (datos inventados) para simuladores y videos.
- **Filtro por permisos:** cada guía declara el permiso que requiere y se oculta si el
  usuario no lo tiene (reutiliza `src/components/permissions/Can.tsx`).

## Contenido

| # | Sección | Guías | Formato |
|---|---|---|---|
| 0 | Primeros pasos | Entrar al panel, recorrido del dashboard, checklist "deja tu restaurante listo" | Tour + checklist |
| 1 | **Pedidos** (piloto) | Recibir un pedido, cambiar estados, imprimir comanda, avisar por WhatsApp, cobrar, cancelar | Simulador |
| 2 | Menú | Categorías, productos, adicionales, promociones, ver el menú como cliente | Simulador |
| 3 | Domicilios | Zonas y tarifas, domiciliarios, métodos de entrega | Guía + simulador |
| 4 | Cobros | Métodos de pago, contabilidad | Guía |
| 5 | Configuración | Datos del restaurante, impresoras / estación de impresión (QZ Tray), WhatsApp, plantillas, equipo y permisos, estados | Guía + video |
| 6 | Problemas frecuentes | No imprime, WhatsApp desconectado, no llegan pedidos… | FAQ |

### Plantilla de cada guía

1. Para qué sirve (una línea)
2. Quién puede hacerlo (rol / permiso)
3. Simulador o video del flujo
4. Pasos numerados con capturas
5. Errores comunes
6. Guías relacionadas

## Arquitectura técnica

```
src/app/(dashboard)/dashboard/ayuda/
  page.tsx                  → índice + buscador
  [seccion]/[guia]/page.tsx → renderiza el MDX
src/features/help/
  content/<seccion>/<guia>.mdx
  components/
    FlowSimulator/          → marco celular/escritorio, pasos, cursor animado, hotspots
    Steps, Callout, RoleBadge, VideoClip
  mocks/                    → pedidos, productos y restaurante falsos
  tours/                    → definiciones driver.js por pantalla
```

- **MDX** (`@next/mdx`) para el contenido; mismo repo y mismo deploy.
- **FlowSimulator** reutiliza los componentes reales (`OrderCard`, `OrderDrawer`,
  `ProductModal`…) con mocks; nunca toca Firestore.
- **Animaciones** con CSS / Framer Motion, respetando `prefers-reduced-motion`.
- **Tours guiados** con driver.js, lanzados desde un botón "?" por pantalla y en el primer ingreso.
- **Videos automáticos** con Playwright (`npm run docs:record`) sobre el restaurante demo.

## Fases

| Fase | Entregable | Criterio de "listo" |
|---|---|---|
| 0. Validación | Prototipo visual del simulador de pedidos | Estilo y animación aprobados |
| 1. Base | Ruta `/dashboard/ayuda`, MDX, layout, buscador, filtro por permisos, componentes base | Se navega una guía de ejemplo en celular |
| 2. Piloto: Pedidos | Guías de pedidos + `FlowSimulator` con componentes reales | Un empleado nuevo atiende un pedido solo con la guía |
| 3. Menú + Primeros pasos | Guías de menú, checklist de onboarding | Un restaurante nuevo publica su menú sin ayuda |
| 4. Domicilios, Cobros, Config | Resto de guías; videos de QZ Tray y WhatsApp | Todos los módulos tienen guía |
| 5. Ayuda contextual | Botón "?" por pantalla + tours driver.js | Cada pantalla enlaza a su guía o tour |
| 6. Mantenimiento | Videos regenerados con Playwright; regla "PR que cambia UI actualiza su guía" | La doc no queda desactualizada |
