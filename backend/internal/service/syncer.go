package service

import (
	"context"
	"log"
	"sync/atomic"
	"time"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"gorm.io/gorm"
)

const (
	syncInterval       = 15 * time.Minute
	syncTimeout        = 2 * time.Minute
	initialSyncDelay   = 3 * time.Second
)

type Syncer struct {
	db            *gorm.DB
	backlogClient *BacklogClient
	lastSyncedAt  atomic.Value
	stopCh        chan struct{}
}

func NewSyncer(db *gorm.DB, backlogClient *BacklogClient) *Syncer {
	return &Syncer{
		db:            db,
		backlogClient: backlogClient,
		stopCh:        make(chan struct{}),
	}
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

	results := s.backlogClient.FetchAllSpaces(ctx, spaces, apiKeys)

	totalTasks := 0
	var errs []string

	for _, result := range results {
		if result.Err != nil {
			errs = append(errs, result.Err.Error())
			continue
		}

		// MyUserID をスペースに保存
		if result.MyUserID != 0 {
			s.db.Model(&model.BacklogSpace{}).Where("id = ?", result.SpaceID).Update("my_user_id", result.MyUserID)
		}

		// Upsert: 取得したタスクを保存/更新
		activeIssueKeys := make([]string, 0, len(result.Tasks))
		if len(result.Tasks) > 0 {
			ScoreAllTasks(result.Tasks, time.Now())
			for i := range result.Tasks {
				task := &result.Tasks[i]
				activeIssueKeys = append(activeIssueKeys, task.IssueKey)
				var existing model.Task
				if err := s.db.Where("issue_key = ?", task.IssueKey).First(&existing).Error; err == nil {
					task.ID = existing.ID
					s.db.Save(task)
				} else {
					if err := s.db.Create(task).Error; err != nil {
						log.Printf("error: failed to create task %s: %v", task.IssueKey, err)
					}
				}
			}
		}

		// クリーンアップ: Backlogで完了/削除されたタスクをローカルから削除
		var staleTaskIDs []uint
		query := s.db.Model(&model.Task{}).Where("space_id = ?", result.SpaceID)
		if len(activeIssueKeys) > 0 {
			query = query.Where("issue_key NOT IN ?", activeIssueKeys)
		}
		query.Pluck("id", &staleTaskIDs)

		if len(staleTaskIDs) > 0 {
			s.db.Where("task_id IN ?", staleTaskIDs).Delete(&model.Memo{})
			s.db.Where("id IN ?", staleTaskIDs).Delete(&model.Task{})
			log.Printf("cleanup: removed %d stale tasks for space %d", len(staleTaskIDs), result.SpaceID)
		}

		totalTasks += len(result.Tasks)
	}

	now := time.Now()
	s.lastSyncedAt.Store(now)
	log.Printf("sync completed: %d tasks synced", totalTasks)

	return totalTasks, errs
}
