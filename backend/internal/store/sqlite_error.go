package store

import (
	"errors"
	"log"

	"github.com/mattn/go-sqlite3"
)

// LogSQLiteError は SQLite のエラーコードを判別してログ出力する。
// SQLITE_BUSY と SQLITE_LOCKED は別物で、後者は busy_timeout が効かない既知問題があるため
// 区別して記録できると問題切り分けに役立つ。
func LogSQLiteError(err error, operation string) {
	if err == nil {
		return
	}
	var sqliteErr sqlite3.Error
	if !errors.As(err, &sqliteErr) {
		log.Printf("warn: %s - non-sqlite error: %v", operation, err)
		return
	}
	switch sqliteErr.Code {
	case sqlite3.ErrBusy:
		log.Printf("error: %s - SQLITE_BUSY (busy_timeout で待機しても取れず): %v", operation, sqliteErr)
	case sqlite3.ErrLocked:
		log.Printf("error: %s - SQLITE_LOCKED (busy_timeout が効かないロック競合): %v", operation, sqliteErr)
	case sqlite3.ErrIoErr:
		log.Printf("error: %s - SQLITE_IOERR (extended=%d): %v", operation, sqliteErr.ExtendedCode, sqliteErr)
	default:
		log.Printf("error: %s - SQLite code=%d: %v", operation, sqliteErr.Code, sqliteErr)
	}
}
