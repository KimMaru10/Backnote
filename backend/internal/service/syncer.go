package service

import (
	"context"
	"log"
	"sync/atomic"
	"time"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/KimMaru10/Backnote/backend/internal/store"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	syncInterval     = 15 * time.Minute
	syncTimeout      = 60 * time.Second // Backlog API + DB 書き込みの上限
	initialSyncDelay = 3 * time.Second
)

type Syncer struct {
	db            *gorm.DB
	backlogClient *BacklogClient
	writer        *store.DBWriter
	lastSyncedAt  atomic.Value
	stopCh        chan struct{}
}

func NewSyncer(db *gorm.DB, backlogClient *BacklogClient, writer *store.DBWriter) *Syncer {
	return &Syncer{
		db:            db,
		backlogClient: backlogClient,
		writer:        writer,
		stopCh:        make(chan struct{}),
	}
}

// write は writer 経由（直列化）またはローカルトランザクション（テスト互換）。
func (s *Syncer) write(fn store.WriteFunc) error {
	if s.writer != nil {
		return s.writer.Do(fn)
	}
	return s.db.Transaction(fn)
}

func (s *Syncer) Start() {
	go func() {
		select {
		case <-time.After(initialSyncDelay):
			s.runSync()
		case <-s.stopCh:
			return
		}

		ticker := time.NewTicker(syncInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				s.runSync()
			case <-s.stopCh:
				return
			}
		}
	}()
}

func (s *Syncer) Stop() {
	close(s.stopCh)
}

func (s *Syncer) LastSyncedAt() *time.Time {
	v := s.lastSyncedAt.Load()
	if v == nil {
		return nil
	}
	t, ok := v.(time.Time)
	if !ok {
		return nil
	}
	return &t
}

func (s *Syncer) RunManualSync() (int, []string) {
	return s.runSync()
}

func (s *Syncer) runSync() (int, []string) {
	syncStart := time.Now()
	defer func() {
		log.Printf("sync: total elapsed %v", time.Since(syncStart))
	}()

	ctx, cancel := context.WithTimeout(context.Background(), syncTimeout)
	defer cancel()

	var spaces []model.BacklogSpace
	if err := s.db.Where("is_active = ?", true).Find(&spaces).Error; err != nil {
		log.Printf("warn: sync fetch spaces: %v", err)
		return 0, []string{err.Error()}
	}

	if len(spaces) == 0 {
		return 0, nil
	}

	apiKeys := make(map[uint]string, len(spaces))
	for _, space := range spaces {
		apiKeys[space.ID] = space.ApiKeyRef
	}

	apiStart := time.Now()
	results := s.backlogClient.FetchAllSpaces(ctx, spaces, apiKeys)
	log.Printf("sync: backlog API fetch took %v (spaces=%d)", time.Since(apiStart), len(spaces))

	totalTasks := 0
	var errs []string

	for _, result := range results {
		if result.Err != nil {
			errs = append(errs, result.Err.Error())
			continue
		}

		if len(result.Tasks) > 0 {
			ScoreAllTasks(result.Tasks, time.Now())
		}

		// 1スペース分の書き込みを 1 トランザクションに集約し、Writer goroutine で直列化。
		// 個別 Save/Create だとタスク件数だけロックが発生するため、まとめて短時間で完了させる。
		txErr := s.write(func(tx *gorm.DB) error {
			if result.MyUserID != 0 {
				if err := tx.Model(&model.BacklogSpace{}).
					Where("id = ?", result.SpaceID).
					Update("my_user_id", result.MyUserID).Error; err != nil {
					return err
				}
			}

			activeIssueKeys := make([]string, 0, len(result.Tasks))
			if len(result.Tasks) > 0 {
				// issue_key の UNIQUE 制約を利用して 1 クエリで UPSERT。
				if err := tx.Clauses(clause.OnConflict{
					Columns: []clause.Column{{Name: "issue_key"}},
					DoUpdates: clause.AssignmentColumns([]string{
						"title", "description", "priority", "estimated_hours",
						"due_date", "status", "assignee_id", "score",
						"milestone_id", "milestone_due_date", "backlog_created_at", "synced_at",
					}),
				}).Create(&result.Tasks).Error; err != nil {
					return err
				}
				for i := range result.Tasks {
					activeIssueKeys = append(activeIssueKeys, result.Tasks[i].IssueKey)
				}
			}

			// クリーンアップ: Backlog 側で完了/削除された課題をローカルからも削除。
			// activeIssueKeys が空のときは Backlog API が一時的に 0 件返した可能性が高いため、
			// 安全側に倒してクリーンアップをスキップする（誤って全タスクを削除するのを防ぐ）。
			if len(activeIssueKeys) == 0 {
				log.Printf("sync: skip cleanup for space %d (no active tasks fetched)", result.SpaceID)
				return nil
			}

			var staleTaskIDs []uint
			if err := tx.Model(&model.Task{}).
				Where("space_id = ? AND issue_key NOT IN ?", result.SpaceID, activeIssueKeys).
				Pluck("id", &staleTaskIDs).Error; err != nil {
				return err
			}
			if len(staleTaskIDs) > 0 {
				if err := tx.Where("task_id IN ?", staleTaskIDs).Delete(&model.Memo{}).Error; err != nil {
					return err
				}
				if err := tx.Where("id IN ?", staleTaskIDs).Delete(&model.Task{}).Error; err != nil {
					return err
				}
				log.Printf("cleanup: removed %d stale tasks for space %d", len(staleTaskIDs), result.SpaceID)
			}

			return nil
		})

		if txErr != nil {
			store.LogSQLiteError(txErr, "sync.Transaction")
			log.Printf("error: sync tx failed for space %d: %v", result.SpaceID, txErr)
			errs = append(errs, txErr.Error())
			continue
		}

		totalTasks += len(result.Tasks)
	}

	now := time.Now()
	s.lastSyncedAt.Store(now)
	log.Printf("sync completed: %d tasks synced", totalTasks)

	return totalTasks, errs
}
