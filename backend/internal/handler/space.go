package handler

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

var domainExtractPattern = regexp.MustCompile(`([a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?\.backlog\.(jp|com))`)

// extractBacklogDomain はユーザー入力からBacklogドメインを抽出する。
// 例: "https://pencil-rm.backlog.jp/view/TASK-1" → "pencil-rm.backlog.jp"
func extractBacklogDomain(input string) (string, error) {
	input = strings.TrimSpace(input)
	match := domainExtractPattern.FindString(input)
	if match == "" {
		return "", fmt.Errorf("Backlogドメインが見つかりません（例: xxx.backlog.jp）")
	}
	return match, nil
}

func testBacklogConnection(domain string, apiKey string) error {
	url := fmt.Sprintf("https://%s/api/v2/space?apiKey=%s", domain, apiKey)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("接続に失敗しました: %s", domain)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("APIキーが無効です")
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("接続エラー (status: %d)", resp.StatusCode)
	}
	return nil
}

type SpaceHandler struct {
	db *gorm.DB
}

func NewSpaceHandler(db *gorm.DB) *SpaceHandler {
	return &SpaceHandler{db: db}
}

type createSpaceRequest struct {
	Domain      string `json:"domain"`
	ApiKeyRef   string `json:"apiKeyRef"`
	Color       string `json:"color"`
	DisplayName string `json:"displayName"`
}

type updateSpaceRequest struct {
	Domain      string `json:"domain"`
	ApiKeyRef   string `json:"apiKeyRef"`
	Color       string `json:"color"`
	DisplayName string `json:"displayName"`
}

func (h *SpaceHandler) List(c echo.Context) error {
	var spaces []model.BacklogSpace
	if err := h.db.Order("created_at DESC").Find(&spaces).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to fetch spaces",
		})
	}
	return c.JSON(http.StatusOK, spaces)
}

func (h *SpaceHandler) Create(c echo.Context) error {
	var req createSpaceRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
		})
	}

	req.ApiKeyRef = strings.TrimSpace(req.ApiKeyRef)
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if req.Domain == "" || req.ApiKeyRef == "" || req.DisplayName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "domain, apiKeyRef, and displayName are required",
		})
	}

	domain, err := extractBacklogDomain(req.Domain)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}
	req.Domain = domain

	if connErr := testBacklogConnection(req.Domain, req.ApiKeyRef); connErr != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": connErr.Error(),
		})
	}

	if req.Color == "" {
		req.Color = "#FAC775"
	}

	space := model.BacklogSpace{
		Domain:      req.Domain,
		ApiKeyRef:   req.ApiKeyRef,
		Color:       req.Color,
		DisplayName: req.DisplayName,
		IsActive:    true,
	}

	if err := h.db.Create(&space).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to create space",
		})
	}

	return c.JSON(http.StatusCreated, space)
}

func (h *SpaceHandler) Update(c echo.Context) error {
	id := c.Param("id")

	var space model.BacklogSpace
	if err := h.db.First(&space, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "space not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to fetch space",
		})
	}

	var req updateSpaceRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
		})
	}

	if req.Domain != "" {
		space.Domain = req.Domain
	}
	if req.ApiKeyRef != "" {
		space.ApiKeyRef = req.ApiKeyRef
	}
	if req.Color != "" {
		space.Color = req.Color
	}
	if req.DisplayName != "" {
		space.DisplayName = req.DisplayName
	}

	if err := h.db.Save(&space).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to update space",
		})
	}

	return c.JSON(http.StatusOK, space)
}

func (h *SpaceHandler) Delete(c echo.Context) error {
	id := c.Param("id")

	// スペースに紐づくタスクのメモを先に削除
	var taskIDs []uint
	h.db.Model(&model.Task{}).Where("space_id = ?", id).Pluck("id", &taskIDs)
	if len(taskIDs) > 0 {
		h.db.Where("task_id IN ?", taskIDs).Delete(&model.Memo{})
	}

	// スペースに紐づくタスクを削除
	h.db.Where("space_id = ?", id).Delete(&model.Task{})

	result := h.db.Delete(&model.BacklogSpace{}, id)
	if result.Error != nil {
		log.Printf("error: failed to delete space %s: %v", id, result.Error)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to delete space",
		})
	}
	if result.RowsAffected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "space not found",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"status": "deleted",
	})
}

type testConnectionResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (h *SpaceHandler) TestConnection(c echo.Context) error {
	var req struct {
		Domain string `json:"domain"`
		ApiKey string `json:"apiKey"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, testConnectionResponse{
			Success: false,
			Error:   "invalid request body",
		})
	}

	if req.Domain == "" || req.ApiKey == "" {
		return c.JSON(http.StatusOK, testConnectionResponse{
			Success: false,
			Error:   "ドメインとAPIキーを入力してください",
		})
	}

	ctx := c.Request().Context()
	url := fmt.Sprintf("https://%s/api/v2/space?apiKey=%s", req.Domain, req.ApiKey)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return c.JSON(http.StatusOK, testConnectionResponse{
			Success: false,
			Error:   "リクエスト作成に失敗しました",
		})
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return c.JSON(http.StatusOK, testConnectionResponse{
			Success: false,
			Error:   fmt.Sprintf("接続に失敗しました: %s", req.Domain),
		})
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return c.JSON(http.StatusOK, testConnectionResponse{
			Success: false,
			Error:   "APIキーが無効です",
		})
	}

	if resp.StatusCode != http.StatusOK {
		return c.JSON(http.StatusOK, testConnectionResponse{
			Success: false,
			Error:   fmt.Sprintf("APIエラー (status: %d)", resp.StatusCode),
		})
	}

	return c.JSON(http.StatusOK, testConnectionResponse{
		Success: true,
	})
}
