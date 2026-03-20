package geometry

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
)

var (
	ErrInvalidGeometry = errors.New("invalid geometry")
	ErrInvalidGeoJSON = errors.New("invalid GeoJSON")
)

// Geometry represents a PostGIS geometry
type Geometry struct {
	SRID     int             `json:"srid"`
	Type     string          `json:"type"`
	Coords   json.RawMessage `json:"coordinates"`
}

// Point represents a GeoJSON Point
type Point struct {
	Type        string    `json:"type" binding:"required"`
	Coordinates []float64 `json:"coordinates" binding:"required,len=2"`
}

// LineString represents a GeoJSON LineString
type LineString struct {
	Type        string      `json:"type" binding:"required"`
	Coordinates [][]float64 `json:"coordinates" binding:"required"`
}

// Polygon represents a GeoJSON Polygon
type Polygon struct {
	Type        string        `json:"type" binding:"required"`
	Coordinates [][][]float64 `json:"coordinates" binding:"required"`
}

// MultiPoint represents a GeoJSON MultiPoint
type MultiPoint struct {
	Type        string      `json:"type" binding:"required"`
	Coordinates [][]float64 `json:"coordinates" binding:"required"`
}

// MultiLineString represents a GeoJSON MultiLineString
type MultiLineString struct {
	Type        string        `json:"type" binding:"required"`
	Coordinates [][][]float64 `json:"coordinates" binding:"required"`
}

// MultiPolygon represents a GeoJSON MultiPolygon
type MultiPolygon struct {
	Type        string          `json:"type" binding:"required"`
	Coordinates [][][][]float64 `json:"coordinates" binding:"required"`
}

// Feature represents a GeoJSON Feature
type Feature struct {
	Type       string          `json:"type" binding:"required"`
	Geometry   json.RawMessage `json:"geometry" binding:"required"`
	Properties json.RawMessage `json:"properties"`
}

// FeatureCollection represents a GeoJSON FeatureCollection
type FeatureCollection struct {
	Type     string    `json:"type" binding:"required"`
	Features []Feature `json:"features" binding:"required"`
}

// ValidateGeometryType checks if the geometry type is valid
func ValidateGeometryType(geomType string) bool {
	validTypes := map[string]bool{
		"Point":           true,
		"LineString":      true,
		"Polygon":         true,
		"MultiPoint":      true,
		"MultiLineString": true,
		"MultiPolygon":    true,
	}
	return validTypes[geomType]
}

// ParseGeoJSON parses GeoJSON into PostGIS geometry
func ParseGeoJSON(geoJSON json.RawMessage) (string, error) {
	if len(geoJSON) == 0 {
		return "", ErrInvalidGeoJSON
	}

	// Try to parse as Feature or FeatureCollection first
	var feature Feature
	if err := json.Unmarshal(geoJSON, &feature); err == nil {
		if feature.Type == "Feature" {
			geoJSON = feature.Geometry
		}
	}

	var featureCollection FeatureCollection
	if err := json.Unmarshal(geoJSON, &featureCollection); err == nil {
		if featureCollection.Type == "FeatureCollection" && len(featureCollection.Features) > 0 {
			geoJSON = featureCollection.Features[0].Geometry
		}
	}

	var basicGeom struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(geoJSON, &basicGeom); err != nil {
		return "", ErrInvalidGeoJSON
	}

	if !ValidateGeometryType(basicGeom.Type) {
		return "", fmt.Errorf("%w: %s", ErrInvalidGeometry, basicGeom.Type)
	}

	// Use ST_GeomFromGeoJSON to convert GeoJSON to PostGIS geometry
	return fmt.Sprintf("ST_GeomFromGeoJSON('%s')", geoJSON), nil
}

// ToGeoJSON converts PostGIS geometry to GeoJSON
func ToGeoJSON(geometry string) (json.RawMessage, error) {
	// This will be handled in the repository layer using ST_AsGeoJSON
	return json.RawMessage(geometry), nil
}

