/** Month grid coloured by attendance status; hover shows worked hours. */
const COLOR: Record<string, string> = { PRESENT: 'var(--success)', HALF_DAY: 'var(--warn)', LEAVE: 'var(--accent)', ABSENT: 'var(--danger)' };
export default function AttendanceHeatmap({ month, rows }: { month: string; rows: any[] }) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const first = new Date(y, m - 1, 1).getDay();
  const byDay = new Map(rows.map(r => [Number(String(r.date).slice(8, 10)), r]));
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, fontSize: 11, color: 'var(--neutral-400)', marginBottom: 6, textAlign: 'center' }}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const r = byDay.get(d); const dow = (first + d - 1) % 7; const weekend = dow === 0 || dow === 6;
          const bg = r ? COLOR[r.status] || 'var(--neutral-200)' : weekend ? 'var(--neutral-100)' : 'var(--neutral-100)';
          const hrs = r?.worked_minutes ? `${(r.worked_minutes / 60).toFixed(1)} h` : '';
          return <div key={d} className="heat-cell fade-up" title={`${month}-${String(d).padStart(2, '0')}${r ? ` · ${r.status}${hrs ? ' · ' + hrs : ''}` : weekend ? ' · Weekend' : ''}`} style={{ background: bg, opacity: r ? 1 : weekend ? 0.5 : 0.8, '--i': Math.floor(i / 7) } as any}><span>{d}</span></div>;
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: 'var(--neutral-500)', flexWrap: 'wrap' }}>
        {Object.entries({ Present: 'PRESENT', 'Half day': 'HALF_DAY', Leave: 'LEAVE', Absent: 'ABSENT' }).map(([l, k]) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: COLOR[k], display: 'inline-block' }} />{l}</span>)}
      </div>
    </div>
  );
}
