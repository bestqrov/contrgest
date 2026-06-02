export const QUEUES = {
  // WhatsApp logger
  WA_EVENTS:              'whatsapp:events',
  WA_MEDIA_DOWNLOAD:      'whatsapp:media',
  WA_FLAG_CHECK:          'whatsapp:flag-check',

  // GPS engine
  GPS_ANOMALY_CHECK:      'gps:anomaly-check',
  GPS_ROUTE_EXPORT:       'gps:route-export',

  // Evidence vault
  EVIDENCE_ARCHIVE:       'evidence:archive',

  // Content guard
  CONTENT_REVIEW:         'content:review',
  CONTENT_MONITOR:        'content:monitor',

  // Alert engine
  ALERTS:                 'alerts',
  ALERT_NOTIFY:           'alerts:notify',

  // MDM
  MDM_POLICY_PUSH:        'mdm:policy-push',
  MDM_HEARTBEAT_CHECK:    'mdm:heartbeat-check',

  // Creator / commission
  COMMISSION_CALCULATE:   'commission:calculate',
  INTEGRITY_CALCULATE:    'integrity:calculate',
  CONTENT_STATS_SYNC:     'content:stats-sync',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
