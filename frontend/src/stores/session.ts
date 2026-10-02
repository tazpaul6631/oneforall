import { defineStore } from 'pinia';
import { api, tokenStorage } from '@/api/http';

export interface MenuItem { label: string; route: string; icon: string; feature: string }
export interface Bootstrap {
  user: { id: string; name: string; email: string; role: 'owner' | 'manager' | 'staff' };
  tenant: { id: string; name: string; preset: string; presetLabel: string };
  features: string[];
  settings: { taxRatePercent: number; taxMode: 'inclusive' | 'exclusive' };
  menu: MenuItem[];
  theme: { primary: string };
  locale: string;
}

export const useSession = defineStore('session', {
  state: () => ({
    boot: null as Bootstrap | null,
    operator: null as { name: string; email: string } | null,
  }),
  getters: {
    isAuthed: (s) => !!s.boot || !!s.operator,
    featureSet: (s) => new Set(s.boot?.features ?? []),
  },
  actions: {
    has(feature: string) {
      return this.featureSet.has(feature);
    },
    async login(email: string, password: string) {
      const r = await api<{ accessToken: string; role: string }>('/auth/login', { body: { email, password } });
      tokenStorage.set(r.accessToken);
      if (r.role === 'operator') {
        await this.loadOperator();
        return;
      }
      this.operator = null;
      await this.loadBootstrap();
    },
    async registerTenant(dto: { tenantName: string; preset: string; fullName: string; email: string; password: string }) {
      return api<{ status: 'pending' }>('/auth/register-tenant', { body: dto });
    },
    async loadBootstrap() {
      this.operator = null;
      this.boot = await api<Bootstrap>('/me/bootstrap');
    },
    async loadOperator() {
      this.boot = null;
      this.operator = await api<{ name: string; email: string }>('/ops/me');
    },
    logout() {
      tokenStorage.clear();
      window.location.href = '/login'; // tải lại trang để bỏ hết route vertical đã nạp
    },
  },
});
