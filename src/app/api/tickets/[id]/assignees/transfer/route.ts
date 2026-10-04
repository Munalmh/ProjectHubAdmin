import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const user = session.user as { id: string; name: string }
  const body = await req.json()
  const { fromUserId, toUserId } = body

  if (!fromUserId || !toUserId) return NextResponse.json({ error: 'fromUserId and toUserId are required' }, { status: 400 })
  
  if (fromUserId === toUserId) return NextResponse.json({ error: 'Cannot transfer to the same user' }, { status: 400 })

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  })
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const newAssignee = await db.user.findUnique({ where: { id: toUserId } })
  const oldAssignee = await db.user.findUnique({ where: { id: fromUserId } })
  
  if (!newAssignee || !oldAssignee) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    // Perform transaction: delete old, create new
    const [deleted, created] = await db.$transaction([
      db.ticketAssignee.delete({
        where: {
          ticketId_userId: {
            ticketId: id,
            userId: fromUserId,
          }
        }
      }),
      db.ticketAssignee.create({
        data: { ticketId: id, userId: toUserId, assignedById: user.id },
        include: { user: { select: { id: true, name: true } }, assignedBy: { select: { name: true } } },
      })
    ])

    if (toUserId !== user.id) {
      await db.notification.create({
        data: {
          userId: toUserId,
          title: `Ticket Transferred`,
          message: `${user.name} transferred "${ticket.title}" from ${oldAssignee.name} to you in ${ticket.project.name}.`,
          link: `/tickets?ticket=${ticket.id}`,
        }
      })
    }

    return NextResponse.json(created, { status: 200 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to transfer ticket.' }, { status: 409 })
  }
}

