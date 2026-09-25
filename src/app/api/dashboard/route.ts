import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role: string }

  const whereClause =
    user.role === 'admin'
      ? {}
      : { members: { some: { userId: user.id } } }

  const [totalProjects, totalTickets, totalMembers, recentTickets, ticketsByPriority, ticketsByProject] =
    await Promise.all([
      db.project.count({ where: whereClause }),
      db.ticket.count({
        where: user.role === 'admin'
          ? {}
          : { assignees: { some: { userId: user.id } } },
      }),
      db.user.count(),
      db.ticket.findMany({
        take: 8,
        orderBy: { updatedAt: 'desc' },
        where: user.role === 'admin' 
          ? {} 
          : { assignees: { some: { userId: user.id } } },
        include: {
          project: { select: { name: true, prefix: true, color: true } },
          status: true,
          priority: true,
          assignees: { select: { user: { select: { id: true, name: true } } } },
          createdBy: { select: { name: true } },
        },
      }),
      db.ticket.groupBy({ 
        by: ['priorityId'], 
        where: user.role === 'admin' ? {} : { assignees: { some: { userId: user.id } } },
        _count: { id: true } 
      }),
      db.ticket.groupBy({ 
        by: ['projectId'], 
        where: user.role === 'admin' ? {} : { assignees: { some: { userId: user.id } } },
        _count: { id: true } 
      }),
    ])

  const priorityData = await Promise.all(
    ticketsByPriority.map(async (p) => {
      const priority = p.priorityId ? await db.ticketPriority.findUnique({ where: { id: p.priorityId } }) : null
      return { name: priority?.name || 'None', count: p._count.id, color: priority?.color || '#6b7280' }
    })
  )

  const projectData = await Promise.all(
    ticketsByProject.map(async (p) => {
      const project = await db.project.findUnique({ where: { id: p.projectId } })
      return { name: project?.name || 'Unknown', count: p._count.id, color: project?.color || '#6b7280' }
    })
  )

  return NextResponse.json({
    totalProjects,
    totalTickets,
    totalMembers,
    recentTickets,
    ticketsByPriority: priorityData,
    ticketsByProject: projectData,
  })
}
