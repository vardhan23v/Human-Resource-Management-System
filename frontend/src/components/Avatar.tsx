/** Photo with a deterministic initials fallback (no external placeholder services). */
const PALETTE = ['#5B5BF6','#0E9F6E','#F59E0B','#E02424','#7C3AED','#0A66C2','#DB2777','#0891B2'];
export function initials(name?: string) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('') || '?';
}
export default function Avatar({ src, name, size = 56, style }: { src?: string | null; name?: string; size?: number; style?: React.CSSProperties }) {
  const seed = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = PALETTE[seed % PALETTE.length];
  const base: React.CSSProperties = { width: size, height: size, borderRadius: 999, flexShrink: 0, ...style };
  if (src) return <img src={src} alt={name || ''} loading="lazy" referrerPolicy="no-referrer" style={{ ...base, objectFit: 'cover', background: 'var(--neutral-100)' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex'); }} />;
  return <div aria-label={name} style={{ ...base, background: bg, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: Math.round(size * 0.36), fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>{initials(name)}</div>;
}
