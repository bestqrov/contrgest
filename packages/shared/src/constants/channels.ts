export const REDIS_CHANNELS = {
  WA_MESSAGE_DELETED:         'wa:message:deleted',
  WA_MESSAGE_NEW:             'wa:message:new',
  WA_SALE_DETECTED:           'wa:sale:detected',
  GPS_UPDATE:                 'gps:update',
  GPS_ANOMALY:                'gps:anomaly',
  CONTENT_SUBMITTED:          'content:submitted',
  CONTENT_PUBLISHED_NO_TOKEN: 'content:published:no-token',
  CONTENT_DELETED_EXTERNALLY: 'content:deleted:external',
  DEVICE_OFFLINE:             'device:offline',
  DEVICE_FACTORY_RESET:       'device:factory-reset',
  MDM_DUPLICATE_IMEI:         'mdm:duplicate-imei',
  COMMISSION_DISCREPANCY:     'commission:discrepancy',
  ALERT_NEW:                  'alert:new',
  SIM2_SUSPICIOUS:            'sim:suspicious',
} as const;

export type RedisChannel = (typeof REDIS_CHANNELS)[keyof typeof REDIS_CHANNELS];
