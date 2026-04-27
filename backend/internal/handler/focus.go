package handler

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/KimMaru10/Backnote/backend/internal/store"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type FocusHandler struct {
	db     *gorm.DB
	writer *store.DBWriter
}

func NewFocusHandler(db *gorm.DB, writer *store.DBWriter) *FocusHandler {
	return &FocusHandler{db: db, writer: writer}
}

func (h *FocusHandler) write(fn store.WriteFunc) error {
	if h.writer != nil {
		return h.writer.Do(fn)
	}
	return h.db.Transaction(fn)
}

// 「今日」は朝 6 時を境にする運用も可能だが、まずは標準の 0:00 切り替えで実装。
func todayDate() string {
	return time.Now().Format("2006-01-02")
}

type focusEntry struct {
	model.DailyFocus
	Task *model.Task `json:"task,omitempty"`
}

// GET /api/focus
// 今日のフォーカスを Position 昇順で返す。
func (h *FocusHandler) Get(c echo.Context) error {
	var entries []model.DailyFocus
	if err := h.db.Where("date = ?", todayDate()).Order("position ASC").Find(&entries).Error; err != nil {
		log.Printf("error: focus.Get failed: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "fetch failed"})
	}

	if len(entries) == 0 {
		return c.JSON(http.StatusOK, []focusEntry{})
	}

	taskIDs := make([]uint, 0, len(entries))
	for _, e := range entries {
		taskIDs = append(taskIDs, e.TaskID)
	}

	var tasks []model.Task
	if err := h.db.Where("id IN ?", taskIDs).Find(&tasks).Error; err != nil {
		log.Printf("error: focus.Get tasks failed: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "fetch failed"})
	}
	taskByID := make(map[uint]model.Task, len(tasks))
	for _, t := range tasks {
		taskByID[t.ID] = t
	}

	result := make([]focusEntry, 0, len(entries))
	for _, e := range entries {
		t, ok := taskByID[e.TaskID]
		if !ok {
			// タスクが既に削除されていた場合は無視
			continue
		}
		entry := focusEntry{DailyFocus: e}
		entry.Task = &t
		result = append(result, entry)
	}
	return c.JSON(http.StatusOK, result)
}

type putFocusRequest struct {
	TaskIDs []uint `json:"taskIds"`
}

// PUT /api/focus
// 今日のフォーカスを再設定する。配列の順序が Position になる。最大 3 件。
func (h *FocusHandler) Put(c echo.Context) error {
	var req putFocusRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	if len(req.TaskIDs) > model.MaxDailyFocus {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("最大 %d 件までです", model.MaxDailyFocus),
		})
	}

	date := todayDate()
	err := h.write(func(tx *gorm.DB) error {
		if err := tx.Where("date = ?", date).Delete(&model.DailyFocus{}).Error; err != nil {
			return err
		}
		for i, taskID := range req.TaskIDs {
			entry := model.DailyFocus{
				Date:     date,
				TaskID:   taskID,
				Position: i + 1,
			}
			if err := tx.Create(&entry).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		store.LogSQLiteError(err, "focus.Put")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "update failed"})
	}
	return h.Get(c)
}

// POST /api/focus/:taskId/complete
// 該当タスクのフォーカスエントリを完了状態にする（completed_at をセット）。
func (h *FocusHandler) Complete(c echo.Context) error {
	taskID, err := strconv.ParseUint(c.Param("taskId"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid task id"})
	}

	now := time.Now()
	writeErr := h.write(func(tx *gorm.DB) error {
		var entry model.DailyFocus
		if err := tx.Where("date = ? AND task_id = ?", todayDate(), taskID).First(&entry).Error; err != nil {
			return err
		}
		entry.CompletedAt = &now
		return tx.Save(&entry).Error
	})
	if writeErr != nil {
		if errors.Is(writeErr, gorm.ErrRecordNotFound) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "not in today's focus"})
		}
		store.LogSQLiteError(writeErr, "focus.Complete")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "update failed"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

// DELETE /api/focus/:taskId
// 今日のフォーカスから該当タスクを外す。
func (h *FocusHandler) Remove(c echo.Context) error {
	taskID, err := strconv.ParseUint(c.Param("taskId"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid task id"})
	}

	writeErr := h.write(func(tx *gorm.DB) error {
		return tx.Where("date = ? AND task_id = ?", todayDate(), taskID).Delete(&model.DailyFocus{}).Error
	})
	if writeErr != nil {
		store.LogSQLiteError(writeErr, "focus.Remove")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "delete failed"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}
