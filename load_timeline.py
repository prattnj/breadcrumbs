"""
Load data from data/Timeline.json into the breadcrumbs MySQL database.

Supports incremental loading: if the database already contains data, only
segments/signals newer than the latest existing record will be inserted.

Usage:
    python load_timeline.py

Environment variables:
    BREADCRUMBS_MYSQL_USER     - MySQL username
    BREADCRUMBS_MYSQL_PASSWORD - MySQL password
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from decimal import Decimal

import mysql.connector
from mysql.connector import Error


def get_connection():
    """Create a MySQL connection using environment variables."""
    user = os.environ.get("BREADCRUMBS_MYSQL_USER")
    password = os.environ.get("BREADCRUMBS_MYSQL_PASSWORD")
    if not user or not password:
        print("Error: BREADCRUMBS_MYSQL_USER and BREADCRUMBS_MYSQL_PASSWORD must be set.")
        sys.exit(1)
    return mysql.connector.connect(
        host="localhost",
        database="breadcrumbs",
        user=user,
        password=password,
        autocommit=False,
    )


def parse_latlng(s):
    """Parse '33.351523°, -111.8055838°' into (Decimal, Decimal)."""
    parts = s.replace("°", "").split(",")
    return Decimal(parts[0].strip()), Decimal(parts[1].strip())


def parse_time(s):
    """Parse ISO 8601 string to UTC datetime."""
    dt = datetime.fromisoformat(s)
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def format_datetime(dt):
    """Format datetime for MySQL DATETIME(3)."""
    return dt.strftime("%Y-%m-%d %H:%M:%S.") + f"{dt.microsecond // 1000:03d}"


def get_or_create_place(cursor, place_cache, google_place_id, lat=None, lng=None):
    """Get place ID from cache or insert into places table."""
    if google_place_id in place_cache:
        return place_cache[google_place_id]

    cursor.execute(
        "SELECT id FROM places WHERE google_place_id = %s", (google_place_id,)
    )
    row = cursor.fetchone()
    if row:
        place_cache[google_place_id] = row[0]
        return row[0]

    cursor.execute(
        "INSERT INTO places (google_place_id, lat, lng) VALUES (%s, %s, %s)",
        (google_place_id, lat, lng),
    )
    pid = cursor.lastrowid
    place_cache[google_place_id] = pid
    return pid


def load_semantic_segments(cursor, segments, cutoff_time, place_cache):
    """Load semantic segments into the database."""
    inserted = 0
    batch_size = 1000
    segment_batch = []

    for seg in segments:
        start_time = parse_time(seg["startTime"])
        end_time = parse_time(seg["endTime"])

        # Skip segments already in the database
        if cutoff_time and start_time <= cutoff_time:
            continue

        start_tz = seg.get("startTimeTimezoneUtcOffsetMinutes")
        end_tz = seg.get("endTimeTimezoneUtcOffsetMinutes")

        if "visit" in seg:
            seg_type = "visit"
        elif "activity" in seg:
            seg_type = "activity"
        elif "timelinePath" in seg:
            seg_type = "timeline_path"
        else:
            continue

        segment_batch.append((seg, seg_type, start_time, end_time, start_tz, end_tz))

        if len(segment_batch) >= batch_size:
            inserted += _flush_segments(cursor, segment_batch, place_cache)
            segment_batch = []

    if segment_batch:
        inserted += _flush_segments(cursor, segment_batch, place_cache)

    return inserted


def _flush_segments(cursor, batch, place_cache):
    """Insert a batch of segments and their type-specific data."""
    count = 0
    for seg, seg_type, start_time, end_time, start_tz, end_tz in batch:
        cursor.execute(
            """INSERT INTO semantic_segments
               (segment_type, start_time, end_time, start_tz_offset_minutes, end_tz_offset_minutes)
               VALUES (%s, %s, %s, %s, %s)""",
            (seg_type, format_datetime(start_time), format_datetime(end_time), start_tz, end_tz),
        )
        segment_id = cursor.lastrowid

        if seg_type == "visit":
            _insert_visit(cursor, segment_id, seg["visit"], place_cache)
        elif seg_type == "activity":
            _insert_activity(cursor, segment_id, seg["activity"])
        elif seg_type == "timeline_path":
            _insert_timeline_path(cursor, segment_id, seg["timelinePath"])

        # Handle timelineMemory if present
        if "timelineMemory" in seg:
            _insert_memory(cursor, segment_id, seg["timelineMemory"], place_cache)

        count += 1
    return count


def _insert_visit(cursor, segment_id, visit, place_cache):
    """Insert visit data."""
    hierarchy_level = visit.get("hierarchyLevel", 0)
    probability = visit.get("probability", 0.0)
    top = visit.get("topCandidate", {})
    google_place_id = top.get("placeId", "UNKNOWN")
    semantic_type = top.get("semanticType", "UNKNOWN")
    place_probability = top.get("probability", 0.0)

    lat, lng = None, None
    place_loc = top.get("placeLocation", {}).get("latLng")
    if place_loc:
        lat, lng = parse_latlng(place_loc)

    place_id = get_or_create_place(cursor, place_cache, google_place_id, lat, lng)

    cursor.execute(
        """INSERT INTO segment_visits
           (segment_id, hierarchy_level, probability, place_id, semantic_type, place_probability)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (segment_id, hierarchy_level, probability, place_id, semantic_type, place_probability),
    )


