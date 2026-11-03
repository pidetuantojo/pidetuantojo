// Barrel consumido por las páginas (Server Components) de /dashboard/caja.
// Solo exporta componentes con "use client": re-exportar hooks o servicios acá hace que Next
// los evalúe en el servidor y rompa el build. Hooks y helpers se importan por su ruta directa.
export { ApprovalsManager } from './components/ApprovalsManager';
export { BlindCloseManager } from './components/BlindCloseManager';
export { CashConfigManager } from './components/CashConfigManager';
export { CashReports } from './components/CashReports';
export { CurrentShiftManager } from './components/CurrentShiftManager';
export { GeneralBoxManager } from './components/GeneralBoxManager';
export { PettyCashManager } from './components/PettyCashManager';
