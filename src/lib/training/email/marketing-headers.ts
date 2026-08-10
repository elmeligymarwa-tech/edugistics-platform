/**
 * RFC 8058 one-click unsubscribe headers — required on every marketing
 * message. Gmail and Yahoo throttle or reject bulk mail from senders that
 * omit these. Ready for Phase D's sending engine to attach to every send;
 * nothing in this phase actually sends anything.
 */
export function buildListUnsubscribeHeaders(unsubscribeUrl: string, contactEmail: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:${contactEmail}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
