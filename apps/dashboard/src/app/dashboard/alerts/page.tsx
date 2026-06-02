'use client';

import { useEffect, useState } from 'react';
import { fetchAlerts, apiClient } from '@/lib/api';
import { Bell, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Alert {
  id: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  createdAt: string;
  employee?: { firstName: string; lastName: string };
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-900/30 border-red-700',
  HIGH: 'text-orange-400 bg-orange-900/30 border-orange-700',
  MEDIUM: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',
  LOW: 'text-blue-400 bg-blue-900/30 border-blue-700',
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'>('OPEN');

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await fetchAlerts({ status: filter });
      setAlerts((data as { data: Alert[] }).data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAlerts(); }, [filter]);

  const acknowledge = async (id: string) => {
    await apiClient.patch(`/alerts/${id}/acknowledge`);
    loadAlerts();
  };

  const resolve = async (id: string) => {
    await apiClient.patch(`/alerts/${id}/resolve`);
    loadAlerts();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Alertes</h2>
          <p className="text-slate-400 text-sm">Surveillance des anomalies et incidents</p>
        </div>
        <div className="flex gap-2">
          {(['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {s === 'OPEN' ? 'Ouvertes' : s === 'ACKNOWLEDGED' ? 'Reconnues' : 'Résolues'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-xl p-4 ${SEVERITY_COLORS[alert.severity] ?? 'bg-slate-800 border-slate-700 text-slate-300'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Bell className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{alert.title}</p>
                    <p className="text-xs opacity-80 mt-0.5">{alert.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs opacity-60">
                      <span>{alert.type.replace(/_/g, ' ')}</span>
                      {alert.employee && (
                        <span>{alert.employee.firstName} {alert.employee.lastName}</span>
                      )}
                      <span>{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: fr })}</span>
                    </div>
                  </div>
                </div>

                {alert.status === 'OPEN' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => acknowledge(alert.id)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-yellow-700/40 hover:bg-yellow-700/60 text-yellow-300 rounded-lg text-xs"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Reconnaître
                    </button>
                    <button
                      onClick={() => resolve(alert.id)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-green-700/40 hover:bg-green-700/60 text-green-300 rounded-lg text-xs"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Résoudre
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Aucune alerte {filter === 'OPEN' ? 'ouverte' : filter === 'ACKNOWLEDGED' ? 'reconnue' : 'résolue'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
