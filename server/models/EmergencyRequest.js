const mongoose = require("mongoose");

const emergencyRequestSchema = new mongoose.Schema(
  {
    // ================================
    // LOCATION
    // ================================

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

    // ================================
    // PEOPLE INFORMATION
    // ================================

    peopleCount: {
      type: Number,
      required: true,
      min: 1,
    },

    children: {
      type: Number,
      default: 0,
    },

    elderly: {
      type: Number,
      default: 0,
    },

    injured: {
      type: Number,
      default: 0,
    },

    // ================================
    // FLOOD INFORMATION
    // ================================

    waterLevel: {
      type: Number,
      default: 0,
    },

    // ================================
    // EMERGENCY TYPE
    // ================================

    emergencyType: {
      type: String,

      enum: [
        "stranded",
        "injury",
        "medical",
        "trapped",
        "evacuation",
        "other",
      ],

      required: true,
    },

    // ================================
    // DESCRIPTION
    // ================================

    description: {
      type: String,
      default: "",
    },

    // ================================
    // PRIORITY
    // ================================

    priority: {
      type: String,

      enum: [
        "low",
        "medium",
        "high",
        "critical",
      ],

      default: "medium",
    },

    // ================================
    // STATUS
    // ================================

    status: {
      type: String,

      enum: [
        "new",
        "assigned",
        "rescued",
        "resolved",
      ],

      default: "new",
    },

    // ================================
    // RESPONDER ASSIGNMENT
    // ================================

    assignedResponder: {
      type: String,
      default: null,
    },

    assignedAt: {
      type: Date,
      default: null,
    },
  },

  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model(
    "EmergencyRequest",
    emergencyRequestSchema
  );