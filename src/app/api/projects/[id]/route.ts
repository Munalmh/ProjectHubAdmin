import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  prefix: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.string().optional(),
  budgetHours: z.number().nonnegative().nullable().optional(),
  stars: z.number().int().min(0).max(5).optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const project = await db.project.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      statuses: { orderBy: { sortOrder: 'asc' } },
      tickets: {
        include: {
          status: true,
          priority: true,
          assignees: { include: { user: { select: { id: true, name: true } } } },
          createdBy: { select: { name: true } },
          timesheetEntries: { select: { hours: true } },
        },
        orderBy: { updatedAt: 'desc' },
      },
      _count: { select: { tickets: true, members: true } },
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const hoursLogged = project.tickets.reduce(
    (sum, t) => sum + t.timesheetEntries.reduce((s, e) => s + e.hours, 0),
    0
  )

  return NextResponse.json({ ...project, hoursLogged: Math.round(hoursLogged * 100) / 100 })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const project = await db.project.update({
      where: { id },
      data: {
        ...data,
        // Only touch startDate/endDate when they were actually included in the request —
        // a bare `data.startDate ? ... : null` would silently wipe them on any partial
        // update (e.g. just changing status) that omits those fields.
        ...(data.startDate !== undefined
          ? { startDate: data.startDate ? new Date(data.startDate.replace(/ /g, '-')).toISOString() : null }
          : {}),
        ...(data.endDate !== undefined
          ? { endDate: data.endDate ? new Date(data.endDate.replace(/ /g, '-')).toISOString() : null }
          : {}),
      },
      include: { _count: { select: { tickets: true, members: true } } },
    })
    return NextResponse.json(project)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.project.delete({ where: { id } })
  return NextResponse.json({ success: true })
}