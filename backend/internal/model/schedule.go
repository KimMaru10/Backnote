package model

import "time"

type Schedule struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	Date           time.Time      `gorm:"uniqueIndex;not null" json:"date"`
	TotalHours     float64        `gorm:"default:8.0" json:"totalHours"`
	AllocatedHours float64        `gorm:"default:0" json:"allocatedHours"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
	Slots          []ScheduleSlot `gorm:"foreignKey:ScheduleID" json:"slots,omitempty"`
}

type ScheduleSlot struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ScheduleID uint      `gorm:"index;not null" json:"scheduleId"`
	TaskID     uint      `gorm:"index;not null" json:"taskId"`
	StartAt    time.Time `json:"startAt"`
	EndAt      time.Time `json:"endAt"`
	OrderIndex int       `gorm:"default:0" json:"orderIndex"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
	Task       Task      `gorm:"foreignKey:TaskID" json:"task,omitempty"`
}
