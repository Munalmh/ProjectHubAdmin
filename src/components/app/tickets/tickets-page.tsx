'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TicketAttachments } from '@/components/app/tickets/ticket-attachments'
import { TicketChecklist } from '@/components/app/tickets/ticket-checklist'
import { TicketAssignees } from '@/components/app/tickets/ticket-assignees'
import { TicketTimesheet } from '@/components/app/tickets/ticket-timesheet'
import { ExcelActions } from '@/components/app/shared/excel-actions'
import { StarRating } from '@/components/app/shared/star-rating'
import { Search, Plus, X, Send, Calendar, User as UserIcon, Trash2 } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

interface Ticket {
  id: string; title: string; uuid: string; description?: string
  projectId: string; statusId: string; priorityId?: string
  startDate?: string; dueDate?: string; createdAt: string; updatedAt: string
  stars: number
  project: { id: string; name: string; prefix: string; color: string }
  status: { id: string; name: string; color: string; isCompleted: boolean }
  priority: { id: string; name: string; color: string } | null
  assignees: { userId: string; user: { id: string; name: string; email?: string }; assignedBy?: { id: string; name: string } | null }[]
  createdBy: { id: string; name: string }
}

interface Comment {
  id: string; content: string; createdAt: string
  user: { id: string; name: string }
}

interface Project {
  id: string; name: string; prefix: string; color: string
  statuses: { id: string; name: string; color: string }[]
}

interface Priority {
  id: string; name: string; color: string; level: number
}

