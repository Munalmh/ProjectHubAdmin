'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import NepaliCalendar from '@sbmdkl/nepali-datepicker-reactjs'
import { formatBs } from '@/lib/nepali-date'
import { Plus, FolderKanban, Users, Ticket, CalendarDays, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import { ExcelActions } from '@/components/app/shared/excel-actions'
import { StarRating } from '@/components/app/shared/star-rating'
import { toast } from 'sonner'
import { useAppStore } from '@/store/app-store'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Project {
  id: string
  name: string
  description: string | null
  prefix: string
  color: string
  startDate: string | null
  endDate: string | null
  status: string
  createdAt: string
  stars: number
  _count: { tickets: number; members: number }
  statuses: { id: string; name: string; color: string; sortOrder: number; isCompleted: boolean }[]
}

const PREDEFINED_COLORS = [
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#22c55e',
  '#ef4444',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
]

export function ProjectsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('projecthub-show-done')
    if (saved) setShowDone(JSON.parse(saved))
  }, [])

  function toggleShowDone() {
    setShowDone(prev => {
      const next = !prev
      localStorage.setItem('projecthub-show-done', JSON.stringify(next))
      return next
    })
  }

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPrefix, setFormPrefix] = useState('')
  const [formColor, setFormColor] = useState(PREDEFINED_COLORS[0])
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formBudgetHours, setFormBudgetHours] = useState('')
  const [formStars, setFormStars] = useState(0)

  const {
    data: projects = [],
    isLoading: loading,
    error,
  } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to load projects')
      return res.json()
    },
    refetchInterval: 3000,
  })

  function resetForm() {
    setFormName('')
    setFormDescription('')
    setFormPrefix('')
    setFormColor(PREDEFINED_COLORS[0])
    setFormStartDate('')
    setFormEndDate('')
    setFormBudgetHours('')
    setFormStars(0)
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) {
      toast.error("Project Name is required.")
      return
    }
    if (!formPrefix.trim()) {
      toast.error("Project Prefix is required.")
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          prefix: formPrefix.trim().toUpperCase(),
          color: formColor,
          startDate: formStartDate || null,
          endDate: formEndDate || null,
          budgetHours: formBudgetHours.trim() ? Number(formBudgetHours) : null,
          stars: formStars,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create project')
      }
      const created = await res.json()
      toast.success('Project created')
      resetForm()
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const activeProjects = projects.filter(p => p.status !== 'done')
  const doneProjects = projects.filter(p => p.status === 'done')

  const renderProject = (project: Project) => (
    <Card
      key={project.id}
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push('/projects/' + project.id)}
    >
      <CardContent className="p-0">
        <div className="flex">
          {/* Color strip on left */}
          <div
            className="w-1.5 shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <div className="p-5 flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm truncate">{project.name}</h3>
              <div className="flex items-center gap-2">
                {project.stars > 0 && <StarRating value={project.stars} readonly className="mr-1" starClassName="h-3 w-3" />}
                <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                  {project.prefix}
                </Badge>
              </div>
            </div>
            {project.description && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                {project.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Ticket className="h-3 w-3" />
                {project._count.tickets}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {project._count.members}
              </span>
            </div>
            {(project.startDate || project.endDate) && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                <span>
                  {project.startDate
                    ? formatBs(project.startDate, 'MMM D, YYYY')
                    : 'TBD'}
                  {' — '}
                  {project.endDate
                    ? formatBs(project.endDate, 'MMM D, YYYY')
                    : 'TBD'}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <p>{error instanceof Error ? error.message : 'Error loading projects'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          {!loading && (
            <Badge variant="secondary" className="text-xs">
              {projects.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
        <ExcelActions
          entityLabel="Projects"
          exportUrl="/api/projects/export"
          validateUrl="/api/projects/import/validate"
          commitUrl="/api/projects/import/commit"
          labelField="name"
          subField="prefix"
          onImported={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
        />
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreateProject}>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Add a new project to your workspace.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="project-name">Name</Label>
                  <Input
                    id="project-name"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value)
                      // Auto-generate prefix from name
                      if (!formPrefix) {
                        const words = e.target.value.trim().split(/\s+/)
                        setFormPrefix(
                          words
                            .map((w) => w[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 4)
                        )
                      }
                    }}
                    placeholder="My Project"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project-desc">Description</Label>
                  <Textarea
                    id="project-desc"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe the project..."
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project-prefix">Prefix</Label>
                  <Input
                    id="project-prefix"
                    value={formPrefix}
                    onChange={(e) => setFormPrefix(e.target.value.toUpperCase())}
                    placeholder="PRJ"
                    maxLength={6}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`h-8 w-8 rounded-full transition-all ${
                          formColor === color
                            ? 'ring-2 ring-offset-2 ring-offset-background scale-110'
                            : 'hover:scale-110'
                        }`}
                        style={{
                          backgroundColor: color,
                          ...(formColor === color ? { ringColor: color } : {}),
                        }}
                        onClick={() => setFormColor(color)}
                      />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="project-start">Start Date</Label>
                    <div className="relative">
                      <NepaliCalendar
                        defaultDate={formStartDate || ''}
                        onChange={({ bsDate }: { bsDate: string }) => setFormStartDate(bsDate)}
                        language="en"
                        dateFormat="YYYY-MM-DD"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="project-end">End Date</Label>
                    <div className="relative end-date-picker">
                      <NepaliCalendar
                        defaultDate={formEndDate || ''}
                        onChange={({ bsDate }: { bsDate: string }) => setFormEndDate(bsDate)}
                        language="en"
                        dateFormat="YYYY-MM-DD"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="project-budget">Budget Hours</Label>
                    <Input
                      id="project-budget"
                      type="number"
                      min="0"
                      step="0.5"
                      value={formBudgetHours}
                      onChange={(e) => setFormBudgetHours(e.target.value)}
                      placeholder="e.g. 200"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <div className="pt-2">
                      <StarRating value={formStars} onChange={setFormStars} className="scale-125 origin-left" />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || !formName.trim()}>
                  {creating ? 'Creating...' : 'Create Project'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Project Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-1 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
                <div className="flex gap-4 mt-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
          <FolderKanban className="h-12 w-12" />
          <p>No projects yet</p>
          <p className="text-sm">Create your first project to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Projects */}
          {activeProjects.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {activeProjects.map(renderProject)}
            </div>
          )}

          {/* Done Projects */}
          {doneProjects.length > 0 && (
            <div className="border rounded-lg bg-muted/20">
              <button
                onClick={toggleShowDone}
                className="flex items-center gap-2 w-full p-4 hover:bg-muted/40 transition-colors"
              >
                {showDone ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <h3 className="font-medium">Completed Projects</h3>
                <Badge variant="secondary" className="ml-auto">{doneProjects.length}</Badge>
              </button>
              
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${showDone ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              >
                <div className="overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 pt-0">
                    {doneProjects.map(renderProject)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}