import axios from 'axios';
import nodemailer from 'nodemailer';
import { createLogger } from '@field-ops/shared';

const logger = createLogger('alert-engine:notifier');

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? '587', 10),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

class Notifier {
  async sendWhatsapp(jid: string, message: string): Promise<void> {
    const url = process.env.EVOLUTION_API_URL;
    const key = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_INSTANCE_NAME;

    if (!url || !key || !instance) {
      logger.warn('Evolution API not configured, skipping WhatsApp notification');
      return;
    }

    try {
      await axios.post(
        `${url}/message/sendText/${instance}`,
        { number: jid, textMessage: { text: message } },
        { headers: { apikey: key }, timeout: 15_000 },
      );
      logger.info('WhatsApp notification sent', { jid });
    } catch (err) {
      logger.error('WhatsApp notification failed', {
        jid,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async sendEmail(subject: string, body: string): Promise<void> {
    const from = process.env.ALERT_EMAIL_FROM;
    const to = process.env.ALERT_EMAIL_TO;

    if (!from || !to || !process.env.SMTP_HOST) {
      logger.warn('Email not configured, skipping email notification');
      return;
    }

    try {
      await mailer.sendMail({ from, to, subject, text: body });
      logger.info('Email notification sent', { to, subject });
    } catch (err) {
      logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  async notifyOwner(alertType: string, title: string, description: string, employeeName?: string): Promise<void> {
    const ownerJid = process.env.WHATSAPP_OWNER_JID;
    const msg = [
      `🚨 *FIELDOPS ALERT*`,
      `Type: ${alertType}`,
      `Title: ${title}`,
      `Detail: ${description}`,
      ...(employeeName ? [`Employee: ${employeeName}`] : []),
      `Time: ${new Date().toLocaleString('fr-MA', { timeZone: 'Africa/Casablanca' })}`,
    ].join('\n');

    await Promise.allSettled([
      ownerJid ? this.sendWhatsapp(ownerJid, msg) : Promise.resolve(),
      this.sendEmail(`[FieldOps] ${title}`, msg),
    ]);
  }
}

export const notifier = new Notifier();
