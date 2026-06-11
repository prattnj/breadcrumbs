# breadcrumbs
Analytics based on Google Maps Timeline data.

# Timeline.json Documentation

## Overview

`data/Timeline.json` is a Google Maps Timeline export (101.5 MB) containing location history from **2014-09-23** to **2026-05-18**. It has three top-level sections.

---

## Top-Level Structure

```json
{
  "semanticSegments": [...],   // 66,805 items - processed location history
  "rawSignals": [...],         // 55,890 items - raw sensor data
  "userLocationProfile": {...} // User profile with frequent places/trips
}
```

---

## 1. `semanticSegments` (66,805 items)

The main timeline data. Each segment represents a time period classified as one of three types: a **visit** (stationary at a place), an **activity** (moving between places), or a **timelinePath** (raw movement points without classification).

### Common Attributes (all segments)

| Attribute | Type | Description |
|-----------|------|-------------|
| `startTime` | ISO 8601 string | When the segment begins (with timezone offset) |
| `endTime` | ISO 8601 string | When the segment ends (with timezone offset) |
| `startTimeTimezoneUtcOffsetMinutes` | integer | UTC offset in minutes at start (e.g., -420 = UTC-7). Present on visit/activity segments. |
| `endTimeTimezoneUtcOffsetMinutes` | integer | UTC offset in minutes at end. Present on visit/activity segments. |

### Segment Type: `visit` (24,017 segments)

Represents time spent stationary at a place.

| Attribute | Type | Description |
|-----------|------|-------------|
| `visit.hierarchyLevel` | integer (0 or 1) | Nesting level; 0 = top-level visit, 1 = sub-visit within a larger stay |
| `visit.probability` | float (0–1) | Confidence that this is actually a visit |
| `visit.topCandidate.placeId` | string | Google Maps Place ID for the location |
| `visit.topCandidate.semanticType` | string | Category of place. Values: `HOME`, `WORK`, `INFERRED_HOME`, `INFERRED_WORK`, `SEARCHED_ADDRESS`, `UNKNOWN` |
| `visit.topCandidate.probability` | float (0–1) | Confidence this is the correct place |
| `visit.topCandidate.placeLocation.latLng` | string | Coordinates in "lat°, lng°" format |

### Segment Type: `activity` (21,312 segments)

Represents movement/travel between two points.

| Attribute | Type | Description |
|-----------|------|-------------|
| `activity.start.latLng` | string | Starting coordinates in "lat°, lng°" format |
| `activity.end.latLng` | string | Ending coordinates in "lat°, lng°" format |
| `activity.distanceMeters` | float | Total distance traveled in meters |
| `activity.probability` | float (0–1) | Confidence that this activity occurred (not always present) |
| `activity.topCandidate.type` | string | Transportation mode. Values: `WALKING`, `IN_PASSENGER_VEHICLE`, `CYCLING`, `RUNNING`, `IN_BUS`, `IN_TRAIN`, `IN_SUBWAY`, `IN_TRAM`, `IN_FERRY`, `IN_VEHICLE`, `FLYING`, `BOATING`, `SAILING`, `SKIING`, `MOTORCYCLING`, `UNKNOWN_ACTIVITY_TYPE` |
| `activity.topCandidate.probability` | float (0–1) | Confidence in the transportation mode classification |
| `activity.parking` | object (optional) | Present when vehicle was parked at destination |
| `activity.parking.location.latLng` | string | Where the vehicle was parked |
| `activity.parking.startTime` | ISO 8601 string | When parking began |

### Segment Type: `timelinePath` (21,263 segments)

Raw GPS breadcrumb points during a time window. These often overlap with visit/activity segments, providing the underlying location data.

| Attribute | Type | Description |
|-----------|------|-------------|
| `timelinePath` | array | List of point objects |
| `timelinePath[].point` | string | Coordinates in "lat°, lng°" format |
| `timelinePath[].time` | ISO 8601 string | Timestamp of the observation |

### Segment Attribute: `timelineMemory` (213 segments)

Attached to segments representing notable trips away from home.

| Attribute | Type | Description |
|-----------|------|-------------|
| `timelineMemory.trip.distanceFromOriginKms` | integer | Distance from home in kilometers |
| `timelineMemory.trip.destinations` | array | List of destination place objects |
| `timelineMemory.trip.destinations[].identifier.placeId` | string | Google Maps Place ID of the destination |

