'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchLiveGps } from '@/lib/api';
import { MapPin, RefreshCw } from 'lucide-react';

interface LiveEmployee {
  employeeId: string;
  name: string;
  role: string;
  zone: string | null;
  lastLocation: {
    latitude: string;
    longitude: string;
    speed: number | null;
    timestamp: string;
  } | null;
}

export default function GpsPage() {
  const [employees, setEmployees] = useState<LiveEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const mapRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      const data = await fetchLiveGps();
      setEmployees(data as LiveEmployee[]);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, []);

  const withLocation = employees.filter((e) => e.lastLocation !== null);
  const withoutLocation = employees.filter((e) => e.lastLocation === null);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">GPS Temps réel</h2>
          <p className="text-slate-400 text-sm">
            Actualisé: {lastRefresh.toLocaleTimeString('fr-MA')} · {withLocation.length}/{employees.length} localisés
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* Map placeholder — integrate Leaflet with useEffect to avoid SSR issues */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl h-96 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Carte interactive</p>
          <p className="text-xs">Intégrer Leaflet avec les coordonnées des employés</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-left max-w-xs mx-auto">
            {withLocation.slice(0, 4).map((e) => (
              <div key={e.employeeId} className="bg-slate-700 rounded p-2">
                <p className="text-white font-medium">{e.name}</p>
                <p className="text-slate-400">{e.lastLocation?.latitude.slice(0, 8)}, {e.lastLocation?.longitude.slice(0, 8)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Employee list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {employees.map((emp) => (
          <div key={emp.employeeId} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${emp.lastLocation ? 'bg-green-500' : 'bg-slate-500'}`} />
              <div>
                <p className="text-sm font-medium text-white">{emp.name}</p>
                <p className="text-xs text-slate-400">{emp.role} · {emp.zone ?? 'Zone non définie'}</p>
                {emp.lastLocation ? (
                  <div className="mt-1.5 text-xs text-slate-500 space-y-0.5">
                    <p>{Number(emp.lastLocation.latitude).toFixed(5)}, {Number(emp.lastLocation.longitude).toFixed(5)}</p>
                    {emp.lastLocation.speed !== null && (
                      <p>{(emp.lastLocation.speed * 3.6).toFixed(0)} km/h</p>
                    )}
                    <p>{new Date(emp.lastLocation.timestamp).toLocaleTimeString('fr-MA')}</p>
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-600">Pas de position</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading && employees.length === 0 && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
