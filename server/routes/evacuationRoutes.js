const express = require("express");

const FloodHazard =
  require("../models/FloodHazard");

const router = express.Router();

// =====================================================
// HAVERSINE DISTANCE
// =====================================================

function distanceBetweenPoints(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      (lat1 * Math.PI) / 180
    ) *
      Math.cos(
        (lat2 * Math.PI) / 180
      ) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    R *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

// =====================================================
// POINT TO SEGMENT DISTANCE
// Approximation suitable for local city routes
// =====================================================

function distanceToSegment(
  pointLat,
  pointLng,
  lat1,
  lng1,
  lat2,
  lng2
) {
  const cosLat =
    Math.cos(
      (pointLat * Math.PI) / 180
    );

  const x =
    (pointLng - lng1) *
    cosLat;

  const y =
    pointLat - lat1;

  const x2 =
    (lng2 - lng1) *
    cosLat;

  const y2 =
    lat2 - lat1;

  const dx = x2;
  const dy = y2;

  const lengthSquared =
    dx * dx + dy * dy;

  let t = 0;

  if (lengthSquared !== 0) {
    t =
      (x * dx + y * dy) /
      lengthSquared;
  }

  t = Math.max(
    0,
    Math.min(1, t)
  );

  const closestX =
    dx * t;

  const closestY =
    dy * t;

  const closestLng =
    lng1 +
    closestX / cosLat;

  const closestLat =
    lat1 + closestY;

  return distanceBetweenPoints(
    pointLat,
    pointLng,
    closestLat,
    closestLng
  );
}

// =====================================================
// DISTANCE FROM HAZARD TO ROUTE
// =====================================================

function hazardDistanceToRoute(
  hazard,
  coordinates
) {
  let minimumDistance =
    Infinity;

  for (
    let i = 0;
    i < coordinates.length - 1;
    i++
  ) {
    const [lng1, lat1] =
      coordinates[i];

    const [lng2, lat2] =
      coordinates[i + 1];

    const distance =
      distanceToSegment(
        hazard.location.latitude,
        hazard.location.longitude,
        lat1,
        lng1,
        lat2,
        lng2
      );

    if (
      distance <
      minimumDistance
    ) {
      minimumDistance =
        distance;
    }
  }

  return minimumDistance;
}

// =====================================================
// HAZARD SCORE
// =====================================================

function calculateHazardScore(
  routeCoordinates,
  hazards
) {
  let score = 0;

  const encounteredHazards = [];

  for (const hazard of hazards) {
    const distance =
      hazardDistanceToRoute(
        hazard,
        routeCoordinates
      );

    // Only consider hazards
    // within approximately 150m
    // of the route.

    if (distance <= 0.15) {
      let penalty = 0;

      if (
        hazard.severity ===
        "low"
      ) {
        penalty = 10;
      }

      if (
        hazard.severity ===
        "medium"
      ) {
        penalty = 30;
      }

      if (
        hazard.severity ===
        "high"
      ) {
        penalty = 70;
      }

      if (
        hazard.severity ===
        "critical"
      ) {
        penalty = 150;
      }

      if (
        hazard.roadBlocked
      ) {
        penalty += 200;
      }

      score += penalty;

      encounteredHazards.push({
        hazardId:
          hazard._id,

        hazardType:
          hazard.hazardType,

        severity:
          hazard.severity,

        waterLevel:
          hazard.waterLevel,

        roadBlocked:
          hazard.roadBlocked,

        distanceFromRoute:
          Number(
            distance.toFixed(3)
          ),

        description:
          hazard.description,
      });
    }
  }

  return {
    score,

    hazards:
      encounteredHazards,
  };
}

// =====================================================
// GET EVACUATION ROUTE
// =====================================================

router.get("/", async (req, res) => {
  try {
    const {
      startLat,
      startLng,
      endLat,
      endLng,
    } = req.query;

    if (
      !startLat ||
      !startLng ||
      !endLat ||
      !endLng
    ) {
      return res.status(400).json({
        success: false,

        message:
          "startLat, startLng, endLat and endLng are required",
      });
    }

    const startLatitude =
      Number(startLat);

    const startLongitude =
      Number(startLng);

    const endLatitude =
      Number(endLat);

    const endLongitude =
      Number(endLng);

    // =================================================
    // GET ACTIVE HAZARDS
    // =================================================

    const hazards =
      await FloodHazard.find({
        active: true,
      });

    // =================================================
    // OSRM
    // =================================================

    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${startLongitude},${startLatitude};` +
      `${endLongitude},${endLatitude}` +
      `?alternatives=true` +
      `&overview=full` +
      `&geometries=geojson`;

    const osrmResponse =
      await fetch(osrmUrl);

    if (!osrmResponse.ok) {
      throw new Error(
        "Routing service unavailable"
      );
    }

    const routeData =
      await osrmResponse.json();

    if (
      routeData.code !== "Ok" ||
      !routeData.routes?.length
    ) {
      return res.status(404).json({
        success: false,

        message:
          "No road route found",
      });
    }

    // =================================================
    // SCORE EVERY ROUTE
    // =================================================

    const scoredRoutes =
      routeData.routes.map(
        (route, index) => {
          const coordinates =
            route.geometry.coordinates;

          const safety =
            calculateHazardScore(
              coordinates,
              hazards
            );

          return {
            routeIndex: index,

            distanceKm:
              Number(
                (
                  route.distance /
                  1000
                ).toFixed(2)
              ),

            durationMinutes:
              Number(
                (
                  route.duration /
                  60
                ).toFixed(1)
              ),

            hazardScore:
              safety.score,

            hazards:
              safety.hazards,

            coordinates,
          };
        }
      );

    // =================================================
    // SORT BY HAZARD SCORE
    // =================================================

    scoredRoutes.sort(
      (a, b) =>
        a.hazardScore -
        b.hazardScore
    );

    const recommendedRoute =
      scoredRoutes[0];

    // =================================================
    // SAFETY STATUS
    // =================================================

    let safetyStatus =
      "clear";

    if (
      recommendedRoute.hazardScore >
      0
    ) {
      safetyStatus =
        "hazards_detected";
    }

    if (
      recommendedRoute.hazards.some(
        (hazard) =>
          hazard.roadBlocked ||
          hazard.severity ===
            "critical"
      )
    ) {
      safetyStatus =
        "high_risk";
    }

    // =================================================
    // RESPONSE
    // =================================================

    res.json({
      success: true,

      safetyStatus,

      recommendedRoute,

      alternativeRoutes:
        scoredRoutes.slice(1),

      hazardsChecked:
        hazards.length,

      message:
        safetyStatus ===
        "clear"
          ? "No active hazards detected near the suggested route."
          : "Hazards were detected near one or more route options. Review the route before evacuation.",
    });
  } catch (error) {
    console.error(
      "EVACUATION ROUTE ERROR:",
      error
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to calculate evacuation route",

      error: error.message,
    });
  }
});

module.exports = router;