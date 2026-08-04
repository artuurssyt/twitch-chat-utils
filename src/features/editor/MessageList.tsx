import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useChatStore } from '@/store/chatStore'
import type { ChatMessage } from '@/types/chat'

function SortableRow({ message, selected }: { message: ChatMessage; selected: boolean }) {
  const selectMessage = useChatStore((s) => s.selectMessage)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: message.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex cursor-pointer items-start gap-2 border-b border-zinc-800/80 px-3 py-2 text-sm ${
        selected ? 'bg-violet-950/50' : 'hover:bg-zinc-900'
      }`}
      onClick={() => selectMessage(message.id)}
    >
      <button
        type="button"
        className="mt-0.5 cursor-grab touch-none text-zinc-500 hover:text-zinc-300"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        ⋮⋮
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-zinc-200">{message.displayName || message.username}</div>
        <div className="truncate text-xs text-zinc-500">{message.message || '(empty)'}</div>
      </div>
    </div>
  )
}

export function MessageList() {
  const messages = useChatStore((s) => s.project.messages)
  const selectedId = useChatStore((s) => s.selectedId)
  const reorderMessages = useChatStore((s) => s.reorderMessages)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = messages.findIndex((m) => m.id === active.id)
    const to = messages.findIndex((m) => m.id === over.id)
    if (from < 0 || to < 0) return
    reorderMessages(from, to)
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-zinc-800">
      <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Messages
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={messages.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            {messages.map((message) => (
              <SortableRow
                key={message.id}
                message={message}
                selected={message.id === selectedId}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
