import axios from 'axios';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MDM_URL = process.env.REACT_NATIVE_MDM_URL ?? 'https://api.yourcompany.ma';
const CHECKIN_INTERVAL_MS = 5 * 60_000; // 5 minutes

interface MdmPolicy {
  allowedApps: string[];
  blockedApps: string[];
  policyVersion: number;
  commands?: Array<{ action: string; packages?: string[] }>;
}

class MdmService {
  private deviceId: string | null = null;
  private checkinTimer?: ReturnType<typeof setInterval>;

  async initialize(): Promise<void> {
    this.deviceId = await AsyncStorage.getItem('@device_id');
  }

  async enroll(enrollmentToken: string): Promise<void> {
    const imei = await DeviceInfo.getUniqueId();
    const serialNumber = await DeviceInfo.getSerialNumber();
    const model = DeviceInfo.getModel();
    const androidVersion = DeviceInfo.getSystemVersion();
    const appVersion = DeviceInfo.getVersion();

    const response = await axios.post(`${MDM_URL}/enrollment/complete`, {
      imei,
      serialNumber: serialNumber || `SN-${imei}`,
      model,
      androidVersion,
      appVersion,
      enrollmentToken,
    });

    if (response.data.success) {
      this.deviceId = response.data.data.deviceId;
      await AsyncStorage.setItem('@device_id', this.deviceId!);
      await this.applyPolicy(response.data.data.policy);
    }
  }

  startCheckins(): void {
    this.checkinTimer = setInterval(() => this.checkin(), CHECKIN_INTERVAL_MS);
    this.checkin(); // Immediate first check-in
  }

  stopCheckins(): void {
    if (this.checkinTimer) clearInterval(this.checkinTimer);
  }

  private async checkin(): Promise<void> {
    if (!this.deviceId) return;

    try {
      const batteryLevel = Math.round(await DeviceInfo.getBatteryLevel() * 100);
      const freeDiskStorage = await DeviceInfo.getFreeDiskStorage();
      const totalDiskCapacity = await DeviceInfo.getTotalDiskCapacity();
      const policyVersion = parseInt(await AsyncStorage.getItem('@policy_version') ?? '0', 10);
      const appVersion = DeviceInfo.getVersion();

      const { data } = await axios.post(
        `${MDM_URL}/devices/${this.deviceId}/checkin`,
        {
          batteryLevel,
          storageUsedMb: Math.round((totalDiskCapacity - freeDiskStorage) / 1024 / 1024),
          totalStorageMb: Math.round(totalDiskCapacity / 1024 / 1024),
          appVersion,
          policyVersion,
        },
      );

      if (data.data.needsPolicyUpdate) {
        await this.applyPolicy(data.data.policy);
        await AsyncStorage.setItem('@policy_version', String(data.data.policyVersion));
      }

      // Execute commands
      for (const cmd of (data.data.commands ?? [])) {
        if (cmd.action === 'UNINSTALL_APPS') {
          // Signal the MDM agent to uninstall apps via Android intent
          console.warn('MDM: Uninstall requested for', cmd.packages);
        }
      }
    } catch {
      // Silent fail — will retry on next interval
    }
  }

  private async applyPolicy(policy: Partial<MdmPolicy>): Promise<void> {
    if (policy) {
      await AsyncStorage.setItem('@mdm_policy', JSON.stringify(policy));
    }
  }
}

export const mdmService = new MdmService();
