// Force update at the very top of route.ts.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const ticketSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  projectId: z.string().min(1),
  statusId: z.string().min(1),
  priorityId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  stars: z.number().int().min(0).max(5).optional(),
})

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const search = searchParams.get('search')

  const user = session.user as { id: string; role: string }

  const where: Record<string, unknown> = {}
  if (projectId) where.projectId = projectId
  if (status) where.statusId = status
  if (priority) where.priorityId = priority
  if (search) where.title = { contains: search }

  if (user.role !== 'admin') {
    where.OR = [
      { project: { members: { some: { userId: user.id } } } },
      { assignees: { some: { userId: user.id } } },
      { createdById: user.id },
    ]
  }

  const tickets = await db.ticket.findMany({
    where,
    include: {
      project: { select: { id: true, name: true, prefix: true, color: true } },
      status: true,
      priority: true,
      assignees: { include: { user: { select: { id: true, name: true } } } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(tickets)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = ticketSchema.parse(body)
    const userId = (session.user as { id: string }).id

    const ticket = await db.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        projectId: data.projectId,
        statusId: data.statusId,
        priorityId: data.priorityId,
        createdById: userId,
        startDate: data.startDate ? new Date(data.startDate.replace(/ /g, '-')).toISOString() : null,
        dueDate: data.dueDate ? new Date(data.dueDate.replace(/ /g, '-')).toISOString() : null,
        assignees: data.assigneeIds
          ? { create: data.assigneeIds.map((uid: string) => ({ userId: uid, assignedById: userId })) }
          : undefined,
      },
      include: {
        project: { select: { name: true, prefix: true, color: true } },
        status: true,
        priority: true,
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        createdBy: { select: { name: true } },
      },
    })

    if (ticket.assignees && ticket.assignees.length > 0) {
      for (const assignee of ticket.assignees) {
        if (assignee.user.email) {
          try {
            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background-color: #111827; padding: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="48" valign="middle">
            <div style="background-color: #a3e635; color: #111827; font-weight: bold; font-size: 20px; width: 48px; height: 48px; border-radius: 8px; text-align: center; line-height: 48px;">
              P
            </div>
          </td>
          <td valign="middle" style="padding-left: 16px;">
            <div style="color: #ffffff; font-size: 20px; font-weight: bold; margin: 0 0 4px 0;">ProjectHub</div>
            <div style="color: #a3e635; font-size: 11px; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase;">PROJECT PORTAL</div>
          </td>
        </tr>
      </table>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px 24px; color: #374151;">
      <p style="font-size: 16px; margin: 0 0 24px 0;">Hi ${assignee.user.name},</p>
      
      <p style="font-size: 16px; margin: 0 0 24px 0;">
        <strong>${ticket.createdBy.name || 'Someone'}</strong> assigned you a ticket in <strong>${ticket.project.name}</strong>:
      </p>
      
      <!-- Ticket Card -->
      <div style="border: 1px solid #e5e7eb; border-left: 4px solid #a3e635; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="font-weight: 600; font-size: 16px; color: #111827; margin: 0 0 8px 0;">${ticket.title}</p>
        ${ticket.dueDate ? `<p style="margin: 0; font-size: 14px; color: #6b7280;">Due ${new Date(ticket.dueDate).toISOString().split('T')[0]}</p>` : ''}
      </div>
      
      <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}" style="display: inline-block; background-color: #111827; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 6px;">View ticket</a>
    </div>
    
    <!-- Footer -->
    <div style="border-top: 1px solid #e5e7eb; padding: 16px 24px; color: #9ca3af; font-size: 13px; background-color: #ffffff;">
      You're receiving this because you're a member of a project on ProjectHub.
    </div>
    
  </div>
</body>
</html>
            `;

            if (resend) {
              const { data, error } = await resend.emails.send({
                from: 'ProjectHub <onboarding@resend.dev>',
                to: assignee.user.email,
                subject: `New Ticket Assigned: ${ticket.title}`,
                html: emailHtml
              })
              
              if (error) {
                console.error(`Failed to send email to ${assignee.user.email}:`, error)
              } else {
                console.log(`Email sent successfully to ${assignee.user.email}`, data)
              }
            } else {
              console.log('Skipping email notification, RESEND_API_KEY is not set')
            }
          } catch (emailError) {
            console.error('Exception while sending email:', emailError)
          }
        }
      }
    }

    return NextResponse.json(ticket, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}