import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM_ADDRESS = process.env.EMAIL_FROM || 'ProjectHub <onboarding@resend.dev>'
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

/**
 * Sends an email via Resend. Silently no-ops (with a console warning) if
 * RESEND_API_KEY isn't configured, so the rest of the app keeps working for
 * teams that haven't set up email yet — a missing email integration should
 * never break ticket creation, assignment, etc.
 */
async function sendEmail(opts: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped email "${opts.subject}" to ${opts.to}`)
    return
  }
  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    })
  } catch (err) {
    // Never let an email failure break the underlying action (ticket
    // creation, assignment, etc.) — just log it.
    console.error('[email] Failed to send:', err)
  }
}

function emailShell(bodyHtml: string, ctaLabel: string, ctaUrl: string): string {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #0b1220 0%, #16223a 100%); padding: 20px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width: 28px; height: 28px; border-radius: 8px; background: #aee35c; text-align: center; vertical-align: middle;">
            <span style="font-size: 14px; font-weight: 700; color: #0b1220; line-height: 28px;">P</span>
          </td>
          <td style="padding-left: 10px;">
            <span style="font-weight: 700; font-size: 15px; color: #ffffff;">ProjectHub</span><br/>
            <span style="font-size: 10px; letter-spacing: 0.06em; color: #aee35c; font-weight: 600;">PROJECT PORTAL</span>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding: 28px;">
      ${bodyHtml}
      <a href="${ctaUrl}" style="display: inline-block; margin-top: 20px; background: #0b1220; color: #ffffff; text-decoration: none; padding: 11px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">${ctaLabel}</a>
    </div>
    <div style="border-top: 1px solid #e2e8f0; padding: 16px 28px;">
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">You're receiving this because you're a member of a project on ProjectHub.</p>
    </div>
  </div>`
}

interface AssignmentEmailParams {
  to: string
  assigneeName: string
  assignedByName: string
  ticketTitle: string
  ticketId: string
  projectName: string
  dueDate?: string | null
}

export async function sendTicketAssignedEmail(params: AssignmentEmailParams) {
  const dueLine = params.dueDate
    ? `<p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Due ${params.dueDate}</p>`
    : ''

  const html = emailShell(
    `
    <p style="font-size: 15px; color: #0b1220; margin: 0 0 16px;">Hi ${params.assigneeName},</p>
    <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px;">
      <strong>${params.assignedByName}</strong> assigned you a ticket in <strong>${params.projectName}</strong>:
    </p>
    <div style="border: 1px solid #e2e8f0; border-left: 3px solid #aee35c; border-radius: 10px; padding: 14px 16px;">
      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0b1220;">${params.ticketTitle}</p>
      ${dueLine}
    </div>
    `,
    'View ticket',
    `${APP_URL}/tickets?ticket=${params.ticketId}`
  )

  await sendEmail({
    to: params.to,
    subject: `You've been assigned: ${params.ticketTitle}`,
    html,
  })
}

interface TicketCreatedEmailParams {
  to: string
  recipientName: string
  createdByName: string
  ticketTitle: string
  ticketId: string
  projectName: string
}

/** Notify a project's other members when a new ticket is created — one of a
 * few natural extra touchpoints beyond assignment; see other send* helpers
 * below for the same pattern applied elsewhere. */
export async function sendTicketCreatedEmail(params: TicketCreatedEmailParams) {
  const html = emailShell(
    `
    <p style="font-size: 15px; color: #0b1220; margin: 0 0 16px;">Hi ${params.recipientName},</p>
    <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px;">
      <strong>${params.createdByName}</strong> created a new ticket in <strong>${params.projectName}</strong>:
    </p>
    <div style="border: 1px solid #e2e8f0; border-left: 3px solid #aee35c; border-radius: 10px; padding: 14px 16px;">
      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0b1220;">${params.ticketTitle}</p>
    </div>
    `,
    'View ticket',
    `${APP_URL}/tickets?ticket=${params.ticketId}`
  )

  await sendEmail({
    to: params.to,
    subject: `New ticket in ${params.projectName}: ${params.ticketTitle}`,
    html,
  })
}

interface StatusChangedEmailParams {
  to: string
  recipientName: string
  changedByName: string
  ticketTitle: string
  ticketId: string
  fromStatus: string
  toStatus: string
}

export async function sendTicketStatusChangedEmail(params: StatusChangedEmailParams) {
  const html = emailShell(
    `
    <p style="font-size: 15px; color: #0b1220; margin: 0 0 16px;">Hi ${params.recipientName},</p>
    <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px;">
      <strong>${params.changedByName}</strong> moved <strong>${params.ticketTitle}</strong> from
      <strong>${params.fromStatus}</strong> to <strong>${params.toStatus}</strong>.
    </p>
    `,
    'View ticket',
    `${APP_URL}/tickets?ticket=${params.ticketId}`
  )

  await sendEmail({
    to: params.to,
    subject: `Status update: ${params.ticketTitle}`,
    html,
  })
}

interface TransferEmailParams {
  to: string
  assigneeName: string
  transferredByName: string
  previousAssigneeName: string
  ticketTitle: string
  ticketId: string
  projectName: string
  dueDate?: string | null
}

export async function sendTicketTransferredEmail(params: TransferEmailParams) {
  const dueLine = params.dueDate
    ? `<p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Due ${params.dueDate}</p>`
    : ''

  const html = emailShell(
    `
    <p style="font-size: 15px; color: #0b1220; margin: 0 0 16px;">Hi ${params.assigneeName},</p>
    <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px;">
      <strong>${params.transferredByName}</strong> transferred a ticket from <strong>${params.previousAssigneeName}</strong> to you in <strong>${params.projectName}</strong>:
    </p>
    <div style="border: 1px solid #e2e8f0; border-left: 3px solid #aee35c; border-radius: 10px; padding: 14px 16px;">
      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0b1220;">${params.ticketTitle}</p>
      ${dueLine}
    </div>
    `,
    'View ticket',
    `${APP_URL}/tickets?ticket=${params.ticketId}`
  )

  await sendEmail({
    to: params.to,
    subject: `Ticket transferred to you: ${params.ticketTitle}`,
    html,
  })
}
