package service

import (
	"math"
	"time"

	"github.com/KimMaru10/PeelTask/backend/internal/model"
)

const (
	weightDeadline   = 0.5
	weightPriority   = 0.3
	weightEffort     = 0.1
	weightMilestone  = 0.1

	milestoneDaysThreshold = 7
	minRemainingDays       = 0.5
	minEstimatedHours      = 1.0
)

func CalcDeadlineUrgency(dueDate *time.Time, now time.Time) float64 {
	if dueDate == nil {
		return 0.0
	}
	remainingDays := dueDate.Sub(now).Hours() / 24.0
	return 1.0 / math.Max(remainingDays, minRemainingDays)
}

func CalcPriorityScore(priority string) float64 {
	switch priority {
	case "高":
		return 1.0
	case "中":
		return 0.6
	case "低":
		return 0.3
	default:
		return 0.6
	}
}

func CalcEffortPenalty(estimatedHours float64) float64 {
	return 1.0 / math.Max(estimatedHours, minEstimatedHours)
}

func CalcMilestoneProximity(milestoneDueDate *time.Time, now time.Time) float64 {
	if milestoneDueDate == nil {
		return 0.0
	}
	remainingDays := milestoneDueDate.Sub(now).Hours() / 24.0
	if remainingDays <= float64(milestoneDaysThreshold) && remainingDays >= 0 {
		return 1.0
	}
	return 0.0
}

func CalcScore(task model.Task, now time.Time) float64 {
	deadline := CalcDeadlineUrgency(task.DueDate, now)
	priority := CalcPriorityScore(task.Priority)
	effort := CalcEffortPenalty(task.EstimatedHours)
	milestone := CalcMilestoneProximity(task.MilestoneDueDate, now)

	return deadline*weightDeadline +
		priority*weightPriority +
		effort*weightEffort +
		milestone*weightMilestone
}

func ScoreAllTasks(tasks []model.Task, now time.Time) []model.Task {
	for i := range tasks {
		tasks[i].Score = CalcScore(tasks[i], now)
	}
	return tasks
}
