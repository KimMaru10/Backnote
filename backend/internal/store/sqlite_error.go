package store

import (
	"log"
	"strings"
)

// LogSQLiteError は SQLite 由来のエラーを操作名つきでログに出す。
// go-sqlite3 の型を直接参照すると CGO ビルド前提になるため、
// エラーメッセージの文字列で BUSY / LOCKED / IOERR を簡易判別する。
func LogSQLiteError(err error, operation string) {
	if err == nil {
		return
	}
	msg := err.Error()
	switch {
	case strings.Contains(msg, "database is locked"):
		log.Printf("error: %s - SQLITE_BUSY/LOCKED (database is locked): %v", operation, err)
	case strings.Contains(msg, "disk I/O error"), strings.Contains(msg, "I/O error"):
		log.Printf("error: %s - SQLITE_IOERR: %v", operation, err)
	default:
		log.Printf("error: %s: %v", operation, err)
	}
}
