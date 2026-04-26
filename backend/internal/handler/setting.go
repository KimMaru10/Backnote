package handler

import (
	"net/http"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/KimMaru10/Backnote/backend/internal/store"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type SettingHandler struct {
	db     *gorm.DB
	writer *store.DBWriter
}

func NewSettingHandler(db *gorm.DB, writer *store.DBWriter) *SettingHandler {
	return &SettingHandler{db: db, writer: writer}
}

// 通知設定のデフォルト値（DB に未保存のキーはこの値を返す）
var defaultSettings = map[string]string{
	model.SettingNotificationEnabled: "true",
	model.SettingRemindToday:         "true",
	model.SettingRemindOverdue:       "true",
	model.SettingMorningSummary:      "true",
	model.SettingMorningSummaryTime:  "09:00",
}

func (h *SettingHandler) write(fn store.WriteFunc) error {
	if h.writer != nil {
		return h.writer.Do(fn)
	}
	return h.db.Transaction(fn)
}

// GET /api/settings — 設定をすべて返す（未保存はデフォルト値）
func (h *SettingHandler) Get(c echo.Context) error {
	var settings []model.AppSetting
	if err := h.db.Find(&settings).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "fetch failed"})
	}

	result := make(map[string]string, len(defaultSettings))
	for k, v := range defaultSettings {
		result[k] = v
	}
	for _, s := range settings {
		result[s.Key] = s.Value
	}
	return c.JSON(http.StatusOK, result)
}

// PUT /api/settings — 受け取った Key-Value を upsert
func (h *SettingHandler) Update(c echo.Context) error {
	var req map[string]string
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	err := h.write(func(tx *gorm.DB) error {
		for key, value := range req {
			setting := model.AppSetting{Key: key, Value: value}
			if err := tx.Save(&setting).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		store.LogSQLiteError(err, "settings.Update")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "update failed"})
	}

	return h.Get(c)
}
