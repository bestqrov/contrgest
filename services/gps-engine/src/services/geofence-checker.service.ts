import { prisma, AlertType, AlertSeverity, AlertStatus } from '@field-ops/db';
import { isInsideGeofence, createLogger } from '@field-ops/shared';
import axios from 'axios';

const logger = createLogger('gps-engine:geofence');

class GeofenceChecker {
  async runCheck(): Promise<void> {
    const activeGeofences = await prisma.geofence.findMany({ where: { isActive: true } });
    if (activeGeofences.length === 0) return;

    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE', zone: { not: null } },
      include: {
        gpsTracks: { orderBy: { timestamp: 'desc' }, take: 1 },
      },
    });

    for (const employee of employees) {
      const lastTrack = employee.gpsTracks[0];
      if (!lastTrack) continue;

      // Skip stale tracks (> 30 mins old)
      if (Date.now() - lastTrack.timestamp.getTime() > 30 * 60_000) continue;

      const relevantFences = activeGeofences.filter(
        (gf) => gf.zones.length === 0 || gf.zones.includes(employee.zone!),
      );

      let insideAny = false;
      for (const fence of relevantFences) {
        if (
          isInsideGeofence(
            Number(lastTrack.latitude),
            Number(lastTrack.longitude),
            Number(fence.centerLat),
            Number(fence.centerLon),
            fence.radiusMeters,
          )
        ) {
          insideAny = true;
          break;
        }
      }

      if (!insideAny && relevantFences.length > 0) {
        await this.handleBreach(employee.id, lastTrack.id, Number(lastTrack.latitude), Number(lastTrack.longitude));
      }
    }
  }

  private async handleBreach(
    employeeId: string,
    trackId: string,
    lat: number,
    lon: number,
  ): Promise<void> {
    const recentAlert = await prisma.alert.findFirst({
      where: {
        type: AlertType.GEOFENCE_BREACH,
        employeeId,
        status: AlertStatus.OPEN,
        createdAt: { gte: new Date(Date.now() - 60 * 60_000) },
      },
    });

    if (recentAlert) return;

    logger.warn('Geofence breach', { employeeId, lat, lon });

    await prisma.alert.create({
      data: {
        type: AlertType.GEOFENCE_BREACH,
        severity: AlertSeverity.MEDIUM,
        status: AlertStatus.OPEN,
        employeeId,
        title: 'Employee Outside Assigned Zone',
        description: `Employee detected outside their assigned geofence at coordinates ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
        metadata: { trackId, latitude: lat, longitude: lon },
      },
    });

    const alertEngineUrl = process.env.ALERT_ENGINE_INTERNAL_URL;
    if (alertEngineUrl) {
      await axios.post(
        `${alertEngineUrl}/internal/notify`,
        { type: 'GEOFENCE_BREACH', employeeId, lat, lon },
        { headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET }, timeout: 5000 },
      ).catch(() => null);
    }
  }
}

export const geofenceChecker = new GeofenceChecker();
