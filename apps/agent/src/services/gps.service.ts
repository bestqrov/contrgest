import BackgroundGeolocation, {
  Location,
} from 'react-native-background-geolocation';
import { api } from './api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BATCH_SIZE = 20;
const BATCH_KEY = '@gps_batch';

class GpsService {
  async configure(): Promise<void> {
    await BackgroundGeolocation.ready({
      // Geolocation config
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 50, // meters — update every 50m movement
      stopTimeout: 5,

      // Android config
      foregroundService: true,
      notification: {
        title: 'FieldOps',
        text: 'Localisation active',
        channelName: 'fieldops-gps',
      },

      // Battery efficiency
      locationUpdateInterval: 30_000, // 30s when stationary
      fastestLocationUpdateInterval: 15_000,

      // Prevent background kill
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,

      // Debug
      debug: false,
      logLevel: BackgroundGeolocation.LOG_LEVEL_WARNING,
    });

    BackgroundGeolocation.onLocation((location) => {
      this.enqueuePoint(location);
    });

    BackgroundGeolocation.onMotionChange((event) => {
      // Adjust accuracy on motion state change
    });
  }

  async start(): Promise<void> {
    await BackgroundGeolocation.start();
  }

  async stop(): Promise<void> {
    await BackgroundGeolocation.stop();
  }

  private async enqueuePoint(location: Location): Promise<void> {
    const raw = await AsyncStorage.getItem(BATCH_KEY);
    const batch: unknown[] = raw ? JSON.parse(raw) : [];

    batch.push({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: new Date(location.timestamp).toISOString(),
    });

    if (batch.length >= BATCH_SIZE) {
      await this.flush(batch);
    } else {
      await AsyncStorage.setItem(BATCH_KEY, JSON.stringify(batch));
    }
  }

  async flush(batch?: unknown[]): Promise<void> {
    let points = batch;
    if (!points) {
      const raw = await AsyncStorage.getItem(BATCH_KEY);
      points = raw ? JSON.parse(raw) : [];
    }

    if (!points || points.length === 0) return;

    try {
      await api.post('/gps/track', points);
      await AsyncStorage.removeItem(BATCH_KEY);
    } catch {
      // Keep batch for retry
    }
  }
}

export const gpsService = new GpsService();
