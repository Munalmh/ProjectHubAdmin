import { useState, useEffect, useRef } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  max?: number
  readonly?: boolean
  className?: string
  starClassName?: string
}

export function StarRating({
  value,
  onChange,
  max = 5,
  readonly = false,
  className,
  starClassName,
}: StarRatingProps) {
  const [localValue, setLocalValue] = useState(value)
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const updateLock = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only sync from parent if we aren't in the middle of an optimistic update
    if (!updateLock.current) {
      setLocalValue(value)
    }
  }, [value])

  return (
    <div 
      className={cn("flex items-center gap-1", className)}
      onMouseLeave={() => setHoverValue(null)}
    >
      {Array.from({ length: max }).map((_, i) => {
        const starValue = i + 1
        const active = hoverValue !== null ? starValue <= hoverValue : starValue <= localValue

        return (
          <button
            key={i}
            type="button"
            disabled={readonly}
            onMouseEnter={() => { if (!readonly) setHoverValue(starValue) }}
            onClick={(e) => {
              e.stopPropagation()
              if (!readonly && onChange) {
                const newValue = localValue === starValue ? 0 : starValue
                
                // Optimistic UI update
                setLocalValue(newValue)
                
                // Lock syncing from parent for a brief period to prevent flickering
                // while the API request completes and invalidates the cache
                if (updateLock.current) clearTimeout(updateLock.current)
                updateLock.current = setTimeout(() => {
                  updateLock.current = null
                }, 2000)

                onChange(newValue)
              }
            }}
            className={cn(
              "transition-all rounded-sm focus:outline-none",
              readonly ? "cursor-default" : "cursor-pointer hover:bg-muted/50 p-0.5 hover:scale-110",
              active ? "text-yellow-500" : "text-muted-foreground/30",
              starClassName
            )}
          >
            <Star
              className={cn("h-4 w-4 transition-all duration-200", active ? "fill-current" : "")}
            />
          </button>
        )
      })}
    </div>
  )
}
