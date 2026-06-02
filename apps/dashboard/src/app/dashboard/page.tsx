'use client';

import { useEffect, useState } from 'react';
import { fetchDashboard, fetchActivityFeed } from '@/lib/api';
import { Users, ShoppingCart, Bell, Smartphone, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface OverviewData {
  employees: { active: number };
  sales: {
    today: { amount: number; count: number };
    month: { amount: number; count: number };
  };
  alerts: { open: number; critical: number };
  devices: { online: number; total: number };
  content: { pending: number };
  messages: { flaggedToday: number };
}

function StatCard({ title, value, sub, icon: Icon, accent }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${accent ?? 'text-white'}`}>{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 bg-slate-700 rounded-lg">
          <Icon className="w-5 h-5 text-slate-300" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [feed, setFeed] = useState<Array<{ kind: string; ts: string; data: Record<string, unknown> }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchDashboard(), fetchActivityFeed(15)])
      .then(([ov, af]) => {
        setOverview(ov as OverviewData);
        setFeed(af as typeof feed);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Vue d'ensemble</h2>
        <p className="text-slate-400 text-sm mt-0.5">Tableau de bord opérationnel en temps réel</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          title="Employés actifs"
          value={overview.employees.active}
          icon={Users}
        />
        <StatCard
          title="Ventes aujourd'hui"
          value={`${Number(overview.sales.today.amount).toLocaleString('fr-MA')} MAD`}
          sub={`${overview.sales.today.count} transaction(s)`}
          icon={ShoppingCart}
        />
        <StatCard
          title="Ventes du mois"
          value={`${Number(overview.sales.month.amount).toLocaleString('fr-MA')} MAD`}
          sub={`${overview.sales.month.count} transactions`}
          icon={ShoppingCart}
        />
        <StatCard
          title="Alertes ouvertes"
          value={overview.alerts.open}
          sub={`${overview.alerts.critical} critiques`}
          icon={Bell}
          accent={overview.alerts.critical > 0 ? 'text-red-400' : 'text-white'}
        />
        <StatCard
          title="Appareils en ligne"
          value={`${overview.devices.online} / ${overview.devices.total}`}
          icon={Smartphone}
        />
        <StatCard
          title="Contenu en attente"
          value={overview.content.pending}
          icon={Clock}
        />
        <StatCard
          title="Messages signalés"
          value={overview.messages.flaggedToday}
          sub="Aujourd'hui"
          icon={AlertTriangle}
          accent={overview.messages.flaggedToday > 0 ? 'text-amber-400' : 'text-white'}
        />
      </div>

      {/* Activity Feed */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-4">Activité récente</h3>
        <div className="space-y-3">
          {feed.map((item, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-700 last:border-0">
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                item.kind === 'alert' ? 'bg-red-500' :
                item.kind === 'sale' ? 'bg-green-500' : 'bg-amber-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">
                  {item.kind === 'sale'
                    ? `Vente: ${(item.data as Record<string, string>).clientName} — ${Number((item.data as Record<string, number>).amount).toLocaleString()} MAD`
                    : item.kind === 'alert'
                    ? `Alerte: ${(item.data as Record<string, string>).title}`
                    : `Violation: ${(item.data as Record<string, string>).description}`
                  }
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDistanceToNow(new Date(item.ts), { addSuffix: true, locale: fr })}
                </p>
              </div>
            </div>
          ))}
          {feed.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">Aucune activité récente</p>
          )}
        </div>
      </div>
    </div>
  );
}
