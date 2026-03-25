package service

import (
	"sort"
	"time"

	"github.com/KimMaru10/PeelTask/backend/internal/model"
)

const dailyWorkHours = 8.0

func GenerateSchedule(tasks []model.Task, startDate time.Time) ([]model.Schedule, error) {
	scored := ScoreAllTasks(tasks, startDate)

	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})

	var schedules []model.Schedule
	currentDate := normalizeDate(startDate)
	var currentSchedule *model.Schedule
	orderIndex := 0

	for _, task := range scored {
		hours := task.EstimatedHours
		if hours <= 0 {
			hours = 1.0
		}

		for hours > 0 {
			if currentSchedule == nil || currentSchedule.AllocatedHours >= dailyWorkHours {
				if currentSchedule != nil {
					schedules = append(schedules, *currentSchedule)
				}
				currentSchedule = &model.Schedule{
					Date:           currentDate,
					TotalHours:     dailyWorkHours,
					AllocatedHours: 0,
				}
				orderIndex = 0
				currentDate = currentDate.AddDate(0, 0, 1)
			}

			available := dailyWorkHours - currentSchedule.AllocatedHours
			allocate := hours
			if allocate > available {
				allocate = available
			}

			slotStart := currentSchedule.Date.Add(
				time.Duration(currentSchedule.AllocatedHours * float64(time.Hour)),
			)
			slotEnd := slotStart.Add(
				time.Duration(allocate * float64(time.Hour)),
			)

			slot := model.ScheduleSlot{
				TaskID:     task.ID,
				StartAt:    slotStart,
				EndAt:      slotEnd,
				OrderIndex: orderIndex,
				Task:       task,
			}

			currentSchedule.Slots = append(currentSchedule.Slots, slot)
			currentSchedule.AllocatedHours += allocate
			orderIndex++
			hours -= allocate
		}
	}

	if currentSchedule != nil {
		schedules = append(schedules, *currentSchedule)
	}

	return schedules, nil
}

func normalizeDate(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}
