import { renderPersonalization, type PersonalizationValues } from '@/domain/training/personalization'
import { renderCampaignBodyHtml, renderCampaignBodyText } from './rich-text'
import { renderMarketingFooterText, renderMarketingLayout, type EmailContent, type MarketingFooterDetails } from './templates'

/**
 * Renders one recipient's fully personalised marketing email, footer
 * included. Tokens are resolved first, against that recipient's own
 * values — never a client-supplied value — and only afterwards is the
 * result run through the markdown-lite renderer, so a token value
 * containing HTML-special characters is escaped along with the rest of the
 * line rather than treated as markup. Mirrors campaign-render.ts's
 * renderCampaignEmail, but with the mandatory unsubscribe footer
 * (renderMarketingLayout) instead of the transactional one.
 */
export function renderMarketingEmail(
  subjectTemplate: string,
  bodyTemplate: string,
  values: PersonalizationValues,
  footer: MarketingFooterDetails,
): EmailContent {
  const subject = renderPersonalization(subjectTemplate, values)
  const personalizedBody = renderPersonalization(bodyTemplate, values)
  const html = renderMarketingLayout(subject, renderCampaignBodyHtml(personalizedBody), footer)
  const text = `${renderCampaignBodyText(personalizedBody)}\n\n${renderMarketingFooterText(footer)}`
  return { subject, html, text }
}
