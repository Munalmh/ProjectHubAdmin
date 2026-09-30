import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  prefix: z.string().min(1, 'Prefix is required'),
  color: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  budgetHours: z.number().nonnegative().nullable().optional(),
  stars: z.number().int().min(0).max(5).optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role: string }
  const projects = await db.project.findMany({
    where: user.role === 'admin' ? {} : { members: { some: { userId: user.id } } },
    include: {
      _count: { select: { tickets: true, members: true } },
      statuses: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(projects)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = projectSchema.parse(body)
    const userId = (session.user as { id: string }).id

    const project = await db.project.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate.replace(/ /g, '-')).toISOString() : null,
        endDate: data.endDate ? new Date(data.endDate.replace(/ /g, '-')).toISOString() : null,
        members: { create: { userId, role: 'manager' } },
        statuses: {
          create: [
            { name: 'To Do', color: '#3b82f6', sortOrder: 0, isCompleted: false },
            { name: 'In Progress', color: '#f59e0b', sortOrder: 1, isCompleted: false },
            { name: 'Done', color: '#22c55e', sortOrder: 2, isCompleted: true },
          ],
        },
      },
      include: { _count: { select: { tickets: true, members: true } }, statuses: { orderBy: { sortOrder: 'asc' } } },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}