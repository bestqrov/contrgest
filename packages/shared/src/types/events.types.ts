// Typed payloads for Redis pub/sub channels and Socket.io events

export interface GpsUpdatePayload {
  employeeId: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  batteryLevel: number | null;
  timestamp: string;
}

export interface AlertNewPayload {
  alertId: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  employeeId: string | null;
  deviceId: string | null;
  evidenceLinks: string[];
  recommendedAction: string | null;
  createdAt: string;
}

export interface WaMessageDeletedPayload {
  messageId: string;
  whatsappMessageId: string;
  employeeId: string;
  deletedAt: string;
  originalTimestamp: string;
  minutesSinceSend: number;
}

export interface WaMessageNewPayload {
  messageId: string;
  employeeId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  timestamp: string;
  isFlagged: boolean;
}

export interface ContentSubmittedPayload {
  submissionId: string;
  creatorId: string;
  platform: string;
  status: string;
  createdAt: string;
}

export interface GpsAnomalyPayload {
  anomalyId: string;
  employeeId: string;
  deviceId: string;
  type: 'LONG_STOP' | 'ROUTE_DEVIATION' | 'OFFLINE';
  latitude: number | null;
  longitude: number | null;
  startedAt: string;
}

export interface WaSaleDetectedPayload {
  employeeId: string;
  messageId: string;
  detectedAmount: number | null;
  clientPhone: string | null;
  timestamp: string;
}

export interface DeviceFactoryResetPayload {
  deviceId: string;
  employeeId: string;
  imei: string;
  timestamp: string;
  snapshotPath: string | null;
}

export interface Sim2SuspiciousPayload {
  simActivityId: string;
  deviceId: string;
  employeeId: string;
  contactNumber: string;
  activityType: string;
  timestamp: string;
  flagReason: string;
}

// ─── Socket.io event maps (server → dashboard) ────────────────────────────────

export interface ServerToClientEvents {
  'alert:new':            (payload: AlertNewPayload) => void;
  'gps:update':           (payload: GpsUpdatePayload) => void;
  'message:new':          (payload: WaMessageNewPayload) => void;
  'message:deleted':      (payload: WaMessageDeletedPayload) => void;
  'content:submitted':    (payload: ContentSubmittedPayload) => void;
  'gps:anomaly':          (payload: GpsAnomalyPayload) => void;
  'device:reset-attempt': (payload: DeviceFactoryResetPayload) => void;
}

// Dashboard sends nothing upstream currently
export interface ClientToServerEvents {
  join: (room: string) => void;
}
