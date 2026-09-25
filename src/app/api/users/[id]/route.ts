import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { hash } from 'bcryptjs'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  password: z.string().min(6).optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true,
      _count: { select: { createdTickets: true, assignedTickets: true, comments: true } },
    },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentUser = session.user as { id: string; role: string }
  const { id } = await params

  if (currentUser.id !== id && currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can update other users' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    if (data.role && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can update roles' }, { status: 403 })
    }

    const updateData: Record<string, string> = {}
    if (data.name) updateData.name = data.name
    if (data.email) updateData.email = data.email
    if (data.role) updateData.role = data.role
    if (data.password) updateData.password = await hash(data.password, 12)

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    return NextResponse.json(user)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentUser = session.user as { id: string; role: string }
  const { id } = await params

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can delete users' }, { status: 403 })
  }

  const targetUser = await db.user.findUnique({ where: { id } })
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (targetUser.role === 'admin' && currentUser.id !== id) {
    return NextResponse.json({ error: 'Cannot delete other admin accounts' }, { status: 403 })
  }

  await db.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}