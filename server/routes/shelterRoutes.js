const express = require("express");

const Shelter =
  require("../models/shelter");

const router = express.Router();

// =====================================================
// GET ALL SHELTERS
// =====================================================

router.get("/", async (req, res) => {
  try {
    const shelters =
      await Shelter.find()
        .sort({
          createdAt: -1,
        });

    res.json({
      success: true,

      count:
        shelters.length,

      shelters,
    });
  } catch (error) {
    console.error(
      "SHELTER FETCH ERROR:",
      error
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to fetch shelters",

      error: error.message,
    });
  }
});

// =====================================================
// GET SINGLE SHELTER
// =====================================================

router.get(
  "/:id",
  async (req, res) => {
    try {
      const shelter =
        await Shelter.findById(
          req.params.id
        );

      if (!shelter) {
        return res.status(404).json({
          success: false,

          message:
            "Shelter not found",
        });
      }

      res.json({
        success: true,

        shelter,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,

        message:
          "Failed to fetch shelter",
      });
    }
  }
);

// =====================================================
// CREATE SHELTER
// =====================================================

router.post("/", async (req, res) => {
  try {
    const shelter =
      await Shelter.create(
        req.body
      );

    res.status(201).json({
      success: true,

      message:
        "Shelter created successfully 🏠",

      shelter,
    });
  } catch (error) {
    console.error(
      "SHELTER CREATE ERROR:",
      error
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to create shelter",

      error: error.message,
    });
  }
});

// =====================================================
// UPDATE SHELTER
// =====================================================

router.patch(
  "/:id",
  async (req, res) => {
    try {
      const shelter =
        await Shelter.findByIdAndUpdate(
          req.params.id,

          req.body,

          {
            new: true,
            runValidators: true,
          }
        );

      if (!shelter) {
        return res.status(404).json({
          success: false,

          message:
            "Shelter not found",
        });
      }

      res.json({
        success: true,

        message:
          "Shelter updated successfully",

        shelter,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,

        message:
          "Failed to update shelter",

        error: error.message,
      });
    }
  }
);

module.exports = router;