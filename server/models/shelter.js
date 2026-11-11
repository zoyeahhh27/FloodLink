const mongoose = require("mongoose");

const shelterSchema = new mongoose.Schema(
  {
    // =========================================
    // SHELTER INFORMATION
    // =========================================

    name: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      default: "",
    },

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
    // CAPACITY
    // =========================================

    capacity: {
      type: Number,
      required: true,
      min: 1,
    },

    occupied: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =========================================
    // FACILITIES
    // =========================================

    facilities: {
      water: {
        type: Boolean,
        default: false,
      },

      food: {
        type: Boolean,
        default: false,
      },

      medical: {
        type: Boolean,
        default: false,
      },

      electricity: {
        type: Boolean,
        default: false,
      },

      toilets: {
        type: Boolean,
        default: false,
      },
    },

    // =========================================
    // STATUS
    // =========================================

    status: {
      type: String,

      enum: [
        "open",
        "full",
        "closed",
      ],

      default: "open",
    },
  },

  {
    timestamps: true,
  }
);

// =========================================
// AVAILABLE SPACE
// =========================================

shelterSchema.virtual(
  "availableSpaces"
).get(function () {
  return Math.max(
    this.capacity - this.occupied,
    0
  );
});

shelterSchema.set(
  "toJSON",
  {
    virtuals: true,
  }
);

module.exports =
  mongoose.model(
    "Shelter",
    shelterSchema
  );