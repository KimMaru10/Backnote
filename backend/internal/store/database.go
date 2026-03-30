package store

import (
	"fmt"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func NewDatabase(dbPath string) (*gorm.DB, error) {
	// WALモード・busy_timeout で並行アクセス時のロックを回避
	dsn := fmt.Sprintf("%s?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL", dbPath)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("database open: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("database sql.DB: %w", err)
	}
	// SQLite は書き込み並行不可のため接続を1つに制限
	sqlDB.SetMaxOpenConns(1)

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
