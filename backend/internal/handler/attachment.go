package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type AttachmentHandler struct {
	db *gorm.DB
}

func NewAttachmentHandler(db *gorm.DB) *AttachmentHandler {
	return &AttachmentHandler{db: db}
}

type backlogAttachment struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Size int64  `json:"size"`
}

// GET /api/tasks/:id/attachments/:filename
// 課題の添付ファイル一覧から filename にマッチするものを取得し、
// バイナリを Backlog からプロキシして返す。API キーをフロントに渡さずに画像を表示できる。
func (h *AttachmentHandler) GetByName(c echo.Context) error {
	taskID := c.Param("id")
	filename := c.Param("filename")

	if filename == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "filename required"})
	}

	var task model.Task
	if err := h.db.First(&task, taskID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "task not found"})
	}
	var space model.BacklogSpace
	if err := h.db.First(&space, task.SpaceID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "space not found"})
	}

	client := &http.Client{Timeout: 30 * time.Second}

	// 1. 添付一覧から該当 ID を探す
	listURL := fmt.Sprintf("https://%s/api/v2/issues/%s/attachments?apiKey=%s",
		space.Domain, task.IssueKey, space.ApiKeyRef)
	listResp, err := client.Get(listURL)
	if err != nil {
		log.Printf("error: attachment list fetch failed: %v", err)
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "failed to fetch attachments"})
	}
	defer listResp.Body.Close()
	if listResp.StatusCode != http.StatusOK {
		return c.JSON(http.StatusBadGateway, map[string]string{
			"error": fmt.Sprintf("Backlog API error: status %d", listResp.StatusCode),
		})
	}

	var attachments []backlogAttachment
	if err := json.NewDecoder(listResp.Body).Decode(&attachments); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to decode attachments"})
	}

	var attachID int
	for _, a := range attachments {
		if a.Name == filename {
			attachID = a.ID
			break
		}
	}
	if attachID == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "attachment not found: " + filename})
	}

	// 2. 添付ファイルのバイナリを取得してそのまま返す
	fileURL := fmt.Sprintf("https://%s/api/v2/issues/%s/attachments/%d?apiKey=%s",
		space.Domain, task.IssueKey, attachID, space.ApiKeyRef)
	fileResp, err := client.Get(fileURL)
	if err != nil {
		log.Printf("error: attachment binary fetch failed: %v", err)
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "failed to fetch attachment file"})
	}
	defer fileResp.Body.Close()
	if fileResp.StatusCode != http.StatusOK {
		return c.JSON(http.StatusBadGateway, map[string]string{
			"error": fmt.Sprintf("Backlog API error: status %d", fileResp.StatusCode),
		})
	}

	contentType := fileResp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	c.Response().Header().Set("Cache-Control", "private, max-age=3600")
	return c.Stream(http.StatusOK, contentType, fileResp.Body)
}

