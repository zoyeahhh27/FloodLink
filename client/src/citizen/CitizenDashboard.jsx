import { useState } from "react";
import axios from "axios";
import "./CitizenDashboard.css";

const API_URL = "http://localhost:5050";

const initialForm = {
  latitude: "",
  longitude: "",
  peopleCount: 1,
  children: 0,
  elderly: 0,
  injured: 0,
  waterLevel: 0,
  emergencyType: "stranded",
  description: "",
};

function CitizenDashboard() {
  const [form, setForm] = useState(initialForm);
  const [locationLoading, setLocationLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const useCurrentLocation = () => {
    setLocationMessage("");
    setError("");

    if (!navigator.geolocation) {
      setError(
        "Location services are not supported by this browser."
      );
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));

        setLocationMessage(
          "Your current location has been detected."
        );

        setLocationLoading(false);
      },
      (locationError) => {
        console.error(locationError);

        setError(
          "Unable to access your location. Please allow location access or enter your coordinates manually."
        );

        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!form.latitude || !form.longitude) {
      setError(
        "Please share your location before sending the emergency request."
      );
      return;
    }

    if (Number(form.peopleCount) < 1) {
      setError("At least one affected person is required.");
      return;
    }

    setSubmitting(true);

    try {
      await axios.post(
        `${API_URL}/api/emergencies`,
        {
          location: {
            latitude: Number(form.latitude),
            longitude: Number(form.longitude),
          },

          peopleCount: Number(form.peopleCount),
          children: Number(form.children),
          elderly: Number(form.elderly),
          injured: Number(form.injured),
          waterLevel: Number(form.waterLevel),

          emergencyType: form.emergencyType,

          description: form.description.trim(),
        }
      );

      setSubmitted(true);
    } catch (submitError) {
      console.error(
        "Emergency submission failed:",
        submitError
      );

      setError(
        "We couldn't send your emergency request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetRequest = () => {
    setForm(initialForm);
    setLocationMessage("");
    setError("");
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="citizen-page">
        <div className="citizen-success-card">
          <div className="success-icon">✓</div>

          <p className="success-label">
            REQUEST RECEIVED
          </p>

          <h1>Help is on the way.</h1>

          <p>
            Your emergency request has been sent to
            FloodLink responders.
          </p>

          <div className="success-details">
            <div>
              <span>People affected</span>
              <strong>{form.peopleCount}</strong>
            </div>

            <div>
              <span>Emergency</span>
              <strong>
                {form.emergencyType
                  .charAt(0)
                  .toUpperCase() +
                  form.emergencyType.slice(1)}
              </strong>
            </div>

            <div>
              <span>Location</span>
              <strong>Shared</strong>
            </div>
          </div>

          <div className="success-note">
            Keep your phone accessible. Responders may
            use your shared location to coordinate help.
          </div>

          <button
            className="new-request-btn"
            onClick={resetRequest}
          >
            Send Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="citizen-page">
      <header className="citizen-header">
        <div className="citizen-brand">
          <div className="citizen-logo">🌊</div>

          <div>
            <h2>FloodLink</h2>
            <span>Emergency Assistance</span>
          </div>
        </div>

        <div className="connection-status">
          <span className="status-dot"></span>
          Emergency network
        </div>
      </header>

      <main className="citizen-content">
        <section className="citizen-hero">
          <span className="hero-eyebrow">
            FLOOD EMERGENCY
          </span>

          <h1>
            Need emergency
            <br />
            assistance?
          </h1>

          <p>
            Share your location and situation so
            responders can coordinate help.
          </p>
        </section>

        <form
          className="emergency-form"
          onSubmit={handleSubmit}
        >
          <section className="form-section location-section">
            <div className="section-heading">
              <div className="section-icon">📍</div>

              <div>
                <h3>Your location</h3>
                <p>
                  Responders need your location to find you.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="location-btn"
              onClick={useCurrentLocation}
              disabled={locationLoading}
            >
              {locationLoading
                ? "Detecting location..."
                : "📍 Use My Current Location"}
            </button>

            {form.latitude && form.longitude && (
              <div className="location-found">
                <span>✓</span>

                <div>
                  <strong>Location detected</strong>
                  <small>
                    {form.latitude}, {form.longitude}
                  </small>
                </div>
              </div>
            )}

            {locationMessage && (
              <p className="location-message">
                {locationMessage}
              </p>
            )}
          </section>

          <section className="form-section">
            <div className="section-heading">
              <div className="section-icon">👥</div>

              <div>
                <h3>People affected</h3>
                <p>
                  Tell responders who needs assistance.
                </p>
              </div>
            </div>

            <div className="number-grid">
              <label>
                <span>Total people</span>

                <input
                  type="number"
                  name="peopleCount"
                  min="1"
                  value={form.peopleCount}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                <span>Children</span>

                <input
                  type="number"
                  name="children"
                  min="0"
                  value={form.children}
                  onChange={handleChange}
                />
              </label>

              <label>
                <span>Elderly</span>

                <input
                  type="number"
                  name="elderly"
                  min="0"
                  value={form.elderly}
                  onChange={handleChange}
                />
              </label>

              <label>
                <span>Injured</span>

                <input
                  type="number"
                  name="injured"
                  min="0"
                  value={form.injured}
                  onChange={handleChange}
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading">
              <div className="section-icon">🌊</div>

              <div>
                <h3>Water level</h3>
                <p>
                  Approximate water depth around you.
                </p>
              </div>
            </div>

            <div className="water-input">
              <input
                type="number"
                name="waterLevel"
                min="0"
                step="0.1"
                value={form.waterLevel}
                onChange={handleChange}
              />

              <span>metres</span>
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading">
              <div className="section-icon">🆘</div>

              <div>
                <h3>What kind of help do you need?</h3>
                <p>
                  Select the situation that best describes
                  your emergency.
                </p>
              </div>
            </div>

            <div className="emergency-types">
              {[
                ["stranded", "🌊", "Stranded"],
                ["trapped", "🚪", "Trapped"],
                ["medical", "🏥", "Medical"],
                ["injury", "🩹", "Injury"],
                ["evacuation", "🚶", "Evacuation"],
                ["other", "🆘", "Other"],
              ].map(
                ([value, icon, label]) => (
                  <label
                    key={value}
                    className={`emergency-type ${
                      form.emergencyType === value
                        ? "selected"
                        : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="emergencyType"
                      value={value}
                      checked={
                        form.emergencyType === value
                      }
                      onChange={handleChange}
                    />

                    <span className="type-icon">
                      {icon}
                    </span>

                    <span>{label}</span>
                  </label>
                )
              )}
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading">
              <div className="section-icon">📝</div>

              <div>
                <h3>Describe the situation</h3>
                <p>
                  Give responders any useful information.
                </p>
              </div>
            </div>

            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="For example: We are trapped on the second floor. Water is rising and we cannot leave the building."
              rows="5"
              maxLength="500"
            />

            <div className="character-count">
              {form.description.length}/500
            </div>
          </section>

          {error && (
            <div className="citizen-error">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="submit-emergency-btn"
            disabled={submitting}
          >
            {submitting
              ? "Sending Emergency Request..."
              : "🚨 SEND EMERGENCY REQUEST"}
          </button>

          <p className="privacy-note">
            Your location and emergency information will
            be shared with FloodLink responders for rescue
            coordination.
          </p>
        </form>
      </main>
    </div>
  );
}

export default CitizenDashboard;