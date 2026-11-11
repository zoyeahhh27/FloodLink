const express = require("express");

const FloodHazard =
  require("../models/FloodHazard");

const router = express.Router();

// =====================================================
// GET ACTIVE HAZARDS
// =====================================================

router.get("/", async (req, res) => {
  try {
    const hazards =
      await FloodHazard.find({
        active: true,
      }).sort({
        createdAt: -1,
      });

    res.json({
      success: true,

      count: hazards.length,

      hazards,
    });
  } catch (error) {
    console.error(
      "HAZARD FETCH ERROR:",
      error
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to fetch flood hazards",

      error: error.message,
    });
  }
});

// =====================================================
// CREATE HAZARD REPORT
// =====================================================

router.post("/", async (req, res) => {
  try {
    const hazard =
      await FloodHazard.create(
        req.body
      );

    res.status(201).json({
      success: true,

      message:
        "Flood hazard reported 🚧",

      hazard,
    });
  } catch (error) {
    console.error(
      "HAZARD CREATE ERROR:",
      error
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to report hazard",

      error: error.message,
    });
  }
});

// =====================================================
// UPDATE HAZARD
// =====================================================

router.patch(
  "/:id",
  async (req, res) => {
    try {
      const hazard =
        await FloodHazard.findByIdAndUpdate(
          req.params.id,

          req.body,

          {
            new: true,
            runValidators: true,
          }
        );

      if (!hazard) {
        return res.status(404).json({
          success: false,

          message:
            "Hazard not found",
        });
      }

      res.json({
        success: true,

        message:
          "Hazard updated successfully",

        hazard,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,

        message:
          "Failed to update hazard",

        error: error.message,
      });
    }
  }
);

module.exports = router;