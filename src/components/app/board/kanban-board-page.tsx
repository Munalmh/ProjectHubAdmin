'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/store/app-store'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { TicketAttachments } from '@/components/app/tickets/ticket-attachments'
import { TicketChecklist } from '@/components/app/tickets/ticket-checklist'
import { TicketAssignees } from '@/components/app/tickets/ticket-assignees'
import { TicketTimesheet } from '@/components/app/tickets/ticket-timesheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DndContext, closestCorners, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, GripVertical, Calendar, List, Plus, FoldHorizontal, UnfoldHorizontal, Trash2, Send } from 'lucide-react'
import { format, isPast, isToday, formatDistanceToNow } from 'date-fns'
import { StarRating } from '@/components/app/shared/star-rating'

interface Ticket {
  id: string; title: string; uuid: string; description?: string
  statusId: string; priorityId?: string
  startDate?: string; dueDate?: string
  stars: number
  project: { name: string; prefix: string; color: string }
  status: { name: string; color: string; isCompleted: boolean }
  priority: { name: string; color: string } | null
  assignees: { user: { id: string; name: string } }[]
  createdBy: { name: string }
}

interface Status {
  id: string; name: string; color: string; sortOrder: number; isCompleted: boolean
  tickets: Ticket[]
}

interface Project {
  id: string; name: string; color: string; statuses: Status[]
  tickets: Ticket[]
  members?: { user: { id: string; name: string } }[]
}

interface Comment {
  id: string; content: string; createdAt: string
  user: { id: string; name: string }
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function UserAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'
  return (
    <div className={`${s} rounded-full bg-primary/10 text-primary font-medium flex items-center justify-center shrink-0`}>
      {getInitials(name)}
    </div>
  )
}

