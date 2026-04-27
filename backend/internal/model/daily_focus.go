package model

import "time"

// DailyFocus は「今日のフォーカス」として選択されたタスクのピン留めを表す。
// 1日 1 件 / Position は 1-3 を想定。日付は YYYY-MM-DD のローカルタイム。
type DailyFocus struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	Date        string     `gorm:"index;not null" json:"date"` // YYYY-MM-DD
	TaskID      uint       `gorm:"index;not null" json:"taskId"`
	Position    int        `json:"position"`
	CompletedAt *time.Time `json:"completedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
}

const MaxDailyFocus = 3
