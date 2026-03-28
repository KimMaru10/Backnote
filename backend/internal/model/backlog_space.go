package model

import "time"

type BacklogSpace struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Domain      string    `gorm:"not null" json:"domain"`
	ApiKeyRef   string    `gorm:"not null" json:"apiKeyRef"`
	Color       string    `gorm:"default:#FAC775" json:"color"`
	DisplayName string    `json:"displayName"`
	ProjectIDs  string    `gorm:"default:''" json:"projectIds"`
	IsActive    bool      `gorm:"default:true" json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Tasks       []Task    `gorm:"foreignKey:SpaceID" json:"tasks,omitempty"`
}
