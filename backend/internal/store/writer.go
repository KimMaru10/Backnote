package store

import (
	"errors"
	"fmt"
	"log"
	"runtime/debug"
	"time"

	"gorm.io/gorm"
)

// WriteFunc は DBWriter.Do に渡すトランザクション処理。
// 引数の tx を使った書き込みは Writer goroutine 上で直列に実行される。
type WriteFunc func(tx *gorm.DB) error

// DBWriter は SQLite への書き込みを単一の goroutine に集約する。
// すべての書き込みを直列化することで、SQLITE_BUSY/LOCKED 競合を構造的に回避する。
// 読み取りは引き続き *gorm.DB を直接使い、複数接続で並行実行できる。
type DBWriter struct {
	db   *gorm.DB
	ch   chan writeJob
	done chan struct{}
}

type writeJob struct {
	fn  WriteFunc
	res chan error
}

// slowWriteThreshold を超えた書き込みは warn ログに出す（性能問題の可視化）。
const slowWriteThreshold = 500 * time.Millisecond

// NewDBWriter は DBWriter を生成して書き込み専用 goroutine を起動する。
func NewDBWriter(db *gorm.DB) *DBWriter {
	w := &DBWriter{
		db:   db,
		ch:   make(chan writeJob, 128),
		done: make(chan struct{}),
	}
	go w.loop()
	log.Printf("dbwriter: started")
	return w
}

func (w *DBWriter) loop() {
	for {
		select {
		case job := <-w.ch:
			w.runJob(job)
		case <-w.done:
			return
		}
	}
}

// runJob はトランザクションを実行し、必ず結果を res に返す。
// panic を recover して goroutine 自体が死なないようにする
// （死ぬと以降のすべての Do() がハングするため）。
func (w *DBWriter) runJob(job writeJob) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("dbwriter: PANIC recovered: %v\n%s", r, debug.Stack())
			job.res <- fmt.Errorf("dbwriter panic: %v", r)
		}
	}()
	start := time.Now()
	err := w.db.Transaction(job.fn)
	if d := time.Since(start); d > slowWriteThreshold {
		log.Printf("dbwriter: slow write took %v", d)
	}
	job.res <- err
}

// Do は呼び出し元から見て同期的に書き込みを実行する。
// 内部では Writer goroutine にジョブを投げ、結果を待つ。
func (w *DBWriter) Do(fn WriteFunc) error {
	res := make(chan error, 1)
	select {
	case w.ch <- writeJob{fn: fn, res: res}:
	case <-w.done:
		return errors.New("dbwriter: stopped")
	}
	// 結果待ち。Stop が呼ばれていてもジョブが処理されれば結果が来る。
	select {
	case err := <-res:
		return err
	case <-w.done:
		return errors.New("dbwriter: stopped while waiting")
	}
}

// Stop は Writer goroutine を停止する。プロセス終了時に呼ぶ。
func (w *DBWriter) Stop() {
	close(w.done)
}
