const FEATURES = [
  { icon: '👥', title: 'One directory, every role', text: 'Admins, HR, managers and employees see exactly what they should.' },
  { icon: '⏱️', title: 'Attendance that just flows', text: 'Check-in, regularise, and review — with approvals in one tap.' },
  { icon: '💸', title: 'Payroll without spreadsheets', text: 'Salary structures, leave deductions and PDF payslips, automated.' },
];

export default function AuthHero() {
  return (
    <aside className="auth-hero gradient-anim">
      <div className="orb" style={{ width: 320, height: 320, background: '#A78BFA', top: -80, right: -60 }} />
      <div className="orb orb-alt" style={{ width: 260, height: 260, background: '#60A5FA', bottom: 40, left: -80 }} />
      <div className="orb" style={{ width: 180, height: 180, background: '#F472B6', bottom: -40, right: 120, animationDelay: '-4s' }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }} className="fade-up">
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'white', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, fontFamily: 'var(--font-display)' }}>D</div>
        <span style={{ fontWeight: 800, fontSize: 20, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>Dayflow</span>
      </div>

      <div style={{ position: 'relative' }}>
        <h1 className="fade-up" style={{ fontSize: 'clamp(30px, 3.6vw, 46px)', lineHeight: 1.08, margin: '0 0 14px', maxWidth: 520, '--i': 1 } as any}>
          Every workday,<br />perfectly aligned.
        </h1>
        <p className="fade-up" style={{ fontSize: 16, opacity: 0.85, margin: '0 0 36px', maxWidth: 440, lineHeight: 1.5, '--i': 2 } as any}>
          The calm HRMS for teams who'd rather spend their time on people than on paperwork.
        </p>
        <div className="hero-features" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className="feature-row fade-up" style={{ '--i': 3 + i } as any}>
              <div className="feature-icon">{f.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{f.title}</div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{f.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fade-up" style={{ position: 'relative', fontSize: 12, opacity: 0.7, '--i': 6 } as any}>© {new Date().getFullYear()} Dayflow HRMS · v2.1</div>
    </aside>
  );
}
