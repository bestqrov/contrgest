import { prisma, MessageDirection, MessageType } from '@field-ops/db';
import { createLogger } from '@field-ops/shared';
import type { EvolutionWebhookEvent } from '../handlers/webhook.handler';
import { flagChecker } from './flag-checker.service';
import { evidenceArchiver } from './evidence-archiver.service';

const logger = createLogger('whatsapp-logger:processor');

class MessageProcessor {
  async handle(event: EvolutionWebhookEvent): Promise<void> {
    switch (event.event) {
      case 'messages.upsert':
        await this.handleMessageUpsert(event.data);
        break;
      case 'messages.update':
        await this.handleMessageUpdate(event.data);
        break;
      case 'connection.update':
        logger.info('Connection update', { data: event.data });
        break;
      default:
        logger.debug('Unhandled event type', { event: event.event });
    }
  }

  private async handleMessageUpsert(data: Record<string, unknown>): Promise<void> {
    const messages = Array.isArray(data['messages']) ? data['messages'] : [data];

    for (const raw of messages) {
      try {
        await this.processMessage(raw as RawWhatsappMessage);
      } catch (err) {
        logger.error('Failed to process message', {
          error: err instanceof Error ? err.message : String(err),
          msgId: (raw as RawWhatsappMessage)?.key?.id,
        });
      }
    }
  }

  private async processMessage(raw: RawWhatsappMessage): Promise<void> {
    const msgId = raw.key?.id;
    if (!msgId) return;

    // Skip if already processed
    const existing = await prisma.message.findUnique({ where: { whatsappMessageId: msgId } });
    if (existing) return;

    // Determine direction: fromMe = outbound
    const direction: MessageDirection = raw.key?.fromMe ? MessageDirection.OUTBOUND : MessageDirection.INBOUND;

    // Identify the employee by JID
    const employeeJid = raw.key?.fromMe
      ? raw.key?.remoteJid ?? ''
      : raw.key?.participant ?? raw.key?.remoteJid ?? '';

    const employee = await prisma.employee.findFirst({
      where: { whatsappJid: raw.key?.fromMe ? undefined : employeeJid },
    });

    // We only log messages belonging to our monitored employees
    if (!employee) {
      logger.debug('Message from unknown JID, skipping', { jid: employeeJid });
      return;
    }

    const contactJid = raw.key?.remoteJid ?? '';
    const contactPhone = jidToPhone(contactJid);
    const isGroup = contactJid.includes('@g.us');

    const msgType = detectMessageType(raw.message);
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

    // Flag check
    const flagResult = await flagChecker.check(message.id, content, msgType, employee.id);
    if (flagResult.isFlagged) {
      await prisma.message.update({
        where: { id: message.id },
        data: { isFlagged: true, flagReason: flagResult.reason, flaggedAt: new Date() },
      });
    }

    // Archive media to evidence vault
    if (mediaUrl) {
      await evidenceArchiver.archiveFromUrl(mediaUrl, message.id, msgType);
    }

    logger.info('Message logged', {
      id: message.id,
      employee: employee.id,
      direction,
      type: msgType,
      flagged: flagResult.isFlagged,
    });
  }

  private async handleMessageUpdate(data: Record<string, unknown>): Promise<void> {
    const updates = Array.isArray(data['updates']) ? data['updates'] : [data];
    for (const u of updates) {
      const update = u as { key?: { id?: string }; update?: { status?: number } };
      if (!update.key?.id) continue;
      logger.debug('Message status update', { id: update.key.id, status: update.update?.status });
    }
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
}

export const messageProcessor = new MessageProcessor();
