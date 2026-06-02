import type { Job } from 'bullmq';
import { prisma, MessageDirection, MessageType } from '@field-ops/db';
import { createLogger, publish, REDIS_CHANNELS } from '@field-ops/shared';
import type { EvolutionWebhookEvent } from '../handlers/webhook.handler';
import { flagChecker } from './flag-checker.service';
import { waMediaQueue } from '../queues';

const logger = createLogger('whatsapp-logger:processor');

export async function processEventsJob(job: Job): Promise<void> {
  const { rawEventId, event } = job.data as { rawEventId: string; event: EvolutionWebhookEvent };

  try {
    switch (event.event) {
      case 'messages.upsert':
        await handleMessageUpsert(event.data);
        break;
      case 'messages.update':
        await handleMessageUpdate(event.data);
        break;
      case 'stories.upsert':
        await handleStoryUpsert(event.data);
        break;
      case 'connection.update':
        logger.info('WA connection update', { instance: event.instance, data: event.data });
        break;
      default:
        logger.debug('Unhandled WA event', { event: event.event });
    }

    await prisma.rawWebhookEvent.update({
      where: { id: rawEventId },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    await prisma.rawWebhookEvent
      .update({
        where: { id: rawEventId },
        data: { processingError: err instanceof Error ? err.message : String(err) },
      })
      .catch(() => {});
    throw err;
  }
}

async function handleMessageUpsert(data: Record<string, unknown>): Promise<void> {
  const messages = Array.isArray(data['messages']) ? data['messages'] : [data];
  for (const raw of messages) {
    try {
      await processMessage(raw as RawWhatsappMessage);
    } catch (err) {
      logger.error('Failed to process message', {
        error: err instanceof Error ? err.message : String(err),
        msgId: (raw as RawWhatsappMessage)?.key?.id,
      });
    }
  }
}

async function processMessage(raw: RawWhatsappMessage): Promise<void> {
  const msgId = raw.key?.id;
  if (!msgId) return;

  const existing = await prisma.message.findUnique({ where: { whatsappMessageId: msgId } });
  if (existing) return;

  const direction: MessageDirection = raw.key?.fromMe ? MessageDirection.OUTBOUND : MessageDirection.INBOUND;
  const employeeJid = raw.key?.fromMe
    ? raw.key?.remoteJid ?? ''
    : raw.key?.participant ?? raw.key?.remoteJid ?? '';

  const employee = await prisma.employee.findFirst({ where: { whatsappJid: employeeJid } });
  if (!employee) {
    logger.debug('Message from unmonitored JID, skipping', { jid: employeeJid });
    return;
  }

  const contactJid = raw.key?.remoteJid ?? '';
  const isGroup = contactJid.includes('@g.us');
  const contactPhone = jidToPhone(contactJid);
  const msgType = raw._isStory ? MessageType.STORY : detectMessageType(raw.message);
  const content = extractTextContent(raw.message);
  const mediaUrl = extractMediaUrl(raw.message);

  const message = await prisma.message.create({
    data: {
      whatsappMessageId: msgId,
      employeeId: employee.id,
      contactPhone,
      contactName: raw.pushName ?? null,
      direction,
      type: msgType,
      content,
      mediaUrl,
      timestamp: raw.messageTimestamp ? new Date(raw.messageTimestamp * 1000) : new Date(),
      isGroupMessage: isGroup,
      groupId: isGroup ? contactJid : null,
      groupName: isGroup ? (raw.verifiedBizName ?? null) : null,
    },
  });

  const flagResult = await flagChecker.check(message.id, content, msgType, employee.id);
  if (flagResult.isFlagged) {
    await prisma.message.update({
      where: { id: message.id },
      data: { isFlagged: true, flagReason: flagResult.reason, flaggedAt: new Date() },
    });
  }

  await publish(REDIS_CHANNELS.WA_MESSAGE_NEW, {
    messageId: message.id,
    employeeId: employee.id,
    direction: direction as string,
    type: msgType as string,
    timestamp: message.timestamp.toISOString(),
    isFlagged: flagResult.isFlagged,
  }).catch(() => {});

  if (mediaUrl) {
    await waMediaQueue.add(
      'download-media',
      { messageId: message.id, mediaUrl, msgType },
      { priority: 1, attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );
  }

  logger.info('Message logged', {
    id: message.id,
    employee: employee.id,
    direction,
    type: msgType,
    flagged: flagResult.isFlagged,
  });
}

async function handleMessageUpdate(data: Record<string, unknown>): Promise<void> {
  const updates = Array.isArray(data['updates']) ? data['updates'] : [data];

  for (const u of updates) {
    const update = u as {
      key?: { id?: string };
      update?: { message?: Record<string, unknown> };
    };

    if (!update.key?.id) continue;

    const message = await prisma.message.findUnique({
      where: { whatsappMessageId: update.key.id },
    });
    if (!message) continue;

    // protocolMessage.type = 0 indicates message deletion
    const proto = update.update?.message?.['protocolMessage'] as Record<string, unknown> | undefined;
    const isDeleted = proto !== undefined && proto?.['type'] === 0;

    if (isDeleted) {
      const now = new Date();
      const minutesSinceSend = Math.floor((now.getTime() - message.timestamp.getTime()) / 60_000);

      await prisma.message.update({
        where: { id: message.id },
        data: { deletedAt: now, deletedDetectedAt: now },
      });

      await publish(REDIS_CHANNELS.WA_MESSAGE_DELETED, {
        messageId: message.id,
        whatsappMessageId: update.key.id,
        employeeId: message.employeeId,
        deletedAt: now.toISOString(),
        originalTimestamp: message.timestamp.toISOString(),
        minutesSinceSend,
      }).catch(() => {});

      logger.info('Message deletion detected', {
        id: message.id,
        employeeId: message.employeeId,
        minutesSinceSend,
      });
    }
  }
}

async function handleStoryUpsert(data: Record<string, unknown>): Promise<void> {
  const stories = Array.isArray(data['messages']) ? data['messages'] : [data];
  for (const raw of stories) {
    await processMessage({ ...(raw as RawWhatsappMessage), _isStory: true });
  }
}

function jidToPhone(jid: string): string {
  return jid.split('@')[0].replace(/\D/g, '');
}

function detectMessageType(message: Record<string, unknown> | undefined): MessageType {
  if (!message) return MessageType.TEXT;
  if (message['imageMessage']) return MessageType.IMAGE;
  if (message['videoMessage']) return MessageType.VIDEO;
  if (message['audioMessage']) return MessageType.AUDIO;
  if (message['documentMessage']) return MessageType.DOCUMENT;
  if (message['locationMessage']) return MessageType.LOCATION;
  if (message['stickerMessage']) return MessageType.STICKER;
  if (message['reactionMessage']) return MessageType.REACTION;
  return MessageType.TEXT;
}

function extractTextContent(message: Record<string, unknown> | undefined): string | null {
  if (!message) return null;
  const conv = message['conversation'];
  if (typeof conv === 'string') return conv;
  const ext = message['extendedTextMessage'] as Record<string, unknown> | undefined;
  if (ext?.text) return String(ext.text);
  return null;
}

function extractMediaUrl(message: Record<string, unknown> | undefined): string | null {
  if (!message) return null;
  const types = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
  for (const t of types) {
    const m = message[t] as Record<string, unknown> | undefined;
    if (m?.url) return String(m.url);
    if (m?.directPath) return String(m.directPath);
  }
  return null;
}

export interface RawWhatsappMessage {
  key?: { id?: string; fromMe?: boolean; remoteJid?: string; participant?: string };
  message?: Record<string, unknown>;
  messageTimestamp?: number;
  pushName?: string;
  verifiedBizName?: string;
  _isStory?: boolean;
}
