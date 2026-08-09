import type { CampaignEmailType } from './schema'

export interface CampaignTemplateContent {
  subject: string
  body: string
}

const REMINDER_DEFAULT: CampaignTemplateContent = {
  subject: 'Reminder: {{courseName}} – Edugistics Training',
  body: `Hi {{firstName}},

This is a friendly reminder that you're registered for **{{courseName}}**.

- Date: {{courseDate}}
- Time: {{courseTime}}

We look forward to seeing you there.

Warm regards,
The Edugistics Team`,
}

const ZOOM_LINK_DEFAULT: CampaignTemplateContent = {
  subject: 'Your Zoom Link – {{courseName}}',
  body: `Hi {{firstName}},

Here are your joining details for **{{courseName}}**.

- Date: {{courseDate}}
- Time: {{courseTime}}
- Join link: {{zoomLink}}

We look forward to seeing you there.

Warm regards,
The Edugistics Team`,
}

const UPDATE_DEFAULT: CampaignTemplateContent = {
  subject: 'Update: {{courseName}}',
  body: `Hi {{firstName}},

We have an update about **{{courseName}}**.

[Add your update here.]

- Date: {{courseDate}}
- Time: {{courseTime}}

Warm regards,
The Edugistics Team`,
}

const CUSTOM_DEFAULT: CampaignTemplateContent = { subject: '', body: '' }

/**
 * Static defaults — no course context needed. The Training Reminder default
 * here is only a fallback: when a selection resolves to a single course that
 * has its own reminderSubject/reminderMessage stored, those override this
 * default (resolved server-side, since course data must never be trusted
 * from the client).
 */
export function getDefaultCampaignTemplate(type: CampaignEmailType): CampaignTemplateContent {
  switch (type) {
    case 'REMINDER':
      return REMINDER_DEFAULT
    case 'ZOOM_LINK':
      return ZOOM_LINK_DEFAULT
    case 'UPDATE':
      return UPDATE_DEFAULT
    case 'CUSTOM':
      return CUSTOM_DEFAULT
  }
}
