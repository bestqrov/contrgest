export const QUEUES = {
  GPS_TRACKS: 'gps-tracks',
  GPS_ANOMALY_CHECK: 'gps-anomaly-check',
  WHATSAPP_MESSAGES: 'whatsapp-messages',
  WHATSAPP_FLAG_CHECK: 'whatsapp-flag-check',
  CONTENT_REVIEW: 'content-review',
  EVIDENCE_ARCHIVE: 'evidence-archive',
  ALERTS: 'alerts',
  ALERT_NOTIFICATIONS: 'alert-notifications',
  MDM_POLICY_PUSH: 'mdm-policy-push',
  MDM_DEVICE_SYNC: 'mdm-device-sync',
  COMMISSION_CALCULATE: 'commission-calculate',
  CONTENT_STATS_SYNC: 'content-stats-sync',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