interface ProjectMember {
  userId: string; role: string; user: { id: string; name: string; email: string }
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function TicketsPage() {
  const { data: session } = useSession()
  const { navigateToProject, navigateToBoard, setPage } = useAppStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState<string>('all')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', description: '', projectId: '', statusId: '', priorityId: '', dueDate: '', stars: 0 })
  const [createLoading, setCreateLoading] = useState(false)
  const [createStatuses, setCreateStatuses] = useState<{ id: string; name: string }[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<(Ticket & { comments: Comment[] }) | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)

  const {
    data: tickets = [],
    isLoading: loading,
  } = useQuery<Ticket[]>({
    queryKey: ['tickets', search, filterProject],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterProject && filterProject !== 'all') params.set('projectId', filterProject)
      const res = await fetch(`/api/tickets?${params}`)
      if (!res.ok) throw new Error('Failed to load tickets')
      return res.json()
    },
    refetchInterval: 3000,
  })

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      return res.json()
    },
  })

  const { data: priorities = [] } = useQuery<Priority[]>({
    queryKey: ['priorities'],
    queryFn: async () => {
      const res = await fetch('/api/priorities')
      return res.json()
    },
  })

  async function openCreateDialog() {
    setCreateForm({ title: '', description: '', projectId: '', statusId: '', priorityId: '', dueDate: '', stars: 0 })
    setSelectedAssignees([])
    setCreateStatuses([])
    setCreateOpen(true)
  }

  async function handleCreate() {
    setCreateLoading(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createForm, assigneeIds: selectedAssignees }),
      })
      if (res.ok) { toast.success('Ticket created'); setCreateOpen(false); queryClient.invalidateQueries({ queryKey: ['tickets'] }) }
      else { const d = await res.json(); toast.error(d.error) }
    } catch { toast.error('Failed to create ticket') }
    setCreateLoading(false)
  }

  async function openDetail(ticket: Ticket) {
    setSelectedTicket(null)
    setDetailOpen(true)
    const res = await fetch(`/api/tickets/${ticket.id}`)
    if (res.ok) {
      const data = await res.json()
      setSelectedTicket(data)
      setComments(data.comments || [])
    }
  }

  async function addComment() {
    if (!newComment.trim() || !selectedTicket) return
    setCommentLoading(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      })
      if (res.ok) {
        const comment = await res.json()
        setComments(prev => [...prev, comment])
        setNewComment('')
      }
    } catch { toast.error('Failed to add comment') }
    setCommentLoading(false)
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
        queryClient.invalidateQueries({ queryKey: ['tickets'] })
        toast.success('Priority updated')
      } else {
        toast.error('Failed to update priority')
      }
    } catch {
      toast.error('Failed to update priority')
    }
  }

  async function deleteTicket(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to delete this ticket?')) return
    try {
      const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Ticket deleted')
        if (selectedTicket?.id === id) setDetailOpen(false)
        queryClient.invalidateQueries({ queryKey: ['tickets'] })
      } else {
        toast.error('Failed to delete ticket')
      }
    } catch { toast.error('Failed to delete ticket') }
  }

  useEffect(() => {
    if (createForm.projectId) {
      fetch(`/api/projects/${createForm.projectId}`).then(r => r.json()).then(p => {
        setCreateStatuses(p.statuses || [])
        setMembers(p.members || [])
        if (p.statuses?.[0]) setCreateForm(f => ({ ...f, statusId: p.statuses[0].id }))
      })
    }
  }, [createForm.projectId])

  if (!session) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">All Tickets</h1>
        <Badge variant="secondary">{tickets.length}</Badge>
        <div className="flex-1" />
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openCreateDialog}><Plus className="h-4 w-4 mr-1.5" /> New Ticket</Button>
        <ExcelActions
          entityLabel="Tickets"
          exportUrl="/api/tickets/export"
          validateUrl="/api/tickets/import/validate"
          commitUrl="/api/tickets/import/commit"
          labelField="title"
          subField="project"
          onImported={() => queryClient.invalidateQueries({ queryKey: ['tickets'] })}
          exportParams={{
            ...(filterProject !== 'all' ? { projectId: filterProject } : {}),
            ...(search ? { search } : {}),
          }}
        />
      </div>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <h3 className="text-lg font-medium mb-1">No tickets found</h3>
          <p className="text-sm text-muted-foreground">Create a new ticket or adjust your filters</p>
        </Card>
      ) : (
        <div className="grid gap-2">
          {tickets.map(ticket => {
            const isOverdue = ticket.dueDate && new Date(ticket.dueDate) < new Date() && !ticket.status.isCompleted
            return (
              <Card key={ticket.id} className="group hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openDetail(ticket)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {ticket.project.prefix}-{ticket.uuid.slice(0, 6)}
                      </span>
                      <span className="text-sm font-medium truncate">{ticket.title}</span>
                      <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                        <StarRating value={ticket.stars} onChange={(v) => updateTicketStars(ticket.id, v)} starClassName="h-3 w-3" />
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => deleteTicket(ticket.id, e)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: ticket.project.color, color: ticket.project.color }}>
                        {ticket.project.name}
                      </Badge>
                      <Badge className="text-[10px]" style={{ backgroundColor: ticket.status.color + '20', color: ticket.status.color }}>
                        {ticket.status.name}
                      </Badge>
                      {ticket.priority && (
                        <Badge variant="outline" className="text-[10px]" style={{ borderColor: ticket.priority.color, color: ticket.priority.color }}>
                          {ticket.priority.name}
                        </Badge>
                      )}
                      {ticket.assignees.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {ticket.assignees.slice(0, 3).map(a => (
                            <div key={a.userId} className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center ring-2 ring-background">
                              {getInitials(a.user.name)}
                            </div>
                          ))}
                        </div>
                      )}
                      {ticket.dueDate && (
                        <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                          <Calendar className="h-3 w-3" />{format(new Date(ticket.dueDate), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Ticket</DialogTitle><DialogDescription>Add a new ticket to a project.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={createForm.projectId} onValueChange={v => setCreateForm(f => ({ ...f, projectId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="Ticket title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the ticket..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={createForm.statusId} onValueChange={v => setCreateForm(f => ({ ...f, statusId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>{createStatuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={createForm.priorityId} onValueChange={v => setCreateForm(f => ({ ...f, priorityId: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>{priorities.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <div className="pt-2">
                  <StarRating value={createForm.stars} onChange={v => setCreateForm(f => ({ ...f, stars: v }))} className="scale-125 origin-left" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={createForm.dueDate} onChange={e => setCreateForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            {createForm.projectId && members.length > 0 && (
              <div className="space-y-2">
                <Label>Assignees</Label>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => {
                    const selected = selectedAssignees.includes(m.userId)
                    return (
                      <Badge key={m.userId} variant={selected ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSelectedAssignees(prev => selected ? prev.filter(x => x !== m.userId) : [...prev, m.userId])}>
                        {m.user.name}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createLoading || !createForm.title || !createForm.projectId}>
              {createLoading ? 'Creating...' : 'Create Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          {!selectedTicket && (
            <DialogHeader>
              <DialogTitle className="sr-only">Ticket details</DialogTitle>
            </DialogHeader>
          )}
          {selectedTicket ? (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" style={{ borderColor: selectedTicket.project.color, color: selectedTicket.project.color }}>
                      {selectedTicket.project.prefix}-{selectedTicket.uuid.slice(0, 6)}
                    </Badge>
                    <span>{selectedTicket.project.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteTicket(selectedTicket.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <DialogTitle className="text-lg">{selectedTicket.title}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Badge style={{ backgroundColor: selectedTicket.status.color + '20', color: selectedTicket.status.color }}>{selectedTicket.status.name}</Badge>
                {selectedTicket.priority && <Badge variant="outline" style={{ borderColor: selectedTicket.priority.color, color: selectedTicket.priority.color }}>{selectedTicket.priority.name}</Badge>}
                <div className="flex items-center gap-2 border-l pl-3 ml-1">
                  <span className="text-xs text-muted-foreground font-medium">Priority</span>
                  <StarRating value={selectedTicket.stars} onChange={(v) => updateTicketStars(selectedTicket.id, v)} />
                </div>
              </div>
              {selectedTicket.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-4">{selectedTicket.description}</p>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div><span className="text-muted-foreground">Created by:</span> <span className="font-medium">{selectedTicket.createdBy.name}</span></div>
                <div><span className="text-muted-foreground">Updated:</span> <span className="font-medium">{formatDistanceToNow(new Date(selectedTicket.updatedAt))} ago</span></div>
                {selectedTicket.startDate && <div><span className="text-muted-foreground">Start:</span> <span className="font-medium">{format(new Date(selectedTicket.startDate), 'MMM d, yyyy')}</span></div>}
                {selectedTicket.dueDate && <div><span className="text-muted-foreground">Due:</span> <span className="font-medium">{format(new Date(selectedTicket.dueDate), 'MMM d, yyyy')}</span></div>}
              </div>
              <TicketAssignees ticketId={selectedTicket.id} initialAssignees={selectedTicket.assignees} />
              <div className="border-t pt-4 mb-4">
                <TicketChecklist ticketId={selectedTicket.id} />
              </div>
              <div className="border-t pt-4 mb-4">
                <TicketTimesheet ticketId={selectedTicket.id} />
              </div>
              <div className="border-t pt-4 mb-4">
                <TicketAttachments ticketId={selectedTicket.id} />
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">Comments ({comments.length})</h4>
                <ScrollArea className="max-h-72 pr-4">
                  <div className="space-y-3">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center shrink-0">
                          {getInitials(c.user.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{c.user.name}</span>
                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt))} ago</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-2 mt-3">
                  <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Write a comment..." onKeyDown={e => e.key === 'Enter' && addComment()} />
                  <Button size="icon" onClick={addComment} disabled={commentLoading || !newComment.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-8"><Skeleton className="h-32 w-full" /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}