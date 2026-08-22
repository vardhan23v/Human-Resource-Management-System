import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { AppLoader } from '../App';

/** Landing route for the LinkedIn OAuth callback redirect — shows the outcome and returns to the profile's LinkedIn tab. */
export default function LinkedInReturn() {
  const [q] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    const status = q.get('status');
    if (status === 'connected') toast.success('LinkedIn connected');
    else toast.error(q.get('code') === 'LINKEDIN_DENIED' ? 'LinkedIn access was declined' : 'LinkedIn connection failed', q.get('message') || undefined);
    nav(user?.employeeId ? `/profile/${user.employeeId}?tab=linkedin` : '/directory', { replace: true });
  }, [loading]);
  return <AppLoader label="Finishing LinkedIn sign-in…" />;
}
