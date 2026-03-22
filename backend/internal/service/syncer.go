package service

import (
	"context"
	"log"
	"sync/atomic"
	"time"

	"github.com/KimMaru10/PeelTask/backend/internal/model"
	"gorm.io/gorm"
)

const syncInterval = 15 * time.Minute

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
		s.runSync()

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
	t := v.(time.Time)
	return &t
}

func (s *Syncer) RunManualSync() (int, []string) {
	return s.runSync()
}

func (s *Syncer) runSync() (int, []string) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
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

		if len(result.Tasks) > 0 {
			s.db.Save(&result.Tasks)
		}

		totalTasks += len(result.Tasks)
	}

	now := time.Now()
	s.lastSyncedAt.Store(now)
	log.Printf("sync completed: %d tasks synced", totalTasks)

	return totalTasks, errs
}
