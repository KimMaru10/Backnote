export interface Task {
  id: number
  issueKey: string
  title: string
  description: string
  priority: string
  estimatedHours: number
  dueDate: string | null
  status: string
  score: number
  spaceId: number
  milestoneId: string
  milestoneDueDate: string | null
}

export interface Space {
  id: number
  domain: string
  displayName: string
  color: string
  isActive: boolean
}

export interface Memo {
  id: number
  taskId: number
  content: string
  createdAt: string
  updatedAt: string
}
