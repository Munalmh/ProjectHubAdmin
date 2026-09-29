import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendTicketStatusChangedEmail } from '@/lib/email'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { statusId } = await req.json()
  const user = session.user as { id: string; name: string }

  const previous = await db.ticket.findUnique({ where: { id }, include: { status: true } })

  const ticket = await db.ticket.update({
    where: { id },
    data: { statusId },
    include: {
      status: true,
      priority: true,
      assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  })

  // Notify assignees the status changed — skip whoever made the move
  // themselves, and skip entirely if the status didn't actually change
  // (e.g. dropped back in the same column).
  if (previous && previous.statusId !== ticket.statusId) {
    // Keep a footprint / activity log for "Done" tasks
    if (!previous.status.isCompleted && ticket.status.isCompleted) {
      await db.ticketComment.create({
        data: {
          content: `System: Ticket was marked as '${ticket.status.name}' (Completed).`,
          ticketId: ticket.id,
          userId: user.id,
        },
      })
    } else if (previous.status.isCompleted && !ticket.status.isCompleted) {
      await db.ticketComment.create({
        data: {
          content: `System: Ticket was moved back from '${previous.status.name}' (Completed) to '${ticket.status.name}'.`,
          ticketId: ticket.id,
          userId: user.id,
        },
      })
    }

    await Promise.all(
      ticket.assignees
        .filter((a) => a.userId !== user.id)
        .map((a) =>
          sendTicketStatusChangedEmail({
            to: a.user.email,
            recipientName: a.user.name,
            changedByName: user.name,
            ticketTitle: ticket.title,
            ticketId: ticket.id,
            fromStatus: previous.status.name,
            toStatus: ticket.status.name,
          })
        )
    )
  }

  return NextResponse.json(ticket)
}