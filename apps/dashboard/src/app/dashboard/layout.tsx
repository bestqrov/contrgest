'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Smartphone, ShoppingCart, MapPin,
  Bell, MessageSquare, Video, UserCheck, FileText, LogOut,
} from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { href: '/dashboard/employees', label: 'Employés', icon: Users },
  { href: '/dashboard/devices', label: 'Appareils', icon: Smartphone },
  { href: '/dashboard/sales', label: 'Ventes', icon: ShoppingCart },
  { href: '/dashboard/gps', label: 'GPS Temps réel', icon: MapPin },
  { href: '/dashboard/alerts', label: 'Alertes', icon: Bell },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/content', label: 'Contenu', icon: Video },
  { href: '/dashboard/creators', label: 'Créateurs', icon: UserCheck },
  { href: '/dashboard/contracts', label: 'Contrats', icon: FileText },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-800 border-r border-slate-700 flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-slate-700">
          <h1 className="text-lg font-bold text-white">FieldOps</h1>
          <p className="text-xs text-slate-400">Contrôle opérationnel</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700',
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 border-t border-slate-700 pt-4">
          <button
            onClick={() => {
              localStorage.removeItem('refreshToken');
              window.location.href = '/auth/login';
            }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
