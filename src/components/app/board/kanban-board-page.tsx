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
import { ArrowLeft, GripVertical, Calendar, List, Plus, FoldHorizontal, UnfoldHorizontal } from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'

interface Ticket {
  id: string; title: string; uuid: string; description?: string
  statusId: string; priorityId?: string
  startDate?: string; dueDate?: string
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

function SortableTicket({ ticket, canDrag }: { ticket: Ticket; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id, disabled: !canDrag })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const isOverdue = ticket.dueDate && isPast(new Date(ticket.dueDate)) && !ticket.status.isCompleted

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`group ${isDragging ? 'opacity-50' : ''}`}>
      <Card className={`p-3 transition-shadow border ${canDrag ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'opacity-80'}`}>
        <div className="flex items-start gap-2">
          {canDrag && <GripVertical className="h-4 w-4 mt-0.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{ticket.title}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
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
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <DragOverlay>{activeTicket && <div className="w-[268px] opacity-80"><SortableTicket ticket={activeTicket} /></div>}</DragOverlay>
        </DndContext>
      )}
    </div>
  )
}