// ParseGeometryType parses the GeoJSON type
func ParseGeometryType(geoJSON json.RawMessage) (string, error) {
	// First, try to parse as a Feature (what Leaflet Draw produces)
	var feature struct {
		Type     string          `json:"type"`
		Geometry json.RawMessage `json:"geometry"`
	}
	if err := json.Unmarshal(geoJSON, &feature); err == nil {
		log.Printf("[DEBUG] Parsed top-level type: %s", feature.Type)
		if feature.Type == "Feature" && len(feature.Geometry) > 0 {
			// Feature has nested geometry, parse that
			var nestedGeom struct {
				Type string `json:"type"`
			}
			if err := json.Unmarshal(feature.Geometry, &nestedGeom); err == nil {
				log.Printf("[DEBUG] Found nested geometry type: %s", nestedGeom.Type)
				return nestedGeom.Type, nil
			}
		}
	}

	// Try to parse as FeatureCollection
	var featureCollection struct {
		Type     string          `json:"type"`
		Features json.RawMessage `json:"features"`
	}
	if err := json.Unmarshal(geoJSON, &featureCollection); err == nil {
		if featureCollection.Type == "FeatureCollection" && len(featureCollection.Features) > 0 {
			// Get geometry from first feature
			var firstFeature struct {
				Geometry json.RawMessage `json:"geometry"`
			}
			if err := json.Unmarshal(featureCollection.Features, &firstFeature); err == nil {
				var nestedGeom struct {
					Type string `json:"type"`
				}
				if err := json.Unmarshal(firstFeature.Geometry, &nestedGeom); err == nil {
					return nestedGeom.Type, nil
				}
			}
		}
	}

	// Fall back to direct parse for Point, LineString, Polygon
	var geom struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(geoJSON, &geom); err != nil {
		return "", err
	}
	return geom.Type, nil
}

// ConvertToPostGIS converts GeoJSON to PostGIS geometry using pq.Array
func ConvertToPostGIS(geoJSON json.RawMessage) (interface{}, error) {
	return string(geoJSON), nil
}

// ParseCoordinates parses coordinates based on geometry type
func ParseCoordinates(geoJSON json.RawMessage, geomType string) (interface{}, error) {
	switch geomType {
	case "Point":
		var point Point
		if err := json.Unmarshal(geoJSON, &point); err != nil {
			return nil, err
		}
		return point.Coordinates, nil
	case "LineString":
		var line LineString
		if err := json.Unmarshal(geoJSON, &line); err != nil {
			return nil, err
		}
		return line.Coordinates, nil
	case "Polygon":
		var polygon Polygon
		if err := json.Unmarshal(geoJSON, &polygon); err != nil {
			return nil, err
		}
		return polygon.Coordinates, nil
	case "MultiPoint":
		var mp MultiPoint
		if err := json.Unmarshal(geoJSON, &mp); err != nil {
			return nil, err
		}
		return mp.Coordinates, nil
	case "MultiLineString":
		var ml MultiLineString
		if err := json.Unmarshal(geoJSON, &ml); err != nil {
			return nil, err
		}
		return ml.Coordinates, nil
	case "MultiPolygon":
		var mp MultiPolygon
		if err := json.Unmarshal(geoJSON, &mp); err != nil {
			return nil, err
		}
		return mp.Coordinates, nil
	default:
		return nil, fmt.Errorf("%w: %s", ErrInvalidGeometry, geomType)
	}
}

// NullGeometry represents a nullable geometry for SQL
type NullGeometry struct {
	Geometry interface{}
	Valid    bool
}

// Scan implements the sql.Scanner interface
func (ng *NullGeometry) Scan(value interface{}) error {
	if value == nil {
		ng.Valid = false
		return nil
	}
	ng.Geometry = value
	ng.Valid = true
	return nil
}

// Value implements the driver.Valuer interface
func (ng NullGeometry) Value() (driverValue interface{}, err error) {
	if !ng.Valid {
		return nil, nil
	}
	return ng.Geometry, nil
}

// This is needed for pq.Array to work
func (ng NullGeometry) DriverValue() (interface{}, error) {
	if !ng.Valid {
		return nil, nil
	}
	return ng.Geometry, nil
}
