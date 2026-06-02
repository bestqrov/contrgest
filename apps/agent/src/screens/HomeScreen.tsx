import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useAuthStore } from '../store/auth.store';
import { gpsService } from '../services/gps.service';
import { api } from '../services/api.service';

interface DashboardStats {
  salesCount: number;
  salesTotalMAD: number;
  lastLocation?: { lat: number; lon: number; at: string };
}

export function HomeScreen() {
  const { employee, logout } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [gpsActive, setGpsActive] = useState(false);

  useEffect(() => {
    loadStats();
    startGps();
    return () => { gpsService.stop(); };
  }, []);

  const loadStats = async () => {
    try {
      const { data } = await api.get(`/employees/${employee?.id}/stats`);
      if (data.success) {
        setStats({
          salesCount: data.data.sales.count,
          salesTotalMAD: data.data.sales.total,
          lastLocation: data.data.lastLocation
            ? { lat: data.data.lastLocation.lat, lon: data.data.lastLocation.lon, at: data.data.lastLocation.at }
            : undefined,
        });
      }
    } catch { /* ignore */ }
  };

  const startGps = async () => {
    try {
      await gpsService.configure();
      await gpsService.start();
      setGpsActive(true);
    } catch (err) {
      console.warn('GPS start failed:', err);
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: async () => {
        await gpsService.stop();
        await logout();
      }},
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour,</Text>
          <Text style={styles.name}>{employee?.firstName} {employee?.lastName}</Text>
          <Text style={styles.role}>{employee?.role}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Déco</Text>
        </TouchableOpacity>
      </View>

      {/* GPS Status */}
      <View style={[styles.card, { borderColor: gpsActive ? '#22c55e' : '#ef4444' }]}>
        <View style={styles.cardRow}>
          <View style={[styles.dot, { backgroundColor: gpsActive ? '#22c55e' : '#ef4444' }]} />
          <Text style={styles.cardTitle}>GPS {gpsActive ? 'Actif' : 'Inactif'}</Text>
        </View>
        {stats?.lastLocation && (
          <Text style={styles.cardSub}>
            {stats.lastLocation.lat.toFixed(5)}, {stats.lastLocation.lon.toFixed(5)}
          </Text>
        )}
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.salesCount}</Text>
            <Text style={styles.statLabel}>Ventes (30j)</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{Number(stats.salesTotalMAD).toLocaleString('fr-MA')}</Text>
            <Text style={styles.statLabel}>MAD (30j)</Text>
          </View>
        </View>
      )}

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Actions rapides</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionText}>+ Nouvelle vente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionText}>Synchroniser GPS</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 24,
  },
  greeting: { fontSize: 14, color: '#94a3b8' },
  name: { fontSize: 22, fontWeight: '700', color: '#f8fafc', marginTop: 2 },
  role: { fontSize: 12, color: '#64748b', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  logoutBtn: {
    backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  logoutText: { color: '#94a3b8', fontSize: 13 },
  card: {
    backgroundColor: '#1e293b', borderRadius: 12, padding: 16,
    borderWidth: 1, marginBottom: 16,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#334155', alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '700', color: '#3b82f6' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#94a3b8', marginBottom: 12 },
  actions: { gap: 10 },
  actionBtn: {
    backgroundColor: '#1e293b', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#334155', alignItems: 'center',
  },
  actionText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
});
