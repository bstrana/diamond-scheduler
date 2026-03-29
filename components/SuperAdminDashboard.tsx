import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Building2, Search, ShieldCheck, Users, Activity,
  ChevronDown, ChevronUp, Check, X, Edit2, RefreshCw,
  LogOut, Infinity, AlertTriangle, Calendar, Link, Trophy, BarChart3
} from 'lucide-react';
import { Tenant, TenantPlan, TenantLimits, PLAN_LIMITS } from '../types';
import * as storageApi from '../services/storage';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuperAdminDashboardProps {
  onSignOut: () => void;
  keycloakToken?: string;
}

const PLAN_ORDER: TenantPlan[] = ['free', 'starter', 'pro', 'enterprise'];

const PLAN_LABELS: Record<TenantPlan, string> = {
  free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise',
};

const PLAN_BADGE: Record<TenantPlan, string> = {
  free:       'bg-slate-100 text-slate-600',
  starter:    'bg-sky-100 text-sky-700',
  pro:        'bg-indigo-100 text-indigo-700',
  enterprise: 'bg-violet-100 text-violet-700',
};

const UNLIMITED = 999;

function fmt(n: number) { return n >= UNLIMITED ? '∞' : String(n); }

function UsageBar({ used, max, label }: { used: number; max: number; label: string }) {
  const unlimited = max >= UNLIMITED;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / max) * 100));
  const warn = !unlimited && pct >= 80;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className={warn ? 'text-amber-600 font-semibold' : ''}>
          {used}{unlimited ? '' : ` / ${fmt(max)}`}
        </span>
      </div>
      {!unlimited && (
        <div className="w-full h-1 rounded-full bg-slate-100">
          <div
            className={`h-1 rounded-full ${warn ? 'bg-amber-400' : 'bg-indigo-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function PlanBadge({ plan }: { plan: TenantPlan }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_BADGE[plan]}`}>
      {PLAN_LABELS[plan]}
    </span>
  );
}

