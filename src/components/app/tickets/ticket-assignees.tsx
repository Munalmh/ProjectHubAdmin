'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { UserPlus, X, Loader2, User as UserIcon, ArrowRightLeft } from 'lucide-react'

interface AssigneeUser {
  id: string
  name: string
  email: string
}

interface Assignee {
  userId: string
  user: AssigneeUser
  assignedBy?: { id: string; name: string } | null
}

interface CandidateUser {
  id: string
  name: string
  email: string
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export function TicketAssignees({
  ticketId,
  initialAssignees,
}: {
  ticketId: string
  initialAssignees: Assignee[]
}) {
  const [assignees, setAssignees] = useState<Assignee[]>(initialAssignees)
  const [candidates, setCandidates] = useState<CandidateUser[]>([])
  const [open, setOpen] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [transferringId, setTransferringId] = useState<string | null>(null)
  const [transferOpenId, setTransferOpenId] = useState<string | null>(null)

  useEffect(() => {
    setAssignees(initialAssignees)
  }, [initialAssignees])

  async function loadCandidates() {
    try {
      const res = await fetch('/api/users')
      if (res.ok) setCandidates(await res.json())
    } catch {
      // Silently fail
    }
  }

  async function handleAdd(userId: string) {
    setAddingId(userId)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/assignees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to assign')
      }
      const created = await res.json()
      setAssignees((prev) => [...prev, created])
      toast.success('Assigned — they\'ll get an email notification')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign')
    } finally {
      setAddingId(null)
      setOpen(false)
    }
  }

  async function handleRemove(userId: string) {
    setRemovingId(userId)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/assignees`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error('Failed to unassign')
      setAssignees((prev) => prev.filter((a) => a.userId !== userId))
    } catch {
      toast.error('Failed to unassign')
    } finally {
      setRemovingId(null)
    }
  }

  async function handleTransfer(fromUserId: string, toUserId: string) {
    setTransferringId(toUserId)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/assignees/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId, toUserId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to transfer')
      }
      const created = await res.json()
      setAssignees((prev) => [
        ...prev.filter((a) => a.userId !== fromUserId),
        created,
      ])
      toast.success('Transferred — they have been notified')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to transfer')
    } finally {
      setTransferringId(null)
      setTransferOpenId(null)
    }
  }

  const availableCandidates = candidates.filter(
    (c) => !assignees.some((a) => a.userId === c.id)
  )

  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
      {assignees.length === 0 && (
        <span className="text-sm text-muted-foreground">Unassigned</span>
      )}
      {assignees.map((a) => (
        <div
          key={a.userId}
          className="flex items-center gap-1.5 rounded-full border pl-1 pr-2 py-0.5 group/assignee"
        >
          <div
            className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center shrink-0"
            title={a.assignedBy ? `Assigned by ${a.assignedBy.name}` : undefined}
          >
            {getInitials(a.user.name)}
          </div>
          <span className="text-xs font-medium">{a.user.name}</span>
          
          <Popover
            open={transferOpenId === a.userId}
            onOpenChange={(o) => {
              setTransferOpenId(o ? a.userId : null)
              if (o) loadCandidates()
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-primary transition-opacity ml-0.5 flex items-center justify-center h-4 w-4 rounded hover:bg-muted"
                title="Transfer"
              >
                <ArrowRightLeft className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">Transfer to</p>
              <div className="max-h-56 overflow-y-auto space-y-0.5">
                {availableCandidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-2">No one else to transfer to</p>
                ) : (
                  availableCandidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={transferringId === c.id}
                      onClick={() => handleTransfer(a.userId, c.id)}
                      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted text-sm"
                    >
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center shrink-0">
                        {getInitials(c.name)}
                      </div>
                      <span className="truncate flex-1">{c.name}</span>
                      {transferringId === c.id && <Loader2 className="h-3 w-3 animate-spin" />}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={() => handleRemove(a.userId)}
            disabled={removingId === a.userId}
            className="text-muted-foreground hover:text-destructive transition-opacity flex items-center justify-center h-4 w-4 rounded hover:bg-muted"
            title="Remove"
          >
            {removingId === a.userId ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </button>
        </div>
      ))}
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (o) loadCandidates()
        }}
      >
        <PopoverTrigger asChild>
          <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full border border-dashed">
            <UserPlus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">Assign to</p>
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {availableCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-2">No one else to assign</p>
            ) : (
              availableCandidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={addingId === c.id}
                  onClick={() => handleAdd(c.id)}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted text-sm"
                >
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center shrink-0">
                    {getInitials(c.name)}
                  </div>
                  <span className="truncate flex-1">{c.name}</span>
                  {addingId === c.id && <Loader2 className="h-3 w-3 animate-spin" />}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

