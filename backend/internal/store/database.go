package store

import (
	"fmt"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func NewDatabase(dbPath string) (*gorm.DB, error) {
	// WALモード: 読み書き並行可、busy_timeout: ロック待機、cache=shared: 接続間でキャッシュ共有
	dsn := fmt.Sprintf("%s?_journal_mode=WAL&_busy_timeout=10000&_synchronous=NORMAL&cache=shared", dbPath)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("database open: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("database sql.DB: %w", err)
	}
	sqlDB.SetMaxOpenConns(2)               // WALモードなら読み+書きで2接続まで安全
	sqlDB.SetMaxIdleConns(2)               // アイドル接続を維持して再接続コストを回避
	sqlDB.SetConnMaxLifetime(0)            // 接続を無期限に保持（切断を防止）
	sqlDB.SetConnMaxIdleTime(0)            // アイドル接続もクローズしない

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
