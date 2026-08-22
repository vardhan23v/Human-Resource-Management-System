export default function Skeleton({ lines = 1, height = 16, width, style }: { lines?: number; height?: number; width?: string | number; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, width: width ?? (i === lines - 1 && lines > 1 ? '60%' : '100%') }} />
      ))}
    </div>
  );
}
