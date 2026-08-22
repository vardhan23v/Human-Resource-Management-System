import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Re-mounts children on route change so the enter animation replays; also scrolls to top. */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return <div key={pathname} className="page-enter">{children}</div>;
}