function OrgInitial({ name }: { name: string }) {
  const ch = (name || '?')[0].toUpperCase();
  return (
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-base shrink-0">
      {ch}
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  tenant: Tenant;
  onSave: (patch: Partial<Pick<Tenant, 'plan' | 'limits' | 'active' | 'trialEndsAt' | 'name'>>) => Promise<void>;
  onClose: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ tenant, onSave, onClose }) => {
  const [plan, setPlan]           = useState<TenantPlan>(tenant.plan);
  const [active, setActive]       = useState(tenant.active);
  const [trialDate, setTrialDate] = useState(tenant.trialEndsAt ? tenant.trialEndsAt.slice(0, 10) : '');
  const [customLimits, setCustom] = useState(false);
  const [limits, setLimits]       = useState<TenantLimits>({ ...tenant.limits });
  const [saving, setSaving]       = useState(false);

  // When plan changes, reset limits to plan defaults (unless custom is on)
  const handlePlanChange = (p: TenantPlan) => {
    setPlan(p);
    if (!customLimits) setLimits({ ...PLAN_LIMITS[p] });
  };

  const handleCustomToggle = (on: boolean) => {
    setCustom(on);
    if (!on) setLimits({ ...PLAN_LIMITS[plan] });
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      plan,
      active,
      trialEndsAt: trialDate || undefined,
      limits: customLimits ? limits : PLAN_LIMITS[plan],
    });
    setSaving(false);
  };

  const limitFields: Array<{ key: keyof TenantLimits; label: string }> = [
    { key: 'leagues',            label: 'Leagues' },
    { key: 'teams',              label: 'Teams' },
    { key: 'scoreLinks',         label: 'Score Links' },
    { key: 'publishedSchedules', label: 'Published Schedules' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <OrgInitial name={tenant.name || tenant.orgId} />
            <div>
              <p className="font-semibold text-slate-800">{tenant.name || tenant.orgId}</p>
              <p className="text-xs text-slate-400 font-mono">{tenant.orgId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Plan */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Plan</label>
            <div className="grid grid-cols-2 gap-2">
              {PLAN_ORDER.map(p => (
                <button
                  key={p}
                  onClick={() => handlePlanChange(p)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                    plan === p
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {PLAN_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Account Active</p>
              <p className="text-xs text-slate-400">Inactive accounts are suspended from the app</p>
            </div>
            <button
              onClick={() => setActive(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${active ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {/* Trial date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Trial End Date</label>
            <input
              type="date"
              value={trialDate}
              onChange={e => setTrialDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">Clear to remove trial. Leave empty for permanent plan.</p>
          </div>

          {/* Custom limits */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Custom Limits</p>
                <p className="text-xs text-slate-400">Override the plan defaults for this org</p>
              </div>
              <button
                onClick={() => handleCustomToggle(!customLimits)}
                className={`relative w-11 h-6 rounded-full transition-colors ${customLimits ? 'bg-indigo-500' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${customLimits ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {customLimits && (
              <div className="grid grid-cols-2 gap-3">
                {limitFields.map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-500 mb-1">{label}</label>
                    <input
                      type="number"
                      min={0}
                      value={limits[key]}
                      onChange={e => setLimits(prev => ({ ...prev, [key]: parseInt(e.target.value, 10) || 0 }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    />
                    <p className="text-xs text-slate-400 mt-0.5">Plan default: {fmt(PLAN_LIMITS[plan][key])}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Tenant Card ──────────────────────────────────────────────────────────────

interface TenantCardProps {
  tenant: Tenant;
  onEdit: (t: Tenant) => void;
}

const TenantCard: React.FC<TenantCardProps> = ({ tenant, onEdit }) => {
  const trialDays = tenant.trialEndsAt
    ? Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86_400_000)
    : null;
  const trialExpired = trialDays !== null && trialDays <= 0;

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 space-y-4 transition-all hover:shadow-md ${!tenant.active ? 'opacity-60 border-red-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <OrgInitial name={tenant.name || tenant.orgId} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{tenant.name || '—'}</p>
            <p className="text-xs text-slate-400 font-mono truncate">{tenant.orgId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PlanBadge plan={tenant.plan} />
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tenant.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
            {tenant.active ? 'Active' : 'Suspended'}
          </span>
          <button
            onClick={() => onEdit(tenant)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Edit tenant"
          >
            <Edit2 size={15} />
          </button>
        </div>
      </div>

      {/* Trial warning */}
      {trialDays !== null && trialDays <= 7 && (
        <div className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 ${trialExpired ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
          <AlertTriangle size={12} />
          {trialExpired ? 'Trial expired' : `Trial expires in ${trialDays} day${trialDays === 1 ? '' : 's'}`}
        </div>
      )}

      {/* Usage bars */}
      <div className="space-y-2">
        <UsageBar used={0} max={tenant.limits.leagues}            label="Leagues" />
        <UsageBar used={0} max={tenant.limits.teams}              label="Teams" />
        <UsageBar used={0} max={tenant.limits.scoreLinks}         label="Score Links" />
        <UsageBar used={0} max={tenant.limits.publishedSchedules} label="Schedules" />
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onSignOut, keycloakToken }) => {
  const [tenants, setTenants]     = useState<Tenant[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [planFilter, setPlanFilter] = useState<TenantPlan | 'all'>('all');
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [sortBy, setSortBy]       = useState<'name' | 'plan' | 'created'>('name');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('asc');

  const load = useCallback(async () => {
    setLoading(true);
    if (keycloakToken) storageApi.authenticatePocketBase(keycloakToken);
    const all = await storageApi.listAllTenants();
    setTenants(all);
    setLoading(false);
  }, [keycloakToken]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const total   = tenants.length;
    const active  = tenants.filter(t => t.active).length;
    const byPlan  = PLAN_ORDER.reduce((acc, p) => ({ ...acc, [p]: tenants.filter(t => t.plan === p).length }), {} as Record<TenantPlan, number>);
    const trials  = tenants.filter(t => t.trialEndsAt && new Date(t.trialEndsAt) > new Date()).length;
    return { total, active, byPlan, trials };
  }, [tenants]);

  const filtered = useMemo(() => {
    let list = [...tenants];
    if (planFilter !== 'all') list = list.filter(t => t.plan === planFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        t.orgId.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name')    cmp = (a.name || a.orgId).localeCompare(b.name || b.orgId);
      if (sortBy === 'plan')    cmp = PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan);
      if (sortBy === 'created') cmp = (a.created || '').localeCompare(b.created || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [tenants, planFilter, search, sortBy, sortDir]);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const handleSave = async (patch: Parameters<EditModalProps['onSave']>[0]) => {
    if (!editingTenant?.id) return;
    const updated = await storageApi.updateTenant(editingTenant.id, patch);
    if (updated) {
      setTenants(prev => prev.map(t => t.id === updated.id ? updated : t));
      setEditingTenant(null);
    }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return null;
    return sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">SuperAdmin Dashboard</h1>
              <p className="text-xs text-slate-400">Diamond Scheduler · Tenant Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users,    label: 'Total Orgs',    value: stats.total,  color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { icon: Activity, label: 'Active',        value: stats.active, color: 'text-emerald-600',bg: 'bg-emerald-50' },
            { icon: Calendar, label: 'On Trial',      value: stats.trials, color: 'text-amber-600',  bg: 'bg-amber-50'  },
            { icon: BarChart3,label: 'Inactive',      value: stats.total - stats.active, color: 'text-red-500', bg: 'bg-red-50' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plan breakdown */}
        <div className="grid grid-cols-4 gap-3">
          {PLAN_ORDER.map(p => (
            <button
              key={p}
              onClick={() => setPlanFilter(planFilter === p ? 'all' : p)}
              className={`rounded-xl border p-3 text-left transition-all ${planFilter === p ? 'ring-2 ring-indigo-500 border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <p className="text-xl font-bold text-slate-800">{stats.byPlan[p] ?? 0}</p>
              <PlanBadge plan={p} />
            </button>
          ))}
        </div>

        {/* Search + sort bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by org name or ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
            />
          </div>
          <div className="flex gap-1 text-xs font-medium text-slate-500">
            <span className="px-2 py-1">Sort:</span>
            {(['name', 'plan', 'created'] as const).map(col => (
              <button
                key={col}
                onClick={() => handleSort(col)}
                className={`flex items-center gap-0.5 px-2 py-1.5 rounded-lg capitalize ${sortBy === col ? 'bg-slate-200 text-slate-700' : 'hover:bg-slate-100'}`}
              >
                {col} <SortIcon col={col} />
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400">{filtered.length} of {tenants.length}</span>
        </div>

        {/* Tenant grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={20} className="animate-spin mr-2" />
            Loading tenants…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{tenants.length === 0 ? 'No tenants found' : 'No results match your filter'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(t => (
              <TenantCard key={t.id} tenant={t} onEdit={setEditingTenant} />
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingTenant && (
        <EditModal
          tenant={editingTenant}
          onSave={handleSave}
          onClose={() => setEditingTenant(null)}
        />
      )}
    </div>
  );
};

export default SuperAdminDashboard;
