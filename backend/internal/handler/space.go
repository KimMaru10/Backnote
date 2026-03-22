package handler

import (
	"net/http"

	"github.com/KimMaru10/PeelTask/backend/internal/model"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type SpaceHandler struct {
	db *gorm.DB
}

func NewSpaceHandler(db *gorm.DB) *SpaceHandler {
	return &SpaceHandler{db: db}
}

type createSpaceRequest struct {
	Domain      string `json:"domain" validate:"required"`
	ApiKeyRef   string `json:"apiKeyRef" validate:"required"`
	Color       string `json:"color"`
	DisplayName string `json:"displayName" validate:"required"`
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

	if req.Domain == "" || req.ApiKeyRef == "" || req.DisplayName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "domain, apiKeyRef, and displayName are required",
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
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "space not found",
		})
	}

	var req createSpaceRequest
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

	if err := h.db.Delete(&model.BacklogSpace{}, id).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to delete space",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"status": "deleted",
	})
}

func (h *SpaceHandler) TestConnection(c echo.Context) error {
	var req struct {
		Domain string `json:"domain"`
		ApiKey string `json:"apiKey"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
		})
	}

	resp, err := http.Get("https://" + req.Domain + "/api/v2/space?apiKey=" + req.ApiKey)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": false,
			"error":   "connection failed",
		})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": false,
			"error":   "authentication failed",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
	})
}