---

## 2. `rawSignals` (55,890 items)

Raw sensor readings from the device. Each item contains exactly one of three signal types:

### Signal Type: `position` (GPS/WiFi/Cell readings)

| Attribute | Type | Description |
|-----------|------|-------------|
| `position.LatLng` | string | Coordinates in "lat°, lng°" format |
| `position.accuracyMeters` | integer | Estimated accuracy radius in meters |
| `position.altitudeMeters` | float | Altitude above sea level |
| `position.source` | string | How position was determined. Values: `GPS`, `WIFI`, `WIFI_ONLY`, `CELL`, `UNKNOWN` |
| `position.timestamp` | ISO 8601 string | When the reading was taken |
| `position.speedMetersPerSecond` | float | Speed at time of reading |

### Signal Type: `activityRecord` (device motion sensor)

| Attribute | Type | Description |
|-----------|------|-------------|
| `activityRecord.timestamp` | ISO 8601 string | When the reading was taken |
| `activityRecord.probableActivities` | array | List of detected activities with confidence |
| `activityRecord.probableActivities[].type` | string | Activity type. Values: `STILL`, `WALKING`, `RUNNING`, `ON_FOOT`, `ON_BICYCLE`, `IN_VEHICLE`, `IN_ROAD_VEHICLE`, `IN_RAIL_VEHICLE`, `TILTING`, `EXITING_VEHICLE`, `UNKNOWN` |
| `activityRecord.probableActivities[].confidence` | float (0–1) | Confidence score for this activity |

### Signal Type: `wifiScan`

| Attribute | Type | Description |
|-----------|------|-------------|
| `wifiScan.deliveryTime` | ISO 8601 string | When the WiFi scan was performed |

---

## 3. `userLocationProfile`

Aggregated user behavior profile with three sub-sections:

### `frequentPlaces` (array)

| Attribute | Type | Description |
|-----------|------|-------------|
| `placeId` | string | Google Maps Place ID |
| `placeLocation` | string | Coordinates in "lat°, lng°" format |
| `label` | string (optional) | `HOME` or `WORK` if identified as such |

### `frequentTrips` (7 items)

| Attribute | Type | Description |
|-----------|------|-------------|
| `waypointIds` | array of strings | Ordered Place IDs along the route |
| `modeDistribution` | array | Transportation modes used and their rates |
| `modeDistribution[].mode` | string | Transportation type (e.g., `IN_PASSENGER_VEHICLE`, `WALKING`) |
| `modeDistribution[].rate` | float (0–1) | How often this mode is used for this trip |
| `startTimeMinutes` | integer | Typical start time (minutes from midnight) |
| `endTimeMinutes` | integer | Typical end time (minutes from midnight) |
| `durationMinutes` | integer | Typical trip duration |
| `confidence` | float (0–1) | Confidence in this trip pattern |
| `commuteDirection` | string | Direction label, e.g., `COMMUTE_DIRECTION_HOME_TO_WORK` |

### `persona`

| Attribute | Type | Description |
|-----------|------|-------------|
| `travelModeAffinities` | array | User's transportation preferences |
| `travelModeAffinities[].mode` | string | Transportation type |
| `travelModeAffinities[].affinity` | float (0–1) | How often this mode is used overall |

---

## Key Statistics

- **Date range**: Sept 2014 – May 2026 (~12 years)
- **Total semantic segments**: 66,805
- **Visits**: 24,017 | **Activities**: 21,312 | **Timeline paths**: 21,263
- **Notable trips (timelineMemory)**: 213
- **Raw signal readings**: 55,890
- **Frequent places tracked**: multiple | **Frequent trips**: 7

---

## MySQL Schema

### Design Decisions

- **Segments** use a single base table with type-specific child tables (table-per-subtype pattern) to avoid NULLs and allow clean joins.
- **Coordinates** stored as `DECIMAL(10,7)` (lat) and `DECIMAL(11,7)` (lng) for ~1cm precision.
- **Timestamps** stored as `DATETIME(3)` to preserve millisecond precision from the source data.
- **Place IDs** are stored in a shared `places` lookup table referenced by visits, memories, frequent places, and trips — avoiding duplication of the same placeId string across thousands of rows.
- **Indexes** on timestamp columns for range queries and foreign keys for joins.

### CREATE TABLE Statements

```sql
-- ============================================================
-- PLACES (shared lookup table)
-- ============================================================

CREATE TABLE places (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    google_place_id VARCHAR(255) NOT NULL,
    lat DECIMAL(10, 7) NULL,
    lng DECIMAL(11, 7) NULL,
    UNIQUE KEY uq_google_place_id (google_place_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SEMANTIC SEGMENTS (base table)
-- ============================================================

CREATE TABLE semantic_segments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    segment_type ENUM('visit', 'activity', 'timeline_path') NOT NULL,
    start_time DATETIME(3) NOT NULL,
    end_time DATETIME(3) NOT NULL,
    start_tz_offset_minutes SMALLINT NULL,
    end_tz_offset_minutes SMALLINT NULL,
    INDEX idx_start_time (start_time),
    INDEX idx_end_time (end_time),
    INDEX idx_segment_type (segment_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- VISITS
-- ============================================================

CREATE TABLE segment_visits (
    segment_id BIGINT UNSIGNED PRIMARY KEY,
    hierarchy_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
    probability FLOAT NOT NULL,
    place_id INT UNSIGNED NOT NULL,
    semantic_type ENUM('HOME', 'WORK', 'INFERRED_HOME', 'INFERRED_WORK', 'SEARCHED_ADDRESS', 'UNKNOWN') NOT NULL,
    place_probability FLOAT NOT NULL,
    CONSTRAINT fk_visit_segment FOREIGN KEY (segment_id) REFERENCES semantic_segments(id) ON DELETE CASCADE,
    CONSTRAINT fk_visit_place FOREIGN KEY (place_id) REFERENCES places(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ACTIVITIES
-- ============================================================

CREATE TABLE segment_activities (
    segment_id BIGINT UNSIGNED PRIMARY KEY,
    start_lat DECIMAL(10, 7) NOT NULL,
    start_lng DECIMAL(11, 7) NOT NULL,
    end_lat DECIMAL(10, 7) NOT NULL,
    end_lng DECIMAL(11, 7) NOT NULL,
    distance_meters FLOAT NULL,
    probability FLOAT NULL,
    activity_type ENUM(
        'WALKING', 'RUNNING', 'CYCLING', 'MOTORCYCLING',
        'IN_PASSENGER_VEHICLE', 'IN_BUS', 'IN_TRAIN',
        'IN_SUBWAY', 'IN_TRAM', 'IN_FERRY', 'IN_VEHICLE',
        'FLYING', 'BOATING', 'SAILING', 'SKIING',
        'UNKNOWN_ACTIVITY_TYPE'
    ) NOT NULL,
    activity_type_probability FLOAT NOT NULL,
    parking_lat DECIMAL(10, 7) NULL,
    parking_lng DECIMAL(11, 7) NULL,
    parking_start_time DATETIME(3) NULL,
    CONSTRAINT fk_activity_segment FOREIGN KEY (segment_id) REFERENCES semantic_segments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TIMELINE PATHS (breadcrumb points)
-- ============================================================

CREATE TABLE segment_timeline_paths (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    segment_id BIGINT UNSIGNED NOT NULL,
    lat DECIMAL(10, 7) NOT NULL,
    lng DECIMAL(11, 7) NOT NULL,
    recorded_at DATETIME(3) NOT NULL,
    CONSTRAINT fk_path_segment FOREIGN KEY (segment_id) REFERENCES semantic_segments(id) ON DELETE CASCADE,
    INDEX idx_path_segment (segment_id),
    INDEX idx_path_time (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TIMELINE MEMORIES (notable trips)
-- ============================================================

CREATE TABLE segment_memories (
    segment_id BIGINT UNSIGNED PRIMARY KEY,
    distance_from_origin_kms INT UNSIGNED NOT NULL,
    CONSTRAINT fk_memory_segment FOREIGN KEY (segment_id) REFERENCES semantic_segments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE segment_memory_destinations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    segment_id BIGINT UNSIGNED NOT NULL,
    place_id INT UNSIGNED NOT NULL,
    CONSTRAINT fk_memdest_segment FOREIGN KEY (segment_id) REFERENCES segment_memories(segment_id) ON DELETE CASCADE,
    CONSTRAINT fk_memdest_place FOREIGN KEY (place_id) REFERENCES places(id),
    INDEX idx_memdest_segment (segment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- RAW SIGNALS: POSITIONS
-- ============================================================

CREATE TABLE raw_positions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lat DECIMAL(10, 7) NOT NULL,
    lng DECIMAL(11, 7) NOT NULL,
    accuracy_meters INT UNSIGNED NULL,
    altitude_meters FLOAT NULL,
    source ENUM('GPS', 'WIFI', 'WIFI_ONLY', 'CELL', 'UNKNOWN') NOT NULL,
    speed_mps FLOAT NULL,
    recorded_at DATETIME(3) NOT NULL,
    INDEX idx_pos_time (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- RAW SIGNALS: ACTIVITY RECORDS
-- ============================================================

CREATE TABLE raw_activity_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recorded_at DATETIME(3) NOT NULL,
    INDEX idx_actrec_time (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE raw_activity_record_entries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    activity_record_id BIGINT UNSIGNED NOT NULL,
    activity_type ENUM(
        'STILL', 'WALKING', 'RUNNING', 'ON_FOOT', 'ON_BICYCLE',
        'IN_VEHICLE', 'IN_ROAD_VEHICLE', 'IN_RAIL_VEHICLE',
        'TILTING', 'EXITING_VEHICLE', 'UNKNOWN'
    ) NOT NULL,
    confidence FLOAT NOT NULL,
    CONSTRAINT fk_actentry_record FOREIGN KEY (activity_record_id) REFERENCES raw_activity_records(id) ON DELETE CASCADE,
    INDEX idx_actentry_record (activity_record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- RAW SIGNALS: WIFI SCANS
-- ============================================================

CREATE TABLE raw_wifi_scans (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    delivery_time DATETIME(3) NOT NULL,
    INDEX idx_wifi_time (delivery_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- USER LOCATION PROFILE: FREQUENT PLACES
-- ============================================================

CREATE TABLE frequent_places (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    place_id INT UNSIGNED NOT NULL,
    label ENUM('HOME', 'WORK') NULL,
    CONSTRAINT fk_freqplace_place FOREIGN KEY (place_id) REFERENCES places(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- USER LOCATION PROFILE: FREQUENT TRIPS
-- ============================================================

CREATE TABLE frequent_trips (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    start_time_minutes SMALLINT UNSIGNED NOT NULL,
    end_time_minutes SMALLINT UNSIGNED NOT NULL,
    duration_minutes SMALLINT UNSIGNED NOT NULL,
    confidence FLOAT NOT NULL,
    commute_direction VARCHAR(100) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE frequent_trip_waypoints (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id INT UNSIGNED NOT NULL,
    sequence_order TINYINT UNSIGNED NOT NULL,
    place_id INT UNSIGNED NOT NULL,
    CONSTRAINT fk_tripwp_trip FOREIGN KEY (trip_id) REFERENCES frequent_trips(id) ON DELETE CASCADE,
    CONSTRAINT fk_tripwp_place FOREIGN KEY (place_id) REFERENCES places(id),
    INDEX idx_tripwp_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE frequent_trip_modes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id INT UNSIGNED NOT NULL,
    mode VARCHAR(50) NOT NULL,
    rate FLOAT NOT NULL,
    CONSTRAINT fk_tripmode_trip FOREIGN KEY (trip_id) REFERENCES frequent_trips(id) ON DELETE CASCADE,
    INDEX idx_tripmode_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- USER LOCATION PROFILE: PERSONA
-- ============================================================

CREATE TABLE persona_travel_affinities (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    mode VARCHAR(50) NOT NULL,
    affinity FLOAT NOT NULL,
    UNIQUE KEY uq_mode (mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- GRID SUBDIVISIONS (reverse-geocoded location cells)
-- ============================================================

CREATE TABLE grid_subdivisions (
    grid_lat DECIMAL(5, 2) NOT NULL,
    grid_lng DECIMAL(6, 2) NOT NULL,
    subdivision VARCHAR(255) NOT NULL,
    PRIMARY KEY (grid_lat, grid_lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

