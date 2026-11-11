import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import { io } from "socket.io-client";

import "leaflet/dist/leaflet.css";
import "./ResponderDashboard.css";

const API_URL = "http://localhost:5050";

const WARANGAL_CENTER = [17.968, 79.59];

// =====================================================
// MAP ICONS
// =====================================================

const emergencyIcon = L.divIcon({
  className: "custom-map-icon",
  html: `<div class="emergency-marker">🚨</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const shelterIcon = L.divIcon({
  className: "custom-map-icon",
  html: `<div class="shelter-marker">🏠</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// =====================================================
// HELPERS
// =====================================================

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getHazardColor(severity) {
  switch (severity) {
    case "critical":
      return "#dc2626";

    case "high":
      return "#ea580c";

    case "medium":
      return "#eab308";

    default:
      return "#84cc16";
  }
}

// ---- purely visual helpers (no data logic) ----------

const EMERGENCY_TYPE_META = {
  stranded: { icon: "🌊", label: "Stranded" },
  trapped: { icon: "🚪", label: "Trapped" },
  medical: { icon: "🏥", label: "Medical" },
  injury: { icon: "🩹", label: "Injury" },
  evacuation: { icon: "🚶", label: "Evacuation" },
  other: { icon: "🆘", label: "Other" },
};

function getTypeMeta(type) {
  return (
    EMERGENCY_TYPE_META[type] || {
      icon: "🆘",
      label: type ? String(type).replace(/_/g, " ") : "Emergency",
    }
  );
}

const STATUS_FLOW = ["new", "assigned", "rescued", "resolved"];

const STATUS_ACTIONS = {
  new: { next: "assigned", label: "🚑 Assign" },
  assigned: { next: "rescued", label: "🛟 Mark Rescued" },
  rescued: { next: "resolved", label: "✓ Resolve" },
};

const FACILITIES = [
  ["medical", "🏥", "Medical"],
  ["food", "🍱", "Food"],
  ["water", "💧", "Water"],
  ["electricity", "⚡", "Power"],
];

// =====================================================
// COMPONENT
// =====================================================

function ResponderDashboard() {
  const [emergencies, setEmergencies] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [hazards, setHazards] = useState([]);

  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);

  const [loading, setLoading] = useState(true);
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [error, setError] = useState("");

  const [showHazardForm, setShowHazardForm] = useState(false);
  const [hazardSubmitting, setHazardSubmitting] = useState(false);
  const [hazardMessage, setHazardMessage] = useState("");

  const [hazardForm, setHazardForm] = useState({
    latitude: "",
    longitude: "",
    hazardType: "flooded_road",
    severity: "medium",
    waterLevel: 0,
    roadBlocked: false,
    description: "",
    reportedBy: "Responder",
  });

  // ===================================================
  // FETCH ALL DATA
  // ===================================================

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [emergencyResponse, shelterResponse, hazardResponse] =
        await Promise.all([
          axios.get(`${API_URL}/api/emergencies`),
          axios.get(`${API_URL}/api/shelters`),
          axios.get(`${API_URL}/api/hazards`),
        ]);

      setEmergencies(emergencyResponse.data.emergencies || []);
      setShelters(shelterResponse.data.shelters || []);
      setHazards(hazardResponse.data.hazards || []);
    } catch (err) {
      console.error("DASHBOARD FETCH ERROR:", err);

      setError("Unable to load live emergency data.");
    } finally {
      setLoading(false);
    }
  };

  // ===================================================
  // INITIAL LOAD + SOCKET.IO
  // ===================================================

  useEffect(() => {
    let socket;

    const updateBrowserStatus = () => {
      setSocketStatus(navigator.onLine ? "reconnecting" : "offline");
    };

    const startSocket = () => {
      setSocketStatus(navigator.onLine ? "connecting" : "offline");

      socket = io(API_URL, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socket.on("connect", () => {
        console.log("Responder socket connected 🟢");
        setSocketStatus("connected");

        // Re-sync after connection/reconnection so no incidents are missed.
        fetchData();
      });

      socket.on("disconnect", (reason) => {
        console.log(
          "Responder socket disconnected 🔴:",
          reason
        );

        setSocketStatus(
          navigator.onLine ? "reconnecting" : "offline"
        );
      });

      socket.on("connect_error", (error) => {
        console.error(
          "Socket connection error:",
          error.message
        );

        setSocketStatus(
          navigator.onLine ? "reconnecting" : "offline"
        );
      });

      socket.on("newEmergency", (newEmergency) => {
        setEmergencies((current) => {
          // Prevent duplicate emergency cards.
          const alreadyExists = current.some(
            (emergency) =>
              emergency._id === newEmergency._id
          );

          if (alreadyExists) {
            return current;
          }

          return [newEmergency, ...current];
        });
      });

      socket.on("emergencyStatusUpdated", (updatedEmergency) => {
        setEmergencies((current) =>
          current.map((emergency) =>
            emergency._id === updatedEmergency._id
              ? updatedEmergency
              : emergency
          )
        );

        setSelectedEmergency((current) =>
          current?._id === updatedEmergency._id
            ? updatedEmergency
            : current
        );
      });
    };

    window.addEventListener("online", updateBrowserStatus);
    window.addEventListener("offline", updateBrowserStatus);

    startSocket();

    return () => {
      window.removeEventListener("online", updateBrowserStatus);
      window.removeEventListener("offline", updateBrowserStatus);

      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // ===================================================
  // HAZARD REPORTING
  // ===================================================

  const handleHazardChange = (event) => {
    const { name, value, type, checked } = event.target;

    setHazardForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const useMyLocationForHazard = () => {
    if (!navigator.geolocation) {
      setHazardMessage("Location is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setHazardForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));

        setHazardMessage("📍 Location captured.");
      },
      () => {
        setHazardMessage("Unable to access your location.");
      }
    );
  };

  const submitHazard = async (event) => {
    event.preventDefault();

    if (!hazardForm.latitude || !hazardForm.longitude) {
      setHazardMessage("Please provide the hazard location.");
      return;
    }

    try {
      setHazardSubmitting(true);
      setHazardMessage("");

      const response = await axios.post(`${API_URL}/api/hazards`, {
        location: {
          latitude: Number(hazardForm.latitude),
          longitude: Number(hazardForm.longitude),
        },
        hazardType: hazardForm.hazardType,
        severity: hazardForm.severity,
        waterLevel: Number(hazardForm.waterLevel),
        roadBlocked: hazardForm.roadBlocked,
        description: hazardForm.description,
        reportedBy: hazardForm.reportedBy || "Responder",
        active: true,
      });

      const createdHazard = response.data.hazard;

      setHazards((current) => [createdHazard, ...current]);

      setHazardMessage("🚧 Hazard reported successfully.");

      setHazardForm({
        latitude: "",
        longitude: "",
        hazardType: "flooded_road",
        severity: "medium",
        waterLevel: 0,
        roadBlocked: false,
        description: "",
        reportedBy: "Responder",
      });

      setTimeout(() => {
        setShowHazardForm(false);
        setHazardMessage("");
      }, 1200);
    } catch (err) {
      console.error("HAZARD REPORT ERROR:", err);
      setHazardMessage("❌ Failed to report hazard.");
    } finally {
      setHazardSubmitting(false);
    }
  };

  // ===================================================
  // STATISTICS
  // ===================================================

  const activeEmergencies = useMemo(() => {
    return emergencies.filter(
      (item) => item.status !== "resolved" && item.status !== "rescued"
    );
  }, [emergencies]);

  const criticalEmergencies = useMemo(() => {
    return emergencies.filter(
      (item) =>
        item.priority === "critical" &&
        item.status !== "resolved" &&
        item.status !== "rescued"
    );
  }, [emergencies]);

  const availableShelters = useMemo(() => {
    return shelters.filter(
      (shelter) =>
        shelter.status === "open" &&
        Number(shelter.availableSpaces) > 0
    );
  }, [shelters]);

  // ===================================================
  // NEARBY SHELTERS
  // ===================================================

  const getNearbyShelters = (emergency) => {
    if (!emergency?.location) {
      return [];
    }

    return [...shelters]
      .map((shelter) => {
        const distance = calculateDistance(
          emergency.location.latitude,
          emergency.location.longitude,
          shelter.location.latitude,
          shelter.location.longitude
        );

        return {
          ...shelter,
          distance,
        };
      })
      .sort((a, b) => a.distance - b.distance);
  };

  // ===================================================
  // UPDATE EMERGENCY STATUS
  // ===================================================

  const updateEmergencyStatus = async (emergencyId, status) => {
    try {
      const response = await axios.patch(
        `${API_URL}/api/emergencies/${emergencyId}/status`,
        {
          status,
        }
      );

      const updatedEmergency = response.data.emergency;

      setEmergencies((current) =>
        current.map((item) =>
          item._id === updatedEmergency._id ? updatedEmergency : item
        )
      );

      setSelectedEmergency(updatedEmergency);
    } catch (err) {
      console.error("STATUS UPDATE ERROR:", err);

      alert("Unable to update emergency status.");
    }
  };

  // ===================================================
  // HAZARD-AWARE EVACUATION ROUTE
  // ===================================================

  const showRoute = async (emergency, shelter) => {
    try {
      setRouteLoading(true);
      setRouteError("");

      const startLat = emergency.location.latitude;
      const startLng = emergency.location.longitude;

      const endLat = shelter.location.latitude;
      const endLng = shelter.location.longitude;

      const url =
        `${API_URL}/api/evacuation` +
        `?startLat=${startLat}` +
        `&startLng=${startLng}` +
        `&endLat=${endLat}` +
        `&endLng=${endLng}`;

      console.log("Calculating hazard-aware route:", url);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Evacuation route service unavailable");
      }

      const data = await response.json();

      if (!data.success || !data.recommendedRoute) {
        throw new Error(data.message || "No evacuation route found");
      }

      const route = data.recommendedRoute;

      const coordinates = route.coordinates.map(([lng, lat]) => [lat, lng]);

      setSelectedRoute({
        emergency,
        shelter,
        coordinates,
        distance: route.distanceKm,
        duration: route.durationMinutes,
        hazardScore: route.hazardScore,
        hazards: route.hazards || [],
        safetyStatus: data.safetyStatus,
        alternativeRoutes: data.alternativeRoutes || [],
        hazardsChecked: data.hazardsChecked || 0,
        message: data.message,
      });
    } catch (err) {
      console.error("HAZARD-AWARE ROUTE ERROR:", err);

      setRouteError("We couldn't calculate the evacuation route right now.");
    } finally {
      setRouteLoading(false);
    }
  };

  // ===================================================
  // START NAVIGATION
  // ===================================================

  const startNavigation = () => {
    if (!selectedRoute) {
      return;
    }

    const start = selectedRoute.emergency.location;

    const end = selectedRoute.shelter.location;

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${start.latitude},${start.longitude}` +
      `&destination=${end.latitude},${end.longitude}` +
      `&travelmode=driving`;

    window.open(url, "_blank");
  };

  // ===================================================
  // CLOSE ROUTE
  // ===================================================

  const closeRoute = () => {
    setSelectedRoute(null);
    setRouteError("");
  };

  // ===================================================
  // SCROLL TO ROUTE SECTION
  // ===================================================

  const openRoutesForEmergency = (emergency) => {
    setSelectedEmergency(emergency);

    setTimeout(() => {
      document.querySelector(".selected-emergency-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  };

  // ===================================================
  // VISUAL HELPERS (render only)
  // ===================================================

  // Primary status action — same handler + same status transitions
  // as before (new → assigned → rescued → resolved).
  const renderStatusAction = (emergency, extraClass = "") => {
    const action = STATUS_ACTIONS[emergency.status];

    if (!action) {
      return null;
    }

    return (
      <button
        type="button"
        className={`action-primary ${extraClass}`}
        onClick={(event) => {
          event.stopPropagation();

          updateEmergencyStatus(emergency._id, action.next);
        }}
      >
        {action.label}
      </button>
    );
  };

  const hazardMessageIsError =
    /fail|unable|not supported|please provide/i.test(hazardMessage);

  const routeHasBlockedRoad = selectedRoute?.hazards?.some(
    (hazard) => hazard.roadBlocked
  );

  const routeBlockedCount =
    selectedRoute?.hazards?.filter((hazard) => hazard.roadBlocked).length || 0;

  const selectedTypeMeta = selectedEmergency
    ? getTypeMeta(selectedEmergency.emergencyType)
    : null;

  const selectedStatusIndex = selectedEmergency
    ? STATUS_FLOW.indexOf(selectedEmergency.status)
    : -1;

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="responder-dashboard">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="responder-header">
        <div className="brand-area">
          <div className="brand-mark">🌊</div>

          <div>
            <h1>FloodLink</h1>

            <p>Responder Operations</p>
          </div>
        </div>

        <div className="header-right">
          <span className="role-chip">🚑 Responder view</span>

          <div
            className={`live-status socket-status socket-${socketStatus}`}
            role="status"
            aria-live="polite"
          >
            <span className="live-dot"></span>
            {socketStatus === "connected" && "Connected"}
            {socketStatus === "connecting" && "Connecting..."}
            {socketStatus === "reconnecting" && "Reconnecting..."}
            {socketStatus === "offline" && "Offline"}
          </div>
        </div>
      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="responder-main">
        {/* INTRO */}

        <section className="ops-intro">
          <p className="intro-eyebrow">Responder operations</p>

          <h2>Flood response overview</h2>

          <p>
            Review incoming requests, compare nearby shelters and check
            hazard-aware evacuation routes.
          </p>
        </section>

        {/* STATS */}

        <section className="stats-grid" aria-label="Operational summary">
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Active emergencies</span>
              <span className="stat-icon">🚨</span>
            </div>

            <strong className="stat-value">{activeEmergencies.length}</strong>

            <span className="stat-caption">Not yet rescued or resolved</span>
          </div>

          <div
            className={`stat-card critical ${
              criticalEmergencies.length > 0 ? "alert" : ""
            }`}
          >
            <div className="stat-top">
              <span className="stat-label">Critical</span>
              <span className="stat-icon">🔴</span>
            </div>

            <strong className="stat-value">{criticalEmergencies.length}</strong>

            <span className="stat-caption">Highest-priority requests</span>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Open shelters</span>
              <span className="stat-icon">🏠</span>
            </div>

            <strong className="stat-value">{availableShelters.length}</strong>

            <span className="stat-caption">
              Out of {shelters.length} shelter{shelters.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Active hazards</span>
              <span className="stat-icon">🚧</span>
            </div>

            <strong className="stat-value">{hazards.length}</strong>

            <span className="stat-caption">Reported on the map</span>
          </div>
        </section>

        {/* ERROR */}

        {error && <div className="dashboard-error">⚠️ {error}</div>}

        {/* =================================================
            OPERATIONS: LIST + MAP
        ================================================= */}

        <section className="operations-grid">
          {/* EMERGENCIES */}

          <div className="panel incidents-panel">
            <div className="panel-header">
              <div>
                <p className="panel-eyebrow">Live feed</p>

                <h2>Emergency Requests</h2>
              </div>

              <div className="panel-header-actions">
                <span className="count-chip">
                  {activeEmergencies.length} active
                </span>

                <button
                  className={`refresh-btn ${loading ? "is-loading" : ""}`}
                  onClick={fetchData}
                >
                  <span className="refresh-icon">↻</span> Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className="empty-state">
                <div className="loading-spinner small"></div>
                Loading emergency data...
              </div>
            ) : emergencies.length === 0 ? (
              <div className="empty-state">
                <span>🌊</span>

                <p>No emergency requests yet.</p>
              </div>
            ) : (
              <div className="incident-list">
                {emergencies.map((emergency) => {
                  const typeMeta = getTypeMeta(emergency.emergencyType);

                  return (
                    <div
                      key={emergency._id}
                      role="button"
                      tabIndex={0}
                      className={`incident-card ${emergency.priority} ${
                        selectedEmergency?._id === emergency._id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => setSelectedEmergency(emergency)}
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          setSelectedEmergency(emergency);
                        }
                      }}
                    >
                      <div className="incident-top">
                        <div className="incident-tags">
                          <span
                            className={`priority-badge ${emergency.priority}`}
                          >
                            <i></i>
                            {emergency.priority}
                          </span>

                          <span
                            className={`status-badge status-${emergency.status}`}
                          >
                            {emergency.status}
                          </span>
                        </div>

                        <span className="incident-type">
                          <span aria-hidden="true">{typeMeta.icon}</span>
                          {emergency.emergencyType}
                        </span>
                      </div>

                      <h3>
                        🚨 {emergency.peopleCount} people need help
                      </h3>

                      <div className="incident-details">
                        <div className="metric">
                          <strong>👶 {emergency.children}</strong>
                          <small>Children</small>
                        </div>

                        <div className="metric">
                          <strong>👴 {emergency.elderly}</strong>
                          <small>Elderly</small>
                        </div>

                        <div
                          className={`metric ${
                            Number(emergency.injured) > 0 ? "flag" : ""
                          }`}
                        >
                          <strong>🩹 {emergency.injured}</strong>
                          <small>Injured</small>
                        </div>

                        <div className="metric water">
                          <strong>🌊 {emergency.waterLevel}m</strong>
                          <small>Water</small>
                        </div>
                      </div>

                      {emergency.description && (
                        <p className="incident-description">
                          {emergency.description}
                        </p>
                      )}

                      <div className="incident-actions">
                        {renderStatusAction(emergency)}

                        {/* ROUTES BUTTON */}

                        <button
                          type="button"
                          className="route-action"
                          onClick={(event) => {
                            event.stopPropagation();

                            openRoutesForEmergency(emergency);
                          }}
                        >
                          🗺️ Routes
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* MAP */}

          <div className="panel map-panel">
            <div className="panel-header">
              <div>
                <p className="panel-eyebrow">Situational awareness</p>

                <h2>Live Emergency Map</h2>
              </div>

              <button
                className={`report-hazard-btn ${
                  showHazardForm ? "active" : ""
                }`}
                onClick={() => {
                  setShowHazardForm((current) => !current);
                  setHazardMessage("");
                }}
              >
                🚧 Report Hazard
              </button>
            </div>

            <div className="map-toolbar">
              <div className="map-legend">
                <span>
                  <i className="legend emergency"></i>
                  Emergency
                  <b>{emergencies.length}</b>
                </span>

                <span>
                  <i className="legend shelter"></i>
                  Shelter
                  <b>{shelters.length}</b>
                </span>

                <span>
                  <i className="legend hazard"></i>
                  Hazard
                  <b>{hazards.length}</b>
                </span>
              </div>

              {selectedRoute && (
                <span
                  className={`route-chip ${selectedRoute.safetyStatus || ""}`}
                >
                  <i></i>
                  Route to {selectedRoute.shelter.name}
                </span>
              )}
            </div>

            <div className="map-stage">
              {showHazardForm && (
                <div className="hazard-report-panel">
                  <div className="hazard-report-header">
                    <div>
                      <p className="panel-eyebrow">Field report</p>

                      <h3>Report a Flood Hazard</h3>
                    </div>

                    <button
                      className="hazard-close-btn"
                      type="button"
                      aria-label="Close hazard report"
                      onClick={() => setShowHazardForm(false)}
                    >
                      ×
                    </button>
                  </div>

                  <form className="hazard-form" onSubmit={submitHazard}>
                    <div className="hazard-section">
                      <p className="hazard-section-title">1. Where is it?</p>

                      <div className="hazard-form-grid">
                        <div className="hazard-field">
                          <label htmlFor="hz-latitude">Latitude</label>

                          <input
                            id="hz-latitude"
                            name="latitude"
                            type="number"
                            step="any"
                            value={hazardForm.latitude}
                            onChange={handleHazardChange}
                            placeholder="17.968000"
                            required
                          />
                        </div>

                        <div className="hazard-field">
                          <label htmlFor="hz-longitude">Longitude</label>

                          <input
                            id="hz-longitude"
                            name="longitude"
                            type="number"
                            step="any"
                            value={hazardForm.longitude}
                            onChange={handleHazardChange}
                            placeholder="79.590000"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        className="use-location-btn"
                        onClick={useMyLocationForHazard}
                      >
                        📍 Use My Current Location
                      </button>
                    </div>

                    <div className="hazard-section">
                      <p className="hazard-section-title">2. What is it?</p>

                      <div className="hazard-form-grid">
                        <div className="hazard-field">
                          <label htmlFor="hz-type">Hazard type</label>

                          <select
                            id="hz-type"
                            name="hazardType"
                            value={hazardForm.hazardType}
                            onChange={handleHazardChange}
                          >
                            <option value="flooded_road">Flooded road</option>
                            <option value="blocked_road">Blocked road</option>
                            <option value="bridge_flooded">
                              Flooded bridge
                            </option>
                            <option value="debris">Debris</option>
                            <option value="high_water">High water</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div className="hazard-field">
                          <label htmlFor="hz-severity">
                            Severity
                            <i
                              className={`sev-dot sev-${hazardForm.severity}`}
                            ></i>
                          </label>

                          <select
                            id="hz-severity"
                            name="severity"
                            value={hazardForm.severity}
                            onChange={handleHazardChange}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                      </div>

                      <div className="hazard-field">
                        <label htmlFor="hz-water">Water level (meters)</label>

                        <input
                          id="hz-water"
                          name="waterLevel"
                          type="number"
                          min="0"
                          step="0.1"
                          value={hazardForm.waterLevel}
                          onChange={handleHazardChange}
                        />
                      </div>

                      <label
                        className={`blocked-toggle ${
                          hazardForm.roadBlocked ? "on" : ""
                        }`}
                      >
                        <input
                          name="roadBlocked"
                          type="checkbox"
                          checked={hazardForm.roadBlocked}
                          onChange={handleHazardChange}
                        />

                        <span>🚫 Road is blocked</span>
                      </label>
                    </div>

                    <div className="hazard-section">
                      <p className="hazard-section-title">3. Details</p>

                      <div className="hazard-field">
                        <label htmlFor="hz-description">Description</label>

                        <textarea
                          id="hz-description"
                          name="description"
                          rows="3"
                          value={hazardForm.description}
                          onChange={handleHazardChange}
                          placeholder="Describe what responders need to know..."
                        />
                      </div>

                      <div className="hazard-field">
                        <label htmlFor="hz-reporter">Reported by</label>

                        <input
                          id="hz-reporter"
                          name="reportedBy"
                          value={hazardForm.reportedBy}
                          onChange={handleHazardChange}
                          placeholder="Responder name / team"
                        />
                      </div>
                    </div>

                    <div className="hazard-submit-row">
                      {hazardMessage && (
                        <div
                          className={`hazard-message ${
                            hazardMessageIsError ? "error" : "success"
                          }`}
                        >
                          {hazardMessage}
                        </div>
                      )}

                      <button
                        className="submit-hazard-btn"
                        type="submit"
                        disabled={hazardSubmitting}
                      >
                        {hazardSubmitting ? "Reporting..." : "🚧 REPORT HAZARD"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="map-wrapper">
                <MapContainer
                  center={WARANGAL_CENTER}
                  zoom={13}
                  scrollWheelZoom={true}
                  className="map"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* EMERGENCY MARKERS */}

                  {emergencies.map((emergency) => (
                    <Marker
                      key={emergency._id}
                      position={[
                        emergency.location.latitude,
                        emergency.location.longitude,
                      ]}
                      icon={emergencyIcon}
                      eventHandlers={{
                        click: () => openRoutesForEmergency(emergency),
                      }}
                    >
                      <Popup>
                        <strong>🚨 Emergency</strong>

                        <br />

                        Priority: {emergency.priority}

                        <br />

                        People: {emergency.peopleCount}

                        <br />

                        Status: {emergency.status}

                        <br />

                        {emergency.description}
                      </Popup>
                    </Marker>
                  ))}

                  {/* SHELTER MARKERS */}

                  {shelters.map((shelter) => (
                    <Marker
                      key={shelter._id}
                      position={[
                        shelter.location.latitude,
                        shelter.location.longitude,
                      ]}
                      icon={shelterIcon}
                    >
                      <Popup>
                        <strong>🏠 {shelter.name}</strong>

                        <br />

                        Capacity: {shelter.capacity}

                        <br />

                        Available: {shelter.availableSpaces}

                        <br />

                        Status: {shelter.status}
                      </Popup>
                    </Marker>
                  ))}

                  {/* HAZARD MARKERS */}

                  {hazards.map((hazard) => (
                    <CircleMarker
                      key={hazard._id}
                      center={[
                        hazard.location.latitude,
                        hazard.location.longitude,
                      ]}
                      radius={10}
                      pathOptions={{
                        color: getHazardColor(hazard.severity),

                        fillColor: getHazardColor(hazard.severity),

                        fillOpacity: 0.8,

                        weight: 3,
                      }}
                    >
                      <Popup>
                        <strong>🚧 Flood Hazard</strong>

                        <br />

                        Type: {hazard.hazardType.replace(/_/g, " ")}

                        <br />

                        Severity: {hazard.severity}

                        <br />

                        Water level: {hazard.waterLevel} m

                        <br />

                        {hazard.roadBlocked && <strong>🚫 Road Blocked</strong>}

                        {hazard.description && (
                          <>
                            <br />
                            {hazard.description}
                          </>
                        )}
                      </Popup>
                    </CircleMarker>
                  ))}

                  {/* SELECTED ROUTE */}

                  {selectedRoute && selectedRoute.coordinates?.length > 0 && (
                    <Polyline
                      positions={selectedRoute.coordinates}
                      pathOptions={{
                        color:
                          selectedRoute.safetyStatus === "high_risk"
                            ? "#dc2626"
                            : selectedRoute.safetyStatus === "hazards_detected"
                            ? "#f59e0b"
                            : "#0f766e",

                        weight: 6,

                        opacity: 0.9,
                      }}
                    />
                  )}
                </MapContainer>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            SELECTED EMERGENCY + SHELTERS
        ================================================= */}

        {selectedEmergency && (
          <section className="selected-emergency-section">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="panel-eyebrow">Selected incident</p>

                  <h2>Emergency Details</h2>
                </div>

                <button
                  className="close-selection"
                  aria-label="Close emergency details"
                  onClick={() => setSelectedEmergency(null)}
                >
                  ×
                </button>
              </div>

              <div className="selected-layout">
                {/* LEFT: INCIDENT */}

                <div className="selected-info">
                  {/* INCIDENT INFORMATION */}

                  <div className="detail-block">
                    <p className="block-title">Incident information</p>

                    <div className="selected-priority">
                      <span
                        className={`priority-badge ${selectedEmergency.priority}`}
                      >
                        <i></i>
                        {selectedEmergency.priority}
                      </span>

                      <span
                        className={`status-badge status-${selectedEmergency.status}`}
                      >
                        {selectedEmergency.status}
                      </span>

                      <span className="incident-type">
                        <span aria-hidden="true">{selectedTypeMeta.icon}</span>
                        {selectedEmergency.emergencyType}
                      </span>
                    </div>

                    <h3>🚨 {selectedEmergency.peopleCount} people affected</h3>

                    {selectedEmergency.location && (
                      <p className="coords">
                        📍 {selectedEmergency.location.latitude},{" "}
                        {selectedEmergency.location.longitude}
                      </p>
                    )}
                  </div>

                  {/* PEOPLE AFFECTED */}

                  <div className="detail-block">
                    <p className="block-title">People affected</p>

                    <div className="selected-stats">
                      <div>
                        <span>👥</span>

                        <strong>{selectedEmergency.peopleCount}</strong>

                        <small>Total</small>
                      </div>

                      <div>
                        <span>👶</span>

                        <strong>{selectedEmergency.children}</strong>

                        <small>Children</small>
                      </div>

                      <div>
                        <span>👴</span>

                        <strong>{selectedEmergency.elderly}</strong>

                        <small>Elderly</small>
                      </div>

                      <div
                        className={
                          Number(selectedEmergency.injured) > 0 ? "flag" : ""
                        }
                      >
                        <span>🩹</span>

                        <strong>{selectedEmergency.injured}</strong>

                        <small>Injured</small>
                      </div>
                    </div>
                  </div>

                  {/* EMERGENCY DETAILS */}

                  <div className="detail-block">
                    <p className="block-title">Emergency details</p>

                    <div className="detail-rows">
                      <div>
                        <span>Emergency type</span>

                        <strong>
                          {selectedTypeMeta.icon} {selectedTypeMeta.label}
                        </strong>
                      </div>

                      <div>
                        <span>Water level</span>

                        <strong>🌊 {selectedEmergency.waterLevel} m</strong>
                      </div>
                    </div>

                    {selectedEmergency.description && (
                      <div className="description-box">
                        <strong>Situation</strong>

                        <p>{selectedEmergency.description}</p>
                      </div>
                    )}
                  </div>

                  {/* ACTIONS */}

                  <div className="detail-block actions-block">
                    <p className="block-title">Actions</p>

                    <ol className="status-flow">
                      {STATUS_FLOW.map((step, index) => (
                        <li
                          key={step}
                          className={
                            index < selectedStatusIndex
                              ? "done"
                              : index === selectedStatusIndex
                              ? "current"
                              : ""
                          }
                        >
                          <i></i>
                          {step}
                        </li>
                      ))}
                    </ol>

                    <div className="selected-actions">
                      {renderStatusAction(selectedEmergency, "large")}

                      {!STATUS_ACTIONS[selectedEmergency.status] && (
                        <span className="no-action-note">
                          No further status action for this request.
                        </span>
                      )}
                    </div>

                    <p className="actions-hint">
                      Choose a shelter to calculate an evacuation route.
                    </p>
                  </div>
                </div>

                {/* RIGHT: NEARBY SHELTERS */}

                <div className="nearby-shelters">
                  <div className="shelter-section-title">
                    <div>
                      <p className="panel-eyebrow">Evacuation</p>

                      <h3>Nearby Shelters</h3>
                    </div>

                    <span className="count-chip">Nearest first</span>
                  </div>

                  <div className="shelter-list">
                    {getNearbyShelters(selectedEmergency).map(
                      (shelter, index) => {
                        const capacity = Number(shelter.capacity) || 0;

                        const available = Number(shelter.availableSpaces) || 0;

                        const availablePercent =
                          capacity > 0
                            ? Math.max(
                                0,
                                Math.min(100, (available / capacity) * 100)
                              )
                            : 0;

                        return (
                          <div
                            key={shelter._id}
                            className={`shelter-card ${shelter.status}`}
                          >
                            <div className="shelter-card-top">
                              <div>
                                <h4>🏠 {shelter.name}</h4>

                                <p>{shelter.address}</p>
                              </div>

                              <span
                                className={`shelter-status ${shelter.status}`}
                              >
                                {shelter.status}
                              </span>
                            </div>

                            <div className="shelter-meta">
                              <div>
                                <strong>{shelter.distance.toFixed(2)} km</strong>

                                <small>
                                  {index === 0 &&
                                  shelter.status === "open" &&
                                  Number(shelter.availableSpaces) > 0
                                    ? "Nearest"
                                    : "Distance"}
                                </small>
                              </div>

                              <div>
                                <strong>
                                  {shelter.availableSpaces}
                                  {capacity > 0 && (
                                    <em> / {capacity}</em>
                                  )}
                                </strong>

                                <small>Spaces available</small>
                              </div>
                            </div>

                            {capacity > 0 && (
                              <div
                                className="capacity-bar"
                                aria-hidden="true"
                              >
                                <span
                                  style={{ width: `${availablePercent}%` }}
                                ></span>
                              </div>
                            )}

                            <div className="facility-list">
                              {FACILITIES.map(([key, icon, label]) => (
                                <span
                                  key={key}
                                  className={
                                    shelter.facilities?.[key] ? "on" : "off"
                                  }
                                >
                                  {icon} {label}
                                </span>
                              ))}
                            </div>

                            {/* CALCULATE ROUTE */}

                            <button
                              className="route-btn"
                              disabled={
                                shelter.status !== "open" ||
                                Number(shelter.availableSpaces) <= 0 ||
                                routeLoading
                              }
                              onClick={() =>
                                showRoute(selectedEmergency, shelter)
                              }
                            >
                              🗺️{" "}
                              {routeLoading
                                ? "Calculating..."
                                : "Calculate Evacuation Route"}
                            </button>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* =================================================
          ROUTE LOADING
      ================================================= */}

      {routeLoading && (
        <div className="route-loading-overlay">
          <div className="route-loading-card">
            <div className="loading-spinner"></div>

            <h3>Calculating evacuation route</h3>

            <p>Checking active flood hazards along available roads...</p>
          </div>
        </div>
      )}

      {/* =================================================
          ROUTE ERROR
      ================================================= */}

      {routeError && (
        <div className="route-error-toast">
          <span>⚠️ {routeError}</span>

          <button aria-label="Dismiss" onClick={() => setRouteError("")}>
            ×
          </button>
        </div>
      )}

      {/* =================================================
          ROUTE DECISION-SUPPORT PANEL
      ================================================= */}

      {selectedRoute && (
        <div className="route-overlay">
          <aside
            className={`route-sheet ${selectedRoute.safetyStatus || ""}`}
            aria-label="Evacuation route assessment"
          >
            <div className="route-sheet-handle"></div>

            <div className="route-sheet-header">
              <div>
                <p className="panel-eyebrow">Evacuation route</p>

                <h2>{selectedRoute.shelter.name}</h2>
              </div>

              <button
                className="close-route"
                aria-label="Close route"
                onClick={closeRoute}
              >
                ×
              </button>
            </div>

            <div className="route-sheet-body">
              {/* FROM → TO */}

              <div className="route-path">
                <div className="route-stop">
                  <i className="stop-dot from"></i>

                  <div>
                    <small>From</small>

                    <strong>
                      {selectedRoute.emergency.peopleCount} people ·{" "}
                      {getTypeMeta(selectedRoute.emergency.emergencyType).label}
                    </strong>
                  </div>
                </div>

                <div className="route-stop">
                  <i className="stop-dot to"></i>

                  <div>
                    <small>To</small>

                    <strong>{selectedRoute.shelter.name}</strong>

                    <span>
                      {selectedRoute.shelter.availableSpaces} spaces available
                      {selectedRoute.shelter.address
                        ? ` · ${selectedRoute.shelter.address}`
                        : ""}
                    </span>
                  </div>
                </div>
              </div>

              {/* SAFETY STATUS */}

              <div className={`route-safety ${selectedRoute.safetyStatus}`}>
                {selectedRoute.safetyStatus === "clear" && (
                  <>
                    <span className="safety-icon">✓</span>

                    <div>
                      <strong>No active hazards detected</strong>

                      <p>
                        No reported hazards were found near this suggested
                        route.
                      </p>
                    </div>
                  </>
                )}

                {selectedRoute.safetyStatus === "hazards_detected" && (
                  <>
                    <span className="safety-icon">!</span>

                    <div>
                      <strong>Hazards detected</strong>

                      <p>
                        {selectedRoute.hazards?.length || 0} active hazard
                        {selectedRoute.hazards?.length !== 1 ? "s" : ""}{" "}
                        detected near this route.
                      </p>
                    </div>
                  </>
                )}

                {selectedRoute.safetyStatus === "high_risk" && (
                  <>
                    <span className="safety-icon">!</span>

                    <div>
                      <strong>HIGH RISK ROUTE</strong>

                      <p>
                        A blocked or critical hazard was detected near this
                        route. Review before evacuation.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* ROUTE SUMMARY */}

              <div className="route-summary">
                <div>
                  <span>📏</span>

                  <strong>{selectedRoute.distance} km</strong>

                  <small>Distance</small>
                </div>

                <div>
                  <span>⏱️</span>

                  <strong>{selectedRoute.duration} min</strong>

                  <small>Estimated</small>
                </div>

                <div className="score">
                  <span>⚠️</span>

                  <strong>{selectedRoute.hazardScore}</strong>

                  <small>Hazard score</small>
                </div>

                <div>
                  <span>🚧</span>

                  <strong>{selectedRoute.hazards?.length || 0}</strong>

                  <small>Hazards</small>
                </div>
              </div>

              {/* ROAD BLOCKED + CHECKED */}

              <div className="route-facts">
                <div className={routeHasBlockedRoad ? "warn" : ""}>
                  <span>🚫 Road blocked</span>

                  <strong>
                    {routeHasBlockedRoad
                      ? `Reported (${routeBlockedCount})`
                      : "None reported"}
                  </strong>
                </div>

                <div>
                  <span>📋 Hazard reports checked</span>

                  <strong>{selectedRoute.hazardsChecked}</strong>
                </div>
              </div>

              {/* DETECTED HAZARDS */}

              {selectedRoute.hazards?.length > 0 && (
                <div className="route-hazards">
                  <h4>Detected hazards</h4>

                  {selectedRoute.hazards.map((hazard) => (
                    <div
                      className={`route-hazard sev-${hazard.severity}`}
                      key={hazard.hazardId}
                    >
                      <div className="route-hazard-top">
                        <strong>
                          🚧 {hazard.hazardType.replace(/_/g, " ")}
                        </strong>

                        <span className={`severity-tag sev-${hazard.severity}`}>
                          {hazard.severity}
                        </span>
                      </div>

                      <p>Water level: {hazard.waterLevel} m</p>

                      {hazard.roadBlocked && (
                        <p className="blocked">🚫 Road blocked</p>
                      )}

                      <small>{hazard.distanceFromRoute} km from route</small>
                    </div>
                  ))}
                </div>
              )}

              {/* ALTERNATIVE ROUTES */}

              {selectedRoute.alternativeRoutes?.length > 0 && (
                <div className="alternative-routes">
                  <h4>Alternative routes</h4>

                  {selectedRoute.alternativeRoutes.map((route, index) => (
                    <div key={index} className="alternative-route-card">
                      <div>
                        <strong>Alternative {index + 1}</strong>

                        <span>
                          {route.distanceKm} km · {route.durationMinutes} min
                        </span>
                      </div>

                      <span
                        className={`alt-score ${
                          Number(route.hazardScore) <
                          Number(selectedRoute.hazardScore)
                            ? "lower"
                            : ""
                        }`}
                      >
                        Hazard score: {route.hazardScore}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* DISCLAIMER */}

              <div className="route-disclaimer">
                ⚠️ This route uses active FloodLink hazard reports as
                decision-support data. Conditions can change rapidly.
                Responders should verify road conditions before evacuation.
              </div>
            </div>

            {/* NAVIGATION */}

            <div className="route-sheet-footer">
              <button className="start-navigation-btn" onClick={startNavigation}>
                🧭 Start Navigation
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default ResponderDashboard;
