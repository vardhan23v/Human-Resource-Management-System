export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span>© {new Date().getFullYear()} Dayflow HRMS · v2.1</span>
        <span style={{ display: 'flex', gap: 16 }}>
          <a href="https://github.com/vardhan23v/Human-Resource-Management-System" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://dayflow-api.vercel.app/api/health" target="_blank" rel="noreferrer">API status</a>
        </span>
      </div>
    </footer>
  );
}
