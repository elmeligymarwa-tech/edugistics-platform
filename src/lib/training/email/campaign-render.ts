import { renderPersonalization, type PersonalizationValues } from '@/domain/training/personalization'
import { renderCampaignBodyHtml, renderCampaignBodyText } from './rich-text'
import { renderLayout, type EmailContent } from './templates'

/**
 * Renders one recipient's fully personalised email. Tokens are resolved
 * first, against that recipient's own values — never a client-supplied
 * value — and only afterwards is the result run through the markdown-lite
 * renderer, so a token value containing HTML-special characters is escaped
 * along with the rest of the line rather than treated as markup.
 */
export function renderCampaignEmail(
  subjectTemplate: string,
  bodyTemplate: string,
  values: PersonalizationValues,
): EmailContent {
  const subject = renderPersonalization(subjectTemplate, values)
  const personalizedBody = renderPersonalization(bodyTemplate, values)
  const html = renderLayout(subject, renderCampaignBodyHtml(personalizedBody))
  const text = renderCampaignBodyText(personalizedBody)
  return { subject, html, text }
}
