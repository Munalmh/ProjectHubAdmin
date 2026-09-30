'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Plus,
  Users,
  Ticket,
  CalendarDays,
  Clock,
  CheckCircle2,
  Send,
  Loader2,
  X,
  BarChart3,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { TicketAttachments } from '@/components/app/tickets/ticket-attachments'
import { TicketChecklist } from '@/components/app/tickets/ticket-checklist'
import { TicketTimesheet } from '@/components/app/tickets/ticket-timesheet'
import { ProjectGanttChart } from '@/components/app/projects/project-gantt-chart'
import { StarRating } from '@/components/app/shared/star-rating'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ── Types ──────────────────────────────────────────────────────────────

interface ProjectStatus {
  id: string
  name: string
  color: string
  sortOrder: number
  isCompleted: boolean
}

interface ProjectMember {
  userId: string
  user: { id: string; name: string; email: string }
  role: string
}

interface TicketItem {
  id: string
  title: string
  uuid: string
  description: string | null
  createdAt: string
  updatedAt: string
  dueDate: string | null
  startDate: string | null
  project: { name: string; prefix: string; color: string }
  status: { name: string; color: string }
  priority: { name: string; color: string }
  assignees: { user: { id: string; name: string } }[]
  createdBy: { id: string; name: string }
  stars: number
}

interface ProjectDetail {
  id: string
  name: string
  description: string | null
  prefix: string
  color: string
  startDate: string | null
  endDate: string | null
  status: string
  createdAt: string
  budgetHours: number | null
  hoursLogged: number
  _count: { tickets: number; members: number }
  statuses: ProjectStatus[]
  members: ProjectMember[]
  tickets: TicketItem[]
  stars: number
}

interface Priority {
  id: string
  name: string
  color: string
  sortOrder: number
}

interface AppUser {
  id: string
  name: string
  email: string
}

interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  userId: string
  user: { id: string; name: string; email: string }
}

// ── Helpers ────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── Component ──────────────────────────────────────────────────────────

