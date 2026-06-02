import { prisma, AlertType, AlertSeverity, AlertStatus } from '@field-ops/db';
import { speedBetweenPointsKmh, createLogger } from '@field-ops/shared';
import axios from 'axios';

const logger = createLogger('gps-engine:anomaly-detector');
const SPEED_THRESHOLD = parseFloat(process.env.GPS_ANOMALY_SPEED_THRESHOLD_KMH ?? '150');

class AnomalyDetector {
  private lastChecked = new Map<string, Date>();

  async runCheck(): Promise<void> {
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    await Promise.allSettled(employees.map((e) => this.checkEmployee(e.id)));
  }

  private async checkEmployee(employeeId: string): Promise<void> {
    const since = this.lastChecked.get(employeeId) ?? new Date(Date.now() - 2 * 60_000);
    this.lastChecked.set(employeeId, new Date());

    const tracks = await prisma.gpsTrack.findMany({
      where: { employeeId, timestamp: { gte: since }, isAnomaly: false },
      orderBy: { timestamp: 'asc' },
    });

    if (tracks.length < 2) return;

    for (let i = 1; i < tracks.length; i++) {
      const prev = tracks[i - 1];
      const curr = tracks[i];

      const speed = speedBetweenPointsKmh(
        Number(prev.latitude),
        Number(prev.longitude),
        prev.timestamp,
        Number(curr.latitude),
        Number(curr.longitude),
        curr.timestamp,
      );

      if (speed > SPEED_THRESHOLD) {
        logger.warn('Speed anomaly detected', { employeeId, speed, threshold: SPEED_THRESHOLD });

        await prisma.gpsTrack.update({
          where: { id: curr.id },
          data: {
            isAnomaly: true,
            anomalyNote: `Impossible speed: ${speed.toFixed(1)} km/h (threshold: ${SPEED_THRESHOLD})`,
          },
        });

        await this.createAlert(employeeId, speed, curr.id);
      }
    }
  }

  private async createAlert(employeeId: string, speed: number, trackId: string): Promise<void> {
    const existing = await prisma.alert.findFirst({
      where: {
        type: AlertType.GPS_DEVIATION,
        employeeId,
        status: AlertStatus.OPEN,
        createdAt: { gte: new Date(Date.now() - 30 * 60_000) },
      },
    });

    if (existing) return; // Deduplicate alerts within 30 min window

    await prisma.alert.create({
      data: {
        type: AlertType.GPS_DEVIATION,
        severity: AlertSeverity.HIGH,
        status: AlertStatus.OPEN,
        employeeId,
        title: 'GPS Speed Anomaly Detected',
        description: `Calculated speed of ${speed.toFixed(1)} km/h exceeds threshold of ${SPEED_THRESHOLD} km/h`,
        metadata: { trackId, speed, threshold: SPEED_THRESHOLD },
      },
    });

    const alertEngineUrl = process.env.ALERT_ENGINE_INTERNAL_URL;
    if (alertEngineUrl) {
      await axios.post(
        `${alertEngineUrl}/internal/notify`,
        { type: 'GPS_DEVIATION', employeeId, speed },
        { headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET }, timeout: 5000 },
      ).catch(() => null);
    }
  }
}

export const anomalyDetector = new AnomalyDetector();
