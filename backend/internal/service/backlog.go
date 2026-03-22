package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/KimMaru10/PeelTask/backend/internal/model"
)

const (
	backlogAPITimeout = 30 * time.Second
	issuesPerPage     = 100
)

type BacklogClient struct {
	httpClient *http.Client
}

func NewBacklogClient() *BacklogClient {
	return &BacklogClient{
		httpClient: &http.Client{
			Timeout: backlogAPITimeout,
		},
	}
}

type backlogIssue struct {
	ID        int    `json:"id"`
	IssueKey  string `json:"issueKey"`
	Summary   string `json:"summary"`
	Priority  struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"priority"`
	EstimatedHours *float64 `json:"estimatedHours"`
	DueDate        *string  `json:"dueDate"`
	Status         struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"status"`
	Milestone []struct {
		ID      int     `json:"id"`
		Name    string  `json:"name"`
		Date    *string `json:"date"`
	} `json:"milestone"`
	Description string `json:"description"`
}

func (c *BacklogClient) FetchIssues(ctx context.Context, space model.BacklogSpace, apiKey string) ([]model.Task, error) {
	url := fmt.Sprintf("https://%s/api/v2/issues?apiKey=%s&count=%d&statusId[]=1&statusId[]=2&statusId[]=3",
		space.Domain, apiKey, issuesPerPage)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("backlog request create: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("backlog request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("backlog auth failed for space %s: invalid API key", space.Domain)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("backlog API error for space %s: status %d", space.Domain, resp.StatusCode)
	}

	var issues []backlogIssue
	if err := json.NewDecoder(resp.Body).Decode(&issues); err != nil {
		return nil, fmt.Errorf("backlog response decode: %w", err)
	}

	tasks := make([]model.Task, 0, len(issues))
	for _, issue := range issues {
		task := model.Task{
			IssueKey:       issue.IssueKey,
			Title:          issue.Summary,
			Description:    issue.Description,
			Priority:       mapPriority(issue.Priority.ID),
			EstimatedHours: derefFloat(issue.EstimatedHours),
			Status:         issue.Status.Name,
			SpaceID:        space.ID,
			SyncedAt:       time.Now(),
		}

		if issue.DueDate != nil {
			if t, err := time.Parse("2006-01-02T15:04:05Z", *issue.DueDate); err == nil {
				task.DueDate = &t
			}
		}

		if len(issue.Milestone) > 0 && issue.Milestone[0].Date != nil {
			task.MilestoneID = fmt.Sprintf("%d", issue.Milestone[0].ID)
			if t, err := time.Parse("2006-01-02T15:04:05Z", *issue.Milestone[0].Date); err == nil {
				task.MilestoneDueDate = &t
			}
		}

		tasks = append(tasks, task)
	}

	return tasks, nil
}

type SyncResult struct {
	SpaceID uint
	Tasks   []model.Task
	Err     error
}

func (c *BacklogClient) FetchAllSpaces(ctx context.Context, spaces []model.BacklogSpace, apiKeys map[uint]string) []SyncResult {
	results := make([]SyncResult, len(spaces))
	var wg sync.WaitGroup

	for i, space := range spaces {
		wg.Add(1)
		go func(idx int, sp model.BacklogSpace) {
			defer wg.Done()

			apiKey, ok := apiKeys[sp.ID]
			if !ok {
				results[idx] = SyncResult{SpaceID: sp.ID, Err: fmt.Errorf("API key not found for space %s", sp.Domain)}
				return
			}

			tasks, err := c.FetchIssues(ctx, sp, apiKey)
			results[idx] = SyncResult{SpaceID: sp.ID, Tasks: tasks, Err: err}
		}(i, space)
	}

	wg.Wait()
	return results
}

func mapPriority(id int) string {
	switch id {
	case 2:
		return "高"
	case 3:
		return "中"
	case 4:
		return "低"
	default:
		return "中"
	}
}

func derefFloat(f *float64) float64 {
	if f == nil {
		return 0
	}
	return *f
}
