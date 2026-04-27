package store

import (
	"fmt"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func NewDatabase(dbPath string) (*gorm.DB, error) {
	// SQLite の安定設定:
	// - WAL: 読み書き並行可
	// - busy_timeout=10s: SQLITE_BUSY 時の待機
	// - synchronous=NORMAL: WAL 下で十分な耐久性を確保しつつ高速化
	// - cache_size=-20000: ページキャッシュを 20MB に拡張（負値は KB 単位）
	// 書き込み直列化は DBWriter goroutine で行うため、cache=shared は使わない
	// （shared cache + WAL は SQLITE_LOCKED が busy_timeout を無視する既知問題がある）
	dsn := fmt.Sprintf(
		"%s?_journal_mode=WAL&_busy_timeout=10000&_synchronous=NORMAL&_cache_size=-20000",
		dbPath,
	)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("database open: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("database sql.DB: %w", err)
	}
	// WAL 下では「書き込み1 + 読み取り複数」が安全に並行できる。
	// 接続プールに余裕を持たせて、画面操作（読み取り）が同期処理（書き込み）でブロックされにくくする。
	sqlDB.SetMaxOpenConns(8)    // 同時に開ける接続の上限
	sqlDB.SetMaxIdleConns(8)    // アイドルでも保持する接続数（再接続コスト回避）
	sqlDB.SetConnMaxLifetime(0) // 接続を無期限に保持（SQLite はローカルなので切断不要）
	sqlDB.SetConnMaxIdleTime(0)

	if err := db.AutoMigrate(
		&model.BacklogSpace{},
		&model.Task{},
		&model.Schedule{},
		&model.ScheduleSlot{},
		&model.Category{},
		&model.Memo{},
		&model.AppSetting{},
		&model.DailyFocus{},
	); err != nil {
		return nil, fmt.Errorf("database migrate: %w", err)
	}

	return db, nil
}
