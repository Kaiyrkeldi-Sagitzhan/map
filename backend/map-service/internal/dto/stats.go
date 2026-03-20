package dto

// TypeStat represents stats for a single object type
type TypeStat struct {
	Type     string     `json:"type"`
	Count    int        `json:"count"`
	Centroid *[]float64 `json:"centroid,omitempty"`
}

// StatsResponse represents the stats response
type StatsResponse struct {
	Stats []TypeStat `json:"stats"`
	Total int        `json:"total"`
}
