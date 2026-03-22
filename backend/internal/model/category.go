package model

import "time"

type Category struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"uniqueIndex;not null" json:"name"`
	Color     string    `gorm:"default:#3498DB" json:"color"`
	CreatedAt time.Time `json:"createdAt"`
	Tasks     []Task    `gorm:"many2many:task_categories" json:"tasks,omitempty"`
}