def _insert_activity(cursor, segment_id, activity):
    """Insert activity data."""
    start_latlng = activity.get("start", {}).get("latLng")
    end_latlng = activity.get("end", {}).get("latLng")

    if not start_latlng or not end_latlng:
        # Skip activities without coordinates
        return

    start_lat, start_lng = parse_latlng(start_latlng)
    end_lat, end_lng = parse_latlng(end_latlng)

    distance = activity.get("distanceMeters")
    probability = activity.get("probability")
    top = activity.get("topCandidate", {})
    activity_type = top.get("type", "UNKNOWN_ACTIVITY_TYPE")
    activity_type_prob = top.get("probability", 0.0)

    parking_lat, parking_lng, parking_time = None, None, None
    parking = activity.get("parking")
    if parking:
        ploc = parking.get("location", {}).get("latLng")
        if ploc:
            parking_lat, parking_lng = parse_latlng(ploc)
        ptime = parking.get("startTime")
        if ptime:
            parking_time = format_datetime(parse_time(ptime))

    cursor.execute(
        """INSERT INTO segment_activities
           (segment_id, start_lat, start_lng, end_lat, end_lng,
            distance_meters, probability, activity_type,
            activity_type_probability, parking_lat, parking_lng, parking_start_time)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            segment_id, start_lat, start_lng, end_lat, end_lng,
            distance, probability, activity_type,
            activity_type_prob, parking_lat, parking_lng, parking_time,
        ),
    )


def _insert_timeline_path(cursor, segment_id, path_points):
    """Insert timeline path points."""
    rows = []
    for point in path_points:
        lat, lng = parse_latlng(point["point"])
        recorded_at = format_datetime(parse_time(point["time"]))
        rows.append((segment_id, lat, lng, recorded_at))

    if rows:
        cursor.executemany(
            """INSERT INTO segment_timeline_paths
               (segment_id, lat, lng, recorded_at) VALUES (%s, %s, %s, %s)""",
            rows,
        )


def _insert_memory(cursor, segment_id, memory, place_cache):
    """Insert timeline memory (notable trip) data."""
    trip = memory.get("trip", {})
    distance_kms = trip.get("distanceFromOriginKms", 0)

    cursor.execute(
        "INSERT INTO segment_memories (segment_id, distance_from_origin_kms) VALUES (%s, %s)",
        (segment_id, distance_kms),
    )

    destinations = trip.get("destinations", [])
    for dest in destinations:
        google_place_id = dest.get("identifier", {}).get("placeId")
        if google_place_id:
            place_id = get_or_create_place(cursor, place_cache, google_place_id)
            cursor.execute(
                "INSERT INTO segment_memory_destinations (segment_id, place_id) VALUES (%s, %s)",
                (segment_id, place_id),
            )


def load_raw_signals(cursor, signals, cutoff_time):
    """Load raw signals into the database."""
    pos_count = 0
    act_count = 0
    wifi_count = 0

    for signal in signals:
        if "position" in signal:
            pos = signal["position"]
            recorded_at = parse_time(pos["timestamp"])
            if cutoff_time and recorded_at <= cutoff_time:
                continue
            lat, lng = parse_latlng(pos["LatLng"])
            cursor.execute(
                """INSERT INTO raw_positions
                   (lat, lng, accuracy_meters, altitude_meters, source, speed_mps, recorded_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (
                    lat, lng,
                    pos.get("accuracyMeters"),
                    pos.get("altitudeMeters"),
                    pos.get("source", "UNKNOWN"),
                    pos.get("speedMetersPerSecond"),
                    format_datetime(recorded_at),
                ),
            )
            pos_count += 1

        elif "activityRecord" in signal:
            rec = signal["activityRecord"]
            recorded_at = parse_time(rec["timestamp"])
            if cutoff_time and recorded_at <= cutoff_time:
                continue
            cursor.execute(
                "INSERT INTO raw_activity_records (recorded_at) VALUES (%s)",
                (format_datetime(recorded_at),),
            )
            record_id = cursor.lastrowid
            entries = rec.get("probableActivities", [])
            if entries:
                cursor.executemany(
                    """INSERT INTO raw_activity_record_entries
                       (activity_record_id, activity_type, confidence)
                       VALUES (%s, %s, %s)""",
                    [(record_id, e["type"], e["confidence"]) for e in entries],
                )
            act_count += 1

        elif "wifiScan" in signal:
            scan = signal["wifiScan"]
            delivery_time = parse_time(scan["deliveryTime"])
            if cutoff_time and delivery_time <= cutoff_time:
                continue
            cursor.execute(
                "INSERT INTO raw_wifi_scans (delivery_time) VALUES (%s)",
                (format_datetime(delivery_time),),
            )
            wifi_count += 1

    return pos_count, act_count, wifi_count


def load_user_profile(cursor, profile, place_cache):
    """Load user location profile data."""
    # Frequent places
    freq_places = profile.get("frequentPlaces", [])
    for fp in freq_places:
        google_place_id = fp.get("placeId")
        if not google_place_id:
            continue
        lat, lng = None, None
        if "placeLocation" in fp:
            lat, lng = parse_latlng(fp["placeLocation"])
        place_id = get_or_create_place(cursor, place_cache, google_place_id, lat, lng)
        label = fp.get("label")  # HOME or WORK or None
        cursor.execute(
            "INSERT INTO frequent_places (place_id, label) VALUES (%s, %s)",
            (place_id, label),
        )

    # Frequent trips
    freq_trips = profile.get("frequentTrips", [])
    for trip in freq_trips:
        cursor.execute(
            """INSERT INTO frequent_trips
               (start_time_minutes, end_time_minutes, duration_minutes, confidence, commute_direction)
               VALUES (%s, %s, %s, %s, %s)""",
            (
                trip.get("startTimeMinutes", 0),
                trip.get("endTimeMinutes", 0),
                trip.get("durationMinutes", 0),
                trip.get("confidence", 0.0),
                trip.get("commuteDirection"),
            ),
        )
        trip_id = cursor.lastrowid

        # Waypoints
        waypoints = trip.get("waypointIds", [])
        for seq, wp_place_id_str in enumerate(waypoints):
            place_id = get_or_create_place(cursor, place_cache, wp_place_id_str)
            cursor.execute(
                """INSERT INTO frequent_trip_waypoints
                   (trip_id, sequence_order, place_id) VALUES (%s, %s, %s)""",
                (trip_id, seq, place_id),
            )

        # Mode distribution
        modes = trip.get("modeDistribution", [])
        for mode in modes:
            cursor.execute(
                """INSERT INTO frequent_trip_modes
                   (trip_id, mode, rate) VALUES (%s, %s, %s)""",
                (trip_id, mode["mode"], mode["rate"]),
            )

    # Persona travel affinities
    persona = profile.get("persona", {})
    affinities = persona.get("travelModeAffinities", [])
    for aff in affinities:
        cursor.execute(
            """INSERT INTO persona_travel_affinities (mode, affinity)
               VALUES (%s, %s)
               ON DUPLICATE KEY UPDATE affinity = VALUES(affinity)""",
            (aff["mode"], aff["affinity"]),
        )


def get_cutoff_times(cursor):
    """Get the latest timestamps already in the DB for incremental loading."""
    cursor.execute("SELECT MAX(start_time) FROM semantic_segments")
    row = cursor.fetchone()
    segment_cutoff = row[0] if row and row[0] else None
    # Ensure it's a datetime object
    if segment_cutoff and isinstance(segment_cutoff, str):
        segment_cutoff = datetime.fromisoformat(segment_cutoff)

    # Get the latest raw signal timestamp
    signal_cutoff = None
    for query in [
        "SELECT MAX(recorded_at) FROM raw_positions",
        "SELECT MAX(recorded_at) FROM raw_activity_records",
        "SELECT MAX(delivery_time) FROM raw_wifi_scans",
    ]:
        cursor.execute(query)
        row = cursor.fetchone()
        if row and row[0]:
            val = row[0]
            if isinstance(val, str):
                val = datetime.fromisoformat(val)
            if signal_cutoff is None or val > signal_cutoff:
                signal_cutoff = val

    return segment_cutoff, signal_cutoff


def reverse_geocode(lat, lng):
    """Reverse geocode coordinates to get subdivision name via Nominatim."""
    url = (
        f"https://nominatim.openstreetmap.org/reverse"
        f"?lat={lat}&lon={lng}&format=json&zoom=5&addressdetails=1"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Breadcrumbs-Personal/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
        print(f"  ERROR for ({lat}, {lng}): {e}")
        return "Unknown"

    addr = data.get("address", {})
    subdivision = (
        addr.get("state")
        or addr.get("province")
        or addr.get("region")
        or addr.get("county")
        or "Unknown"
    )
    country = addr.get("country", "Unknown")

    if subdivision == "Unknown":
        return "Unknown"
    return f"{subdivision}, {country}"


def load_subdivisions(cursor):
    """
    Compute unique grid cells from the hourly location snapshots,
    then geocode any cells not already in grid_subdivisions.

    This matches the original behavior: only cells that appear in the
    hourly interpolated data (the same data the UI uses) get geocoded.
    """
    # Get unique grid cells from hourly location data
    # The hourly data comes from the same logic as the server:
    # timeline_path points, visit locations, activity start/end points.
    # We approximate by rounding all known coordinates to 0.01 degree.
    print("  Collecting unique grid cells from location data...")
    cursor.execute("""
        SELECT DISTINCT ROUND(lat, 2) AS grid_lat, ROUND(lng, 2) AS grid_lng
        FROM (
            SELECT lat, lng FROM segment_timeline_paths
            UNION ALL
            SELECT p.lat, p.lng FROM segment_visits sv JOIN places p ON p.id = sv.place_id WHERE p.lat IS NOT NULL
            UNION ALL
            SELECT start_lat AS lat, start_lng AS lng FROM segment_activities
            UNION ALL
            SELECT end_lat AS lat, end_lng AS lng FROM segment_activities
        ) all_coords
    """)
    all_cells = set()
    for row in cursor.fetchall():
        all_cells.add((float(row[0]), float(row[1])))

    print(f"  {len(all_cells)} unique grid cells found")

    # Get cells already geocoded
    cursor.execute("SELECT grid_lat, grid_lng FROM grid_subdivisions")
    existing_cells = set()
    for row in cursor.fetchall():
        existing_cells.add((float(row[0]), float(row[1])))

    to_fetch = [cell for cell in all_cells if cell not in existing_cells]
    print(f"  {len(to_fetch)} cells need geocoding")

    if not to_fetch:
        return

    for i, (lat, lng) in enumerate(to_fetch):
        print(f"  [{i+1}/{len(to_fetch)}] ({lat}, {lng}) ...", end=" ", flush=True)
        subdivision = reverse_geocode(lat, lng)
        print(subdivision)

        cursor.execute(
            """INSERT INTO grid_subdivisions (grid_lat, grid_lng, subdivision)
               VALUES (%s, %s, %s)
               ON DUPLICATE KEY UPDATE subdivision = VALUES(subdivision)""",
            (Decimal(str(lat)), Decimal(str(lng)), subdivision),
        )

        # Commit every 20 lookups in case of interruption
        if (i + 1) % 20 == 0:
            cursor._connection.commit()

        # Nominatim rate limit: 1 request per second
        time.sleep(1.1)

    cursor._connection.commit()


def main():
    print("Loading data/Timeline.json...")
    with open("data/Timeline.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Determine cutoff for incremental loading
        segment_cutoff, signal_cutoff = get_cutoff_times(cursor)

        if segment_cutoff:
            print(f"Incremental mode: segments after {segment_cutoff}")
        else:
            print("Full load mode: database is empty")

        place_cache = {}

        # Load existing places into cache
        cursor.execute("SELECT id, google_place_id FROM places")
        for row in cursor.fetchall():
            place_cache[row[1]] = row[0]

        # Load semantic segments
        print("Loading semantic segments...")
        segments = data.get("semanticSegments", [])
        seg_count = load_semantic_segments(cursor, segments, segment_cutoff, place_cache)
        print(f"  Inserted {seg_count} segments")

        # Load raw signals
        print("Loading raw signals...")
        signals = data.get("rawSignals", [])
        pos, act, wifi = load_raw_signals(cursor, signals, signal_cutoff)
        print(f"  Inserted {pos} positions, {act} activity records, {wifi} wifi scans")

        # Load user profile (only on first load)
        if not segment_cutoff:
            print("Loading user profile...")
            profile = data.get("userLocationProfile", {})
            load_user_profile(cursor, profile, place_cache)
            print("  Done")

        conn.commit()
        print(f"\nSuccess! Total places in cache: {len(place_cache)}")

        # Load subdivision geocoding data
        print("\nUpdating subdivision geocoding...")
        load_subdivisions(cursor)
        conn.commit()
        print("Subdivision geocoding complete.")

    except Error as e:
        conn.rollback()
        print(f"Database error: {e}")
        sys.exit(1)
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
