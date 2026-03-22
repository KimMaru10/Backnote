package model

import "time"

type Task struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	IssueKey         string     `gorm:"uniqueIndex;not null" json:"issueKey"`
	Title            string     `gorm:"not null" json:"title"`
	Description      string     `json:"description"`
	Priority         string     `json:"priority"`
	EstimatedHours   float64    `gorm:"default:0" json:"estimatedHours"`
	DueDate          *time.Time `json:"dueDate"`
	Status           string     `json:"status"`
	SpaceID          uint       `gorm:"index;not null" json:"spaceId"`
	Score            float64    `gorm:"default:0" json:"score"`
	MilestoneID      string     `json:"milestoneId"`
	MilestoneDueDate *time.Time `json:"milestoneDueDate"`
	SyncedAt         time.Time  `json:"syncedAt"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
	Categories       []Category `gorm:"many2many:task_categories" json:"categories,omitempty"`
}