function SortableTicket({ ticket, canDrag, onUpdateStars, onClick }: { ticket: Ticket; canDrag: boolean, onUpdateStars: (id: string, stars: number) => void, onClick: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id, disabled: !canDrag })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const isOverdue = ticket.dueDate && isPast(new Date(ticket.dueDate)) && !ticket.status.isCompleted

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`group ${isDragging ? 'opacity-50' : ''}`}>
      <Card onClick={() => onClick(ticket.id)} className={`p-3 transition-shadow border ${canDrag ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'opacity-80 hover:shadow-md cursor-pointer'}`}>
        <div className="flex items-start gap-2">
          {canDrag && <GripVertical className="h-4 w-4 mt-0.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{ticket.title}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                <StarRating value={ticket.stars} onChange={(v) => onUpdateStars(ticket.id, v)} starClassName="h-3 w-3" />
              </div>
              {ticket.priority && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: ticket.priority.color, color: ticket.priority.color }}>
                  {ticket.priority.name}
                </Badge>
              )}
              {ticket.dueDate && (
                <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                  <Calendar className="h-3 w-3" />
                  {format(new Date(ticket.dueDate), 'MMM d')}
                </span>
              )}
            </div>
            {ticket.assignees.length > 0 && (
              <div className="flex -space-x-1.5 mt-2">
                {ticket.assignees.slice(0, 3).map(a => (
                  <div key={a.user.id} className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center ring-2 ring-background">
                    {getInitials(a.user.name)}
                  </div>
                ))}
                {ticket.assignees.length > 3 && (
                  <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground text-[10px] font-medium flex items-center justify-center ring-2 ring-background">
                    +{ticket.assignees.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

function DroppableColumn({ id, children }: { id: string, children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className="flex flex-col gap-2 flex-1 min-h-[150px]">
      {children}
    </div>
  )
}

export function KanbanBoardPage() {
  const { data: session } = useSession()
  const { selectedProjectId, setSelectedProject } = useAppStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const [project, setProject] = useState<Project | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [initialStatusId, setInitialStatusId] = useState<string | null>(null)
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({})

  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedTicketFull, setSelectedTicketFull] = useState<(any) | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)

  const [addStatusOpen, setAddStatusOpen] = useState(false)
  const [addStatusForm, setAddStatusForm] = useState({ name: '', color: '#6b7280' })
  const [addStatusLoading, setAddStatusLoading] = useState(false)

  async function handleAddStatus() {
    if (!addStatusForm.name.trim() || !project) return
    setAddStatusLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/statuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addStatusForm, sortOrder: project.statuses.length }),
      })
      if (res.ok) {
        toast.success('Status added')
        setAddStatusOpen(false)
        setAddStatusForm({ name: '', color: '#6b7280' })
        queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] })
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to add status')
      }
    } catch {
      toast.error('Failed to add status')
    }
    setAddStatusLoading(false)
  }

  useEffect(() => {
    const saved = localStorage.getItem('phub-collapsed-columns')
    if (saved) setCollapsedColumns(JSON.parse(saved))
  }, [])

  function toggleColumn(id: string) {
    setCollapsedColumns(prev => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem('phub-collapsed-columns', JSON.stringify(next))
      return next
    })
  }

  async function openDetail(ticketId: string) {
    setSelectedTicketFull(null)
    setDetailOpen(true)
    const res = await fetch(`/api/tickets/${ticketId}`)
    if (res.ok) {
      const data = await res.json()
      setSelectedTicketFull(data)
      setComments(data.comments || [])
    }
  }

  async function addComment() {
    if (!newComment.trim() || !selectedTicketFull) return
    setCommentLoading(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicketFull.id}/comments`, {
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
        if (selectedTicketFull && selectedTicketFull.id === ticketId) {
          setSelectedTicketFull(updated)
        }
        queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] })
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
        if (selectedTicketFull?.id === id) setDetailOpen(false)
        queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] })
      } else {
        toast.error('Failed to delete ticket')
      }
    } catch { toast.error('Failed to delete ticket') }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      return res.json()
    },
  })

  const { data: serverProject, isLoading: loading } = useQuery<Project | null>({
    queryKey: ['project', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null
      const res = await fetch(`/api/projects/${selectedProjectId}`)
      if (!res.ok) throw new Error('Failed to load project')
      return res.json()
    },
    enabled: !!selectedProjectId,
    refetchInterval: 3000, // Real-time updates every 3 seconds
  })

  useEffect(() => {
    if (activeId !== null) return // Prevent overwriting optimistic state while dragging
    if (serverProject) setProject(serverProject)
    else setProject(null)
  }, [serverProject, activeId])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
    if (project) {
      const ticket = project.tickets.find(t => t.id === event.active.id)
      if (ticket) {
        setActiveTicket(ticket)
        setInitialStatusId(ticket.statusId)
      }
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || !project) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    const activeTicket = project.tickets.find(t => t.id === activeId)
    if (!activeTicket) return

    let targetStatusId: string | null = null
    const overTicket = project.tickets.find(t => t.id === overId)
    if (overTicket) {
      targetStatusId = overTicket.statusId
    } else {
      const overStatus = project.statuses.find(s => s.id === overId)
      if (overStatus) {
        targetStatusId = overStatus.id
      }
    }

    if (targetStatusId && targetStatusId !== activeTicket.statusId) {
      setProject((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          tickets: prev.tickets.map(t =>
            t.id === activeId ? { ...t, statusId: targetStatusId as string } : t
          )
        }
      })
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active } = event

    // Optimistically update React Query cache BEFORE clearing dragging state
    // This prevents the UI from rubber-banding back to the old server state
    if (project) {
      queryClient.setQueryData(['project', selectedProjectId], project)
    }

    setActiveId(null)
    setActiveTicket(null)
    const startStatusId = initialStatusId
    setInitialStatusId(null)

    if (!project) return

    const ticketId = active.id as string
    const activeTicket = project.tickets.find(t => t.id === ticketId)

    if (activeTicket && startStatusId && activeTicket.statusId !== startStatusId) {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/move`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statusId: activeTicket.statusId }),
        })
        if (!res.ok) {
          toast.error('Failed to move ticket')
          setProject(prev => prev ? { ...prev, tickets: prev.tickets.map(t => t.id === ticketId ? { ...t, statusId: startStatusId } : t) } : prev)
          queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] })
        } else {
          // Sync server query data silently
          queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] })
        }
      } catch {
        toast.error('Failed to move ticket')
        setProject(prev => prev ? { ...prev, tickets: prev.tickets.map(t => t.id === ticketId ? { ...t, statusId: startStatusId } : t) } : prev)
        queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] })
      }
    }
  }

  const columns = project?.statuses.map(status => ({
    ...status,
    tickets: project.tickets.filter(t => t.statusId === status.id),
  })) || []

  if (!session) return null

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {selectedProjectId && (
          <Button variant="ghost" size="icon" onClick={() => router.push('/projects/' + selectedProjectId)} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        {selectedProjectId ? (
          <h1 className="text-xl font-semibold truncate">{project?.name || 'Loading...'}</h1>
        ) : (
          <h1 className="text-xl font-semibold">Kanban Board</h1>
        )}
        <div className="flex-1" />
        {projects.length > 0 && (
          <Select
            value={selectedProjectId || undefined}
            onValueChange={(id) => setSelectedProject(id)}
          >
            <SelectTrigger className="w-48"><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={() => router.push('/tickets')}>
          <List className="h-4 w-4 mr-1.5" /> All Tickets
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="p-4"><Skeleton className="h-5 w-24 mb-4" />{[1, 2, 3].map(j => <Skeleton key={j} className="h-20 w-full mb-2 rounded-lg" />)}</Card>
          ))}
        </div>
      ) : !project ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <List className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No project selected</h3>
          <p className="text-sm text-muted-foreground mb-4">Select a project to view its board</p>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <ScrollArea className="flex-1">
            <div className="flex gap-4 p-1 min-h-[calc(100vh-200px)]">
              {columns.map(col => {
                const isCollapsed = collapsedColumns[col.id]
                return (
                <div key={col.id} className={`shrink-0 flex flex-col transition-all duration-300 ease-in-out ${isCollapsed ? 'w-[50px] min-w-[50px]' : 'w-[280px] min-w-[280px]'}`}>
                  <div className="flex items-center gap-2 mb-3 px-1 h-8">
                    {!isCollapsed && (
                      <>
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                        <h3 className="text-sm font-semibold truncate flex-1">{col.name}</h3>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">{col.tickets.length}</Badge>
                      </>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`h-6 w-6 shrink-0 text-muted-foreground ${isCollapsed ? 'mx-auto' : ''}`}
                      onClick={() => toggleColumn(col.id)}
                      title={isCollapsed ? "Expand column" : "Collapse column"}
                    >
                      {isCollapsed ? <UnfoldHorizontal className="h-4 w-4" /> : <FoldHorizontal className="h-4 w-4" />}
                    </Button>
                  </div>
                  <SortableContext items={isCollapsed ? [] : col.tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <DroppableColumn id={col.id}>
                      {!isCollapsed ? (
                        <>
                          {col.tickets.map(ticket => (
                            <SortableTicket 
                              key={ticket.id} 
                              ticket={ticket} 
                              canDrag={(session?.user as any)?.role !== 'admin' && !!project?.members?.some(m => m.user.id === (session?.user as any)?.id)} 
                              onUpdateStars={updateTicketStars}
                              onClick={openDetail}
                            />
                          ))}
                          {col.tickets.length === 0 && (
                            <div className="border-2 border-dashed rounded-lg p-6 text-center">
                              <p className="text-xs text-muted-foreground">No tickets</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center pt-2">
                          <div className="h-2.5 w-2.5 rounded-full mb-4 shrink-0" style={{ backgroundColor: col.color }} />
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0 mb-4">{col.tickets.length}</Badge>
                          <div 
                            className="text-sm font-semibold text-muted-foreground whitespace-nowrap" 
                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                          >
                            {col.name}
                          </div>
                        </div>
                      )}
                    </DroppableColumn>
                  </SortableContext>
                </div>
              )})}
              <div className="shrink-0 w-[280px]">
                <Button variant="outline" className="w-full border-dashed h-8 text-muted-foreground" onClick={() => setAddStatusOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Add Status
                </Button>
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <DragOverlay>{activeTicket && <div className="w-[268px] opacity-80"><SortableTicket ticket={activeTicket} canDrag={false} onUpdateStars={()=>{}} onClick={()=>{}} /></div>}</DragOverlay>
        </DndContext>
      )}

      {/* Ticket Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          {!selectedTicketFull && (
            <DialogHeader>
              <DialogTitle className="sr-only">Ticket details</DialogTitle>
            </DialogHeader>
          )}
          {selectedTicketFull ? (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" style={{ borderColor: selectedTicketFull.project.color, color: selectedTicketFull.project.color }}>
                      {selectedTicketFull.project.prefix}-{selectedTicketFull.uuid.slice(0, 6)}
                    </Badge>
                    <span>{selectedTicketFull.project.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteTicket(selectedTicketFull.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <DialogTitle className="text-lg">{selectedTicketFull.title}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Badge style={{ backgroundColor: selectedTicketFull.status.color + '20', color: selectedTicketFull.status.color }}>{selectedTicketFull.status.name}</Badge>
                {selectedTicketFull.priority && <Badge variant="outline" style={{ borderColor: selectedTicketFull.priority.color, color: selectedTicketFull.priority.color }}>{selectedTicketFull.priority.name}</Badge>}
                <div className="flex items-center gap-2 border-l pl-3 ml-1">
                  <span className="text-xs text-muted-foreground font-medium">Priority</span>
                  <StarRating value={selectedTicketFull.stars} onChange={(v) => updateTicketStars(selectedTicketFull.id, v)} />
                </div>
              </div>
              {selectedTicketFull.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-4">{selectedTicketFull.description}</p>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div><span className="text-muted-foreground">Created by:</span> <span className="font-medium">{selectedTicketFull.createdBy.name}</span></div>
                <div><span className="text-muted-foreground">Updated:</span> <span className="font-medium">{formatDistanceToNow(new Date(selectedTicketFull.updatedAt))} ago</span></div>
                {selectedTicketFull.startDate && <div><span className="text-muted-foreground">Start:</span> <span className="font-medium">{format(new Date(selectedTicketFull.startDate), 'MMM d, yyyy')}</span></div>}
                {selectedTicketFull.dueDate && <div><span className="text-muted-foreground">Due:</span> <span className="font-medium">{format(new Date(selectedTicketFull.dueDate), 'MMM d, yyyy')}</span></div>}
              </div>
              <TicketAssignees ticketId={selectedTicketFull.id} initialAssignees={selectedTicketFull.assignees} />
              <div className="border-t pt-4 mb-4">
                <TicketChecklist ticketId={selectedTicketFull.id} />
              </div>
              <div className="border-t pt-4 mb-4">
                <TicketTimesheet ticketId={selectedTicketFull.id} />
              </div>
              <div className="border-t pt-4 mb-4">
                <TicketAttachments ticketId={selectedTicketFull.id} />
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">Comments ({comments.length})</h4>
                <ScrollArea className="max-h-48">
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

      {/* Add Status Dialog */}
      <Dialog open={addStatusOpen} onOpenChange={setAddStatusOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Status</DialogTitle>
            <DialogDescription>Create a new column for this board.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={addStatusForm.name} onChange={e => setAddStatusForm(prev => ({...prev, name: e.target.value}))} placeholder="e.g. In Review" />
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input type="color" className="w-12 p-1" value={addStatusForm.color} onChange={e => setAddStatusForm(prev => ({...prev, color: e.target.value}))} />
                <Input value={addStatusForm.color} onChange={e => setAddStatusForm(prev => ({...prev, color: e.target.value}))} placeholder="#000000" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStatusOpen(false)}>Cancel</Button>
            <Button onClick={handleAddStatus} disabled={addStatusLoading || !addStatusForm.name.trim()}>
              {addStatusLoading ? 'Saving...' : 'Add Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}