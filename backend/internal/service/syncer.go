package service

import (
	"context"
	"fmt"
	"log"
	"sync/atomic"
	"time"

	"github.com/KimMaru10/PeelTask/backend/internal/model"
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

		if len(result.Tasks) > 0 {
			if err := s.db.Save(&result.Tasks).Error; err != nil {
				log.Printf("error: failed to save tasks for space %d: %v", result.SpaceID, err)
				errs = append(errs, fmt.Sprintf("DB save error (space %d): %v", result.SpaceID, err))
				continue
			}
		}

		totalTasks += len(result.Tasks)
	}

	now := time.Now()
	s.lastSyncedAt.Store(now)
	log.Printf("sync completed: %d tasks synced", totalTasks)

	return totalTasks, errs
}
