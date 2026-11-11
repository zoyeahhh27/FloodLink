const mongoose = require("mongoose");

const floodHazardSchema = new mongoose.Schema(
  {
    // =========================================
    // LOCATION
    // =========================================

    location: {
      latitude: {
        type: Number,
        required: true,
      },

      longitude: {
        type: Number,
        required: true,
      },
    },

    // =========================================
    // HAZARD TYPE
    // =========================================

    hazardType: {
      type: String,

      enum: [
        "flooded_road",
        "blocked_road",
        "bridge_flooded",
        "debris",
        "high_water",
        "other",
      ],

      required: true,
    },

    // =========================================
    // SEVERITY
    // =========================================

    severity: {
      type: String,

      enum: [
        "low",
        "medium",
        "high",
        "critical",
      ],

      default: "medium",
    },

    // =========================================
    // WATER LEVEL
    // =========================================

    waterLevel: {
      type: Number,
      default: 0,
    },

    // =========================================
    // ROAD STATUS
    // =========================================

    roadBlocked: {
      type: Boolean,
      default: false,
    },

    // =========================================
    // DESCRIPTION
    // =========================================

    description: {
      type: String,
      default: "",
    },

    // =========================================
    // REPORT INFORMATION
    // =========================================

    reportedBy: {
      type: String,
      default: "Responder",
    },

    // =========================================
    // ACTIVE STATUS
    // =========================================

    active: {
      type: Boolean,
      default: true,
    },
  },

  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model(
    "FloodHazard",
    floodHazardSchema
  );