package model

import "time"

// AppSetting はアプリ全体の設定を Key-Value で保存する。
// 例: notification_enabled=true, morning_summary_time=09:00
type AppSetting struct {
	Key       string    `gorm:"primaryKey" json:"key"`
	Value     string    `json:"value"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// 通知設定の Key 定数。
const (
	SettingNotificationEnabled  = "notification_enabled"
	SettingRemindToday          = "remind_today"
	SettingRemindOverdue        = "remind_overdue"
	SettingMorningSummary       = "morning_summary"
	SettingMorningSummaryTime   = "morning_summary_time"
)