export function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { setSelectedProject } = useAppStore()
  const { data: session } = useSession()
  const currentUser = session?.user
  const projectId = params?.id

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  // New ticket dialog
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false)
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [ticketForm, setTicketForm] = useState({
    title: '',
    description: '',
    statusId: '',
    priorityId: '',
    assigneeIds: [] as string[],
    startDate: '',
    dueDate: '',
    stars: 0,
  })
  const [priorities, setPriorities] = useState<Priority[]>([])

  // Add member dialog
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<AppUser[]>([])
  const [addMemberForm, setAddMemberForm] = useState({ userId: '', role: 'member' })
  const [addingMember, setAddingMember] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [deletingProject, setDeletingProject] = useState(false)

  // Ticket detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null)
  const [ticketComments, setTicketComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    if (projectId) {
      setSelectedProject(projectId)
    }
  }, [projectId, setSelectedProject])

  const loadProject = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) throw new Error('Failed to load project')
      const json = await res.json()
      setProject(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  async function loadPriorities() {
    try {
      const res = await fetch('/api/priorities')
      if (res.ok) {
        const json = await res.json()
        setPriorities(Array.isArray(json) ? json : [])
      }
    } catch {
      // Silently fail
    }
  }

  async function loadAllUsers() {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const json = await res.json()
        setAllUsers(Array.isArray(json) ? json : [])
      }
    } catch {
      // Silently fail
    }
  }

  function handleOpenAddMemberDialog() {
    loadAllUsers()
    setAddMemberForm({ userId: '', role: 'member' })
    setAddMemberDialogOpen(true)
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!addMemberForm.userId || !projectId) return
    setAddingMember(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: addMemberForm.userId, role: addMemberForm.role }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add member')
      }
      toast.success('Member added')
      setAddMemberDialogOpen(false)
      loadProject()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setAddingMember(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!projectId) return
    setRemovingMemberId(userId)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error('Failed to remove member')
      toast.success('Member removed')
      loadProject()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemovingMemberId(null)
    }
  }

  async function handleDeleteProject() {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return
    
    setDeletingProject(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete project')
      toast.success('Project deleted')
      router.push('/projects')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project')
      setDeletingProject(false)
    }
  }

  const availableUsersToAdd = allUsers.filter(
    (u) => !project?.members.some((m) => m.userId === u.id)
  )

  function handleOpenTicketDialog() {
    loadPriorities()
    setTicketForm({
      title: '',
      description: '',
      statusId: project?.statuses[0]?.id ?? '',
      priorityId: priorities[0]?.id ?? '',
      assigneeIds: [],
      startDate: '',
      dueDate: '',
      stars: 0,
    })
    setTicketDialogOpen(true)
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!ticketForm.title.trim()) {
      toast.error("Ticket Title is required.")
      return
    }
    if (!projectId) {
      toast.error("Project ID is missing.")
      return
    }
    setCreatingTicket(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ticketForm.title.trim(),
          description: ticketForm.description.trim() || null,
          projectId: projectId,
          statusId: ticketForm.statusId || null,
          priorityId: ticketForm.priorityId || null,
          assigneeIds: ticketForm.assigneeIds,
          startDate: ticketForm.startDate || null,
          dueDate: ticketForm.dueDate || null,
          stars: ticketForm.stars,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create ticket')
      }
      toast.success('Ticket created successfully')
      setTicketDialogOpen(false)
      loadProject()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create ticket')
    } finally {
      setCreatingTicket(false)
    }
  }

  function toggleAssignee(userId: string) {
    setTicketForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(userId)
        ? prev.assigneeIds.filter((id) => id !== userId)
        : [...prev.assigneeIds, userId],
    }))
  }

  async function openTicketDetail(ticket: TicketItem) {
    setSelectedTicket(ticket)
    setTicketComments([])
    setCommentText('')
    setDetailDialogOpen(true)
    setLoadingComments(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`)
      if (res.ok) {
        const json = await res.json()
        if (json.comments) setTicketComments(json.comments)
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingComments(false)
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || !selectedTicket) return
    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      })
      if (!res.ok) throw new Error('Failed to add comment')
      const created = await res.json()
      setTicketComments((prev) => [...prev, created])
      setCommentText('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  async function updateTicketStars(ticketId: string, stars: number) {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedTicket(updated)
        loadProject()
        toast.success('Priority updated')
      } else {
        toast.error('Failed to update priority')
      }
    } catch {
      toast.error('Failed to update priority')
    }
  }

  async function handleDeleteTicket(ticketId: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to delete this ticket?')) return
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Ticket deleted')
        if (selectedTicket?.id === ticketId) setDetailDialogOpen(false)
        loadProject()
      } else {
        toast.error('Failed to delete ticket')
      }
    } catch { toast.error('Failed to delete ticket') }
  }

  function handleBoardTab() {
    router.push('/board')
  }

  const completionRate =
    project && project._count.tickets > 0
      ? Math.round(
          ((project.statuses
            .filter((s) => s.isCompleted)
            .reduce((acc, s) => {
              return (
                acc +
                project.tickets.filter((t) => t.status?.name === s.name).length
              )
            }, 0)) /
            project._count.tickets) *
            100
        )
      : 0

  // ── Loading State ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push('/projects')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Projects
        </Button>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{error || 'Project not found'}</p>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.push('/projects')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Projects
      </Button>

      {/* Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-4 w-1.5 rounded-full"
            style={{ backgroundColor: project.color }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              {project.stars > 0 && <StarRating value={project.stars} readonly />}
              <Badge
                variant="outline"
                className="text-[10px] font-mono"
              >
                {project.prefix}
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {project.description}
              </p>
            )}
          </div>
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {project.status}
          </Badge>
          {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
              onClick={handleDeleteProject}
              disabled={deletingProject}
            >
              {deletingProject ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete Project
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => v === 'board' ? handleBoardTab() : setActiveTab(v)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/10 text-blue-500 p-2 rounded-lg">
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tickets</p>
                    <p className="text-xl font-bold">{project._count.tickets}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-green-500/10 text-green-500 p-2 rounded-lg">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Members</p>
                    <p className="text-xl font-bold">{project._count.members}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-500/10 text-purple-500 p-2 rounded-lg">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completion Rate</p>
                    <p className="text-xl font-bold">{completionRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Members */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Team Members</CardTitle>
                <Button size="sm" variant="outline" onClick={handleOpenAddMemberDialog}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {project.members.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No members yet
                    </p>
                  ) : (
                    project.members.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center gap-3 group"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(member.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {member.user.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.user.email}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                          {member.role}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          disabled={removingMemberId === member.userId}
                          onClick={() => handleRemoveMember(member.userId)}
                          title="Remove member"
                        >
                          {removingMemberId === member.userId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Project Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="text-sm font-medium">
                        {project.startDate
                          ? format(parseISO(project.startDate), 'MMM d, yyyy')
                          : 'Not set'}
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">End Date</p>
                      <p className="text-sm font-medium">
                        {project.endDate
                          ? format(parseISO(project.endDate), 'MMM d, yyyy')
                          : 'Not set'}
                      </p>
                    </div>
                  </div>
                  {project.budgetHours != null && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">Budget Hours</p>
                            <p className="text-xs font-medium">
                              {project.hoursLogged ?? 0} / {project.budgetHours}h
                            </p>
                          </div>
                          <Progress
                            value={Math.min(100, ((project.hoursLogged ?? 0) / project.budgetHours) * 100)}
                            className="h-2 mt-1.5"
                          />
                          {(project.hoursLogged ?? 0) > project.budgetHours && (
                            <p className="text-xs text-red-600 mt-1">
                              {Math.round(((project.hoursLogged ?? 0) - project.budgetHours) * 100) / 100}h over budget
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-sm font-medium">
                        {format(parseISO(project.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Statuses</p>
                    <div className="flex flex-wrap gap-1.5">
                      {project.statuses.map((s) => (
                        <Badge
                          key={s.id}
                          variant="secondary"
                          className="text-[10px]"
                          style={{
                            backgroundColor: `${s.color}20`,
                            color: s.color,
                            borderColor: `${s.color}30`,
                          }}
                        >
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tickets Tab ───────────────────────────────────────── */}
        <TabsContent value="tickets" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Tickets
              <Badge variant="secondary" className="ml-2 text-xs">
                {project.tickets.length}
              </Badge>
            </h2>
            <Button size="sm" onClick={handleOpenTicketDialog}>
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          </div>

          {project.tickets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Ticket className="h-10 w-10" />
                <p>No tickets yet</p>
                <p className="text-sm">Create the first ticket for this project.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {project.tickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  className="group cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => openTicketDetail(ticket)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground shrink-0">
                            {project.prefix}-{ticket.uuid.slice(0, 6)}
                          </span>
                          <h3 className="font-medium text-sm truncate">
                            {ticket.title}
                          </h3>
                          <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                            <StarRating value={ticket.stars} onChange={(v) => updateTicketStars(ticket.id, v)} starClassName="h-3 w-3" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge
                            variant="secondary"
                            className="text-[10px]"
                            style={{
                              backgroundColor: `${ticket.status.color}20`,
                              color: ticket.status.color,
                              borderColor: `${ticket.status.color}30`,
                            }}
                          >
                            {ticket.status.name}
                          </Badge>
                          {ticket.priority ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                              style={{
                                backgroundColor: `${ticket.priority.color}20`,
                                color: ticket.priority.color,
                                borderColor: `${ticket.priority.color}30`,
                              }}
                            >
                              {ticket.priority.name}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">-</span>
                          )}
                          {ticket.dueDate && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <CalendarDays className="h-3 w-3" />
                              {format(parseISO(ticket.dueDate), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:shrink-0">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => handleDeleteTicket(ticket.id, e)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {ticket.assignees.length > 0 && (
                          <div className="flex -space-x-2">
                            {ticket.assignees.slice(0, 3).map((a) => (
                              <Avatar key={a.user.id} className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="bg-primary/10 text-primary text-[9px]">
                                  {getInitials(a.user.name)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {ticket.assignees.length > 3 && (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[9px] font-medium border-2 border-background">
                                +{ticket.assignees.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Timeline Tab ──────────────────────────────────────── */}
        <TabsContent value="timeline" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Timeline</h2>
          </div>
          <ProjectGanttChart
            tickets={project.tickets}
            onTicketClick={(id) => {
              const t = project.tickets.find((tk) => tk.id === id)
              if (t) openTicketDetail(t)
            }}
          />
        </TabsContent>
      </Tabs>

      {/* ── New Ticket Dialog ──────────────────────────────────── */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateTicket}>
            <DialogHeader>
              <DialogTitle>Create New Ticket</DialogTitle>
              <DialogDescription>
                Add a new ticket to {project.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="ticket-title">Title</Label>
                <Input
                  id="ticket-title"
                  value={ticketForm.title}
                  onChange={(e) => setTicketForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Ticket title"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ticket-desc">Description</Label>
                <Textarea
                  id="ticket-desc"
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the ticket..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={ticketForm.statusId}
                    onValueChange={(v) => setTicketForm((p) => ({ ...p, statusId: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {project.statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select
                    value={ticketForm.priorityId}
                    onValueChange={(v) => setTicketForm((p) => ({ ...p, priorityId: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Star Priority</Label>
                  <div className="pt-2">
                    <StarRating value={ticketForm.stars} onChange={(v) => setTicketForm((p) => ({ ...p, stars: v }))} className="scale-125 origin-left" />
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Assignees</Label>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {project.members.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No members to assign</p>
                  ) : (
                    project.members.map((m) => {
                      const isSelected = ticketForm.assigneeIds.includes(m.user.id)
                      return (
                        <button
                          key={m.userId}
                          type="button"
                          className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm text-left transition-colors ${
                            isSelected
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => toggleAssignee(m.user.id)}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary/10 text-primary text-[9px]">
                              {getInitials(m.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 truncate">{m.user.name}</span>
                          {isSelected && <CheckCircle2 className="h-4 w-4" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ticket-start">Start Date</Label>
                  <Input
                    id="ticket-start"
                    type="date"
                    value={ticketForm.startDate}
                    onChange={(e) => setTicketForm((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ticket-due">Due Date</Label>
                  <Input
                    id="ticket-due"
                    type="date"
                    value={ticketForm.dueDate}
                    onChange={(e) => setTicketForm((p) => ({ ...p, dueDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTicketDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creatingTicket || !ticketForm.title.trim()}>
                {creatingTicket && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Ticket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add Member Dialog ───────────────────────────────────── */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>
              Add someone to this project and set their role.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Select
                value={addMemberForm.userId}
                onValueChange={(v) => setAddMemberForm((f) => ({ ...f, userId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsersToAdd.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Everyone is already a member
                    </div>
                  ) : (
                    availableUsersToAdd.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} · {u.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={addMemberForm.role}
                onValueChange={(v) => setAddMemberForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddMemberDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addingMember || !addMemberForm.userId}>
                {addingMember && <Loader2 className="h-4 w-4 animate-spin" />}
                Add member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Ticket Detail Dialog ───────────────────────────────── */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-base">
                      {selectedTicket.title}
                    </DialogTitle>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTicket(selectedTicket.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <DialogDescription className="font-mono text-xs">
                  {project.prefix}-{selectedTicket.uuid.slice(0, 6)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Ticket Meta */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{
                      backgroundColor: `${selectedTicket.status.color}20`,
                      color: selectedTicket.status.color,
                      borderColor: `${selectedTicket.status.color}30`,
                    }}
                  >
                    {selectedTicket.status.name}
                  </Badge>
                  {selectedTicket.priority ? (
                    <Badge
                      variant="secondary"
                      className="text-xs"
                      style={{
                        backgroundColor: `${selectedTicket.priority.color}20`,
                        color: selectedTicket.priority.color,
                        borderColor: `${selectedTicket.priority.color}30`,
                      }}
                    >
                      {selectedTicket.priority.name}
                    </Badge>
                  ) : null}
                  <div className="flex items-center gap-2 border-l pl-3 ml-1">
                    <span className="text-xs text-muted-foreground font-medium">Priority</span>
                    <StarRating value={selectedTicket.stars} onChange={(v) => updateTicketStars(selectedTicket.id, v)} />
                  </div>
                </div>

                {selectedTicket.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">
                      {selectedTicket.description}
                    </p>
                  </div>
                )}

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Created by</p>
                    <p className="font-medium">{selectedTicket.createdBy.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {format(parseISO(selectedTicket.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  {selectedTicket.startDate && (
                    <div>
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="font-medium">
                        {format(parseISO(selectedTicket.startDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                  {selectedTicket.dueDate && (
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className="font-medium">
                        {format(parseISO(selectedTicket.dueDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Assignees */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Assignees</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTicket.assignees.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Unassigned</span>
                    ) : (
                      selectedTicket.assignees.map((a) => (
                        <div key={a.user.id} className="flex items-center gap-1.5">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary/10 text-primary text-[9px]">
                              {getInitials(a.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{a.user.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Separator />

                {/* Checklist */}
                <TicketChecklist ticketId={selectedTicket.id} />

                <Separator />

                {/* Timesheet */}
                <TicketTimesheet ticketId={selectedTicket.id} />

                <Separator />

                {/* Attachments */}
                <TicketAttachments ticketId={selectedTicket.id} />

                <Separator />

                {/* Comments */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">
                    Comments ({ticketComments.length})
                  </h4>

                  {loadingComments ? (
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
                      {ticketComments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No comments yet
                        </p>
                      ) : (
                        ticketComments.map((comment) => (
                          <div key={comment.id} className="bg-muted/50 rounded-md p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="bg-primary/10 text-primary text-[8px]">
                                  {getInitials(comment.user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium">{comment.user.name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap pl-7">
                              {comment.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Add comment form */}
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <Input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={submittingComment || !commentText.trim()}
                    >
                      {submittingComment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}