import React from 'react';
import { CheckCircle2, Infinity, AlertTriangle, Building2 } from 'lucide-react';
import { Tenant, TenantPlan, TenantLimits, PLAN_LIMITS } from '../types';

interface UsageSnapshot {
  leagues: number;
  teams: number;
  scoreLinks: number;
  publishedSchedules: number;
}

interface TenantLimitsTableProps {
  tenant: Tenant | null;
  usage: UsageSnapshot;
  isSystemAdmin?: boolean;
}

const PLAN_ORDER: TenantPlan[] = ['free', 'starter', 'pro', 'enterprise'];

const PLAN_LABELS: Record<TenantPlan, string> = {
  free:       'Free',
  starter:    'Starter',
  pro:        'Pro',
  enterprise: 'Enterprise',
};

const PLAN_COLOR: Record<TenantPlan, { header: string; ring: string; badge: string }> = {
  free:       { header: 'bg-slate-100  text-slate-700',  ring: 'ring-slate-200',  badge: 'bg-slate-100  text-slate-600'  },
  starter:    { header: 'bg-sky-50     text-sky-700',    ring: 'ring-sky-300',    badge: 'bg-sky-100    text-sky-700'    },
  pro:        { header: 'bg-indigo-50  text-indigo-700', ring: 'ring-indigo-400', badge: 'bg-indigo-100 text-indigo-700' },
  enterprise: { header: 'bg-violet-50  text-violet-700', ring: 'ring-violet-400', badge: 'bg-violet-100 text-violet-700' },
};

const UNLIMITED = 999;

function fmt(n: number): string {
  return n >= UNLIMITED ? '∞' : String(n);
}

type LimitKey = keyof TenantLimits;

const ROWS: Array<{ key: LimitKey; label: string; usageKey: keyof UsageSnapshot }> = [
  { key: 'leagues',            label: 'Leagues',             usageKey: 'leagues'            },
  { key: 'teams',              label: 'Teams',               usageKey: 'teams'              },
  { key: 'scoreLinks',         label: 'Active score links',  usageKey: 'scoreLinks'         },
  { key: 'publishedSchedules', label: 'Published schedules', usageKey: 'publishedSchedules' },
];

function UsageBar({ used, max }: { used: number; max: number }) {
  if (max >= UNLIMITED) return null;
  const pct = Math.min(100, Math.round((used / max) * 100));
  const warn = pct >= 80;
  return (
    <div className="mt-1 w-full">
      <div className="flex justify-between text-xs text-slate-400 mb-0.5">
        <span>{used} used</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-slate-100">
        <div
          className={`h-1.5 rounded-full transition-all ${warn ? 'bg-amber-400' : 'bg-indigo-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const TenantLimitsTable: React.FC<TenantLimitsTableProps> = ({ tenant, usage, isSystemAdmin }) => {
  const currentPlan = tenant?.plan ?? null;
  const effectiveLimits = tenant?.limits ?? null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Tenant header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Building2 size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {tenant?.name ?? 'No tenant configured'}
            </h2>
            <p className="text-sm text-slate-500">
              {tenant
                ? `Plan: ${PLAN_LABELS[tenant.plan]}${tenant.trialEndsAt ? ' (trial)' : ''}`
                : 'Org ID not found in Keycloak token — check §2.4 of KEYCLOAK_INTEGRATION.md'}
            </p>
          </div>
        </div>
        {isSystemAdmin && (
          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-medium">
            system admin
          </span>
        )}
      </div>

      {/* Trial warning */}
      {tenant?.trialEndsAt && (() => {
        const days = Math.ceil((new Date(tenant.trialEndsAt!).getTime() - Date.now()) / 86_400_000);
        if (days > 0 && days <= 14) {
          return (
            <div className="flex items-start space-x-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
              <span>
                Trial expires in <strong>{days} day{days === 1 ? '' : 's'}</strong>. Upgrade to keep your data and limits.
              </span>
            </div>
          );
        }
        return null;
      })()}

      {/* Cross table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 text-slate-500 font-medium bg-slate-50 border-b border-slate-200 w-44">
                Limit
              </th>
              {PLAN_ORDER.map(plan => {
                const isCurrent = plan === currentPlan;
                const { header, ring } = PLAN_COLOR[plan];
                return (
                  <th
                    key={plan}
                    className={`px-4 py-3 text-center font-semibold border-b border-slate-200 ${header} ${isCurrent ? `ring-2 ${ring} ring-inset` : ''}`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <span>{PLAN_LABELS[plan]}</span>
                      {isCurrent && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${PLAN_COLOR[plan].badge}`}>
                          current
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, label, usageKey }, rowIdx) => {
              const used = usage[usageKey];
              return (
                <tr key={key} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="px-4 py-3 font-medium text-slate-700 border-b border-slate-100">
                    {label}
                  </td>
                  {PLAN_ORDER.map(plan => {
                    const isCurrent = plan === currentPlan;
                    // Use actual effective limits for the current plan (may have custom overrides)
                    const limit = isCurrent && effectiveLimits
                      ? effectiveLimits[key]
                      : PLAN_LIMITS[plan][key];
                    const isUnlimited = limit >= UNLIMITED;
                    const { ring } = PLAN_COLOR[plan];

                    return (
                      <td
                        key={plan}
                        className={`px-4 py-3 text-center align-top border-b border-slate-100 ${
                          isCurrent ? `bg-white ring-2 ${ring} ring-inset` : ''
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span className={`font-semibold text-base ${isUnlimited ? 'text-slate-400' : isCurrent ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {isUnlimited
                              ? <Infinity size={16} className="inline" />
                              : fmt(limit)}
                          </span>
                          {isCurrent && !isUnlimited && (
                            <UsageBar used={used} max={limit} />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* System admin: raw limits dump for debugging */}
      {isSystemAdmin && tenant && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer hover:text-slate-600 select-none">
            Raw tenant record (system admin only)
          </summary>
          <pre className="mt-2 bg-slate-50 rounded-lg p-3 overflow-x-auto border border-slate-200 text-slate-600">
            {JSON.stringify({ ...tenant, limits: tenant.limits }, null, 2)}
          </pre>
        </details>
      )}

      <p className="text-xs text-slate-400 text-center">
        Limits apply to your organisation. Contact support to upgrade your plan.
      </p>
    </div>
  );
};

export default TenantLimitsTable;
