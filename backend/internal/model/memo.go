package model

import "time"

type Memo struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	TaskID    uint      `gorm:"index:idx_memo_task_created,priority:1;not null" json:"taskId"`
	Content   string    `gorm:"not null" json:"content"`
	CreatedAt time.Time `gorm:"index:idx_memo_task_created,priority:2" json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
