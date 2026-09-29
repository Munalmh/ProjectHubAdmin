import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  statusId: z.string().optional(),
  priorityId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, prefix: true, color: true } },
      status: true,
      priority: true,
      assignees: { include: { user: { select: { id: true, name: true, email: true } }, assignedBy: { select: { id: true, name: true } } } },
      createdBy: { select: { id: true, name: true, email: true } },
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(ticket)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const previous = await db.ticket.findUnique({ where: { id }, include: { status: true } })

    const ticket = await db.ticket.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate.replace(/ /g, '-')).toISOString() : null,
        dueDate: data.dueDate ? new Date(data.dueDate.replace(/ /g, '-')).toISOString() : null,
      },
      include: {
        project: { select: { name: true, prefix: true, color: true } },
        status: true,
        priority: true,
        assignees: { include: { user: { select: { id: true, name: true } } } },
        createdBy: { select: { name: true } },
      },
    })

    if (previous && previous.statusId !== ticket.statusId) {
      const user = session.user as { id: string; name: string }
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
    }

    return NextResponse.json(ticket)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.ticket.delete({ where: { id } })
  return NextResponse.json({ success: true })
}