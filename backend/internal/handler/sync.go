package handler

import (
	"net/http"

	"github.com/KimMaru10/PeelTask/backend/internal/model"
	"github.com/KimMaru10/PeelTask/backend/internal/service"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SyncHandler struct {
	db            *gorm.DB
	backlogClient *service.BacklogClient
}

func NewSyncHandler(db *gorm.DB, backlogClient *service.BacklogClient) *SyncHandler {
	return &SyncHandler{
		db:            db,
		backlogClient: backlogClient,
	}
}

type syncResponse struct {
	TotalTasks int            `json:"totalTasks"`
	Spaces     []spaceResult  `json:"spaces"`
	Errors     []string       `json:"errors,omitempty"`
}

type spaceResult struct {
	SpaceID     uint   `json:"spaceId"`
	DisplayName string `json:"displayName"`
	TaskCount   int    `json:"taskCount"`
}

func (h *SyncHandler) Sync(c echo.Context) error {
	ctx := c.Request().Context()

	var spaces []model.BacklogSpace
	if err := h.db.Where("is_active = ?", true).Find(&spaces).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to fetch spaces",
		})
	}

	if len(spaces) == 0 {
		return c.JSON(http.StatusOK, syncResponse{TotalTasks: 0})
	}

	apiKeys := make(map[uint]string, len(spaces))
	for _, space := range spaces {
		apiKeys[space.ID] = space.ApiKeyRef
	}

	results := h.backlogClient.FetchAllSpaces(ctx, spaces, apiKeys)

	resp := syncResponse{}
	spaceMap := make(map[uint]model.BacklogSpace, len(spaces))
	for _, space := range spaces {
		spaceMap[space.ID] = space
	}

	for _, result := range results {
		if result.Err != nil {
			resp.Errors = append(resp.Errors, result.Err.Error())
			continue
		}

		for i := range result.Tasks {
			h.db.Where("issue_key = ?", result.Tasks[i].IssueKey).
				Assign(result.Tasks[i]).
				FirstOrCreate(&result.Tasks[i])
		}

		space := spaceMap[result.SpaceID]
		resp.Spaces = append(resp.Spaces, spaceResult{
			SpaceID:     result.SpaceID,
			DisplayName: space.DisplayName,
			TaskCount:   len(result.Tasks),
		})
		resp.TotalTasks += len(result.Tasks)
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *SyncHandler) GetTasks(c echo.Context) error {
	var tasks []model.Task
	if err := h.db.Preload(clause.Associations).Order("score DESC").Find(&tasks).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to fetch tasks",
		})
	}

	return c.JSON(http.StatusOK, tasks)
}
