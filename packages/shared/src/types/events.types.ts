// Internal event bus types for Bull queues

export interface GpsTrackEvent {
  employeeId: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: string; // ISO 8601
  batchId?: string;
}

export interface WhatsappMessageEvent {
  whatsappMessageId: string;
  employeeId: string;
  contactPhone: string;
  contactName?: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  content?: string;
  mediaUrl?: string;
  timestamp: string;
  isGroupMessage: boolean;
  groupId?: string;
  groupName?: string;
}

export interface ContentSubmittedEvent {
  submissionId: string;
  creatorId: string;
  platform: string;
  contentType: string;
  fileUrl: string;
  fileHash: string;
}

export interface AlertTriggeredEvent {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  employeeId?: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface MdmPolicyPushEvent {
  deviceId: string;
  employeeId: string;
  policyId: string;
  policyVersion: number;
}

export interface EvidenceArchiveEvent {
  sourceService: string;
  sourceId: string;
  fileUrl: string;
  originalName: string;
  mimeType: string;
  linkedTo: {
    type: 'message' | 'sale' | 'content_submission';
    id: string;
  };
}
