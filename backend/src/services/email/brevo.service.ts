import * as Brevo from '@getbrevo/brevo';
import { env, isTest } from '@/config/env';
import { logger } from '@/config/logger';
import {
  notificationTemplate,
  resetPasswordTemplate,
  securityAlertTemplate,
  verifyEmailTemplate,
  valetCheckInTemplate,
  valetReadyTemplate,
  valetDeliveredTemplate,
  valetWelcomeTemplate,
  type EmailContent,
  type SecurityAlertData,
} from './templates';

/**
 * Brevo transactional-email wrapper. If no API key is configured (local dev /
 * tests) it degrades gracefully: the email is logged instead of sent, so the
 * rest of the flow still works. In production a missing key is a hard misconfig.
 */
let client: Brevo.TransactionalEmailsApi | null = null;

function getClient(): Brevo.TransactionalEmailsApi | null {
  if (!env.BREVO_API_KEY) return null;
  if (!client) {
    client = new Brevo.TransactionalEmailsApi();
    client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, env.BREVO_API_KEY);
  }
  return client;
}

async function send(to: string, content: EmailContent): Promise<void> {
  const api = getClient();
  if (!api || isTest) {
    logger.info({ to, subject: content.subject }, '[email] (not sent — no Brevo key/test mode)');
    return;
  }

  const message = new Brevo.SendSmtpEmail();
  message.subject = content.subject;
  message.htmlContent = content.html;
  message.textContent = content.text;
  message.sender = { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM_ADDRESS };
  message.to = [{ email: to }];

  try {
    await api.sendTransacEmail(message);
    logger.info({ to, subject: content.subject }, 'email sent');
  } catch (err) {
    logger.error({ err, to, subject: content.subject }, 'Brevo send failed');
    // Don't throw on transient email failure for non-critical flows; callers
    // that must guarantee delivery should await + handle as needed.
  }
}

export const emailService = {
  sendVerificationEmail(to: string, name: string, link: string) {
    return send(to, verifyEmailTemplate(name, link));
  },
  sendPasswordResetEmail(to: string, name: string, link: string) {
    return send(to, resetPasswordTemplate(name, link));
  },
  sendSecurityAlert(to: string, data: SecurityAlertData) {
    return send(to, securityAlertTemplate(data));
  },
  sendNotificationEmail(to: string, name: string, title: string, message: string, orderNumber?: string) {
    return send(to, notificationTemplate(name, title, message, orderNumber));
  },
  sendValetCheckIn(to: string, name: string, carNumber: string, parkingSlot: string, time: string, token: string) {
    return send(to, valetCheckInTemplate(name, carNumber, parkingSlot, time, token));
  },
  sendValetReady(to: string, name: string, carNumber: string) {
    return send(to, valetReadyTemplate(name, carNumber));
  },
  sendValetDelivered(to: string, name: string, carNumber: string) {
    return send(to, valetDeliveredTemplate(name, carNumber));
  },
  sendValetWelcome(to: string, name: string, tempPassword: string) {
    return send(to, valetWelcomeTemplate(name, to, tempPassword));
  },
};
