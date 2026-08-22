import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../utils/api';

type User = { id:string; email:string; loginId:string; role:string; companyId:string; employeeId?:string; name?:string; photo_url?:string; mustChangePassword?:boolean; companyName?:string; departmentName?:string; };
type Ctx = { user: User | null; loading: boolean; login: (identifier:string, password:string)=>Promise<void>; signup: (data:any)=>Promise<void>; logout:()=>Promise<void>; refresh:()=>Promise<void>; };

const AuthContext = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchMe(token?: string) {
    try {
      const t = token || localStorage.getItem('accessToken');
      if (!t) { setLoading(false); return; }
      const res = await api('/api/auth/me');
      setUser({ id: res.data.id, email: res.data.email, loginId: res.data.login_id, role: res.data.role, companyId: res.data.company_id, employeeId: res.data.employeeId, name: res.data.name, mustChangePassword: !!res.data.must_change_password, companyName: res.data.companyName });
    } catch { localStorage.removeItem('accessToken'); setUser(null); }
    setLoading(false);
  }

  useEffect(()=>{ fetchMe(); },[]);

  async function login(identifier:string, password:string){
    const res = await api('/api/auth/login', { method:'POST', body: JSON.stringify({ identifier, password }) });
    localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('refreshToken', res.data.refreshToken);
    await fetchMe(res.data.accessToken);
  }
  async function signup(data:any){
    const res = await api('/api/auth/signup', { method:'POST', body: JSON.stringify(data) });
    localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('refreshToken', res.data.refreshToken);
    await fetchMe(res.data.accessToken);
  }
  async function logout(){
    try{ await api('/api/auth/logout', { method:'POST', body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') }) }); }catch{}
    localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); setUser(null);
  }
  async function refresh(){
    const rt = localStorage.getItem('refreshToken');
    if(!rt) return;
    const res = await api('/api/auth/refresh', { method:'POST', body: JSON.stringify({ refreshToken: rt }) });
    localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('refreshToken', res.data.refreshToken);
  }

  return <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>{children}</AuthContext.Provider>;
}
