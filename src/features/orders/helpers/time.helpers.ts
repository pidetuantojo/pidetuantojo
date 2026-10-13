export function timeAgo(isoString: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(isoString).getTime()) / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

export function formatShortDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.toLocaleDateString('es-CO', { day: 'numeric', month: 'numeric', year: '2-digit' })}, ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`;
}
