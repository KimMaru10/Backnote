package store

import (
	"fmt"

	"github.com/KimMaru10/PeelTask/backend/internal/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func NewDatabase(dbPath string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("database open: %w", err)
	}

	if err := db.AutoMigrate(
		&model.BacklogSpace{},
		&model.Task{},
		&model.Schedule{},
		&model.ScheduleSlot{},
		&model.Category{},
		&model.Memo{},
	); err != nil {
		return nil, fmt.Errorf("database migrate: %w", err)
	}

	return db, nil
}
