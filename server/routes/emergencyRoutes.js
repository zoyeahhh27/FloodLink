const express = require("express");

const EmergencyRequest =
  require("../models/EmergencyRequest");

const { getIO } =
  require("../socket");

const { calculatePriority } =
  require("../utils/priorityEngine");

const router = express.Router();

// =====================================================
// CREATE EMERGENCY
// =====================================================

router.post("/", async (req, res) => {
  try {

    // =================================================
    // AI-ASSISTED PRIORITY
    // =================================================

    const priorityResult =
      calculatePriority(req.body);

    console.log(
      "AI PRIORITY RESULT:",
      priorityResult
    );

    // =================================================
    // CREATE EMERGENCY
    // =================================================

    const emergency =
      await EmergencyRequest.create({
        ...req.body,

        priority:
          priorityResult.priority,
      });

    // =================================================
    // REAL-TIME RESPONDER UPDATE
    // =================================================

    const emergencyPayload = {
      ...emergency.toObject(),

      priorityScore:
        priorityResult.score,

      priorityReasons:
        priorityResult.reasons,
    };

    getIO().emit(
      "newEmergency",
      emergencyPayload
    );

    // =================================================
    // RESPONSE
    // =================================================

    res.status(201).json({
      success: true,

      message:
        "Emergency request created 🚨",

      emergency:
        emergencyPayload,
    });

  } catch (error) {

    console.error(
      "CREATE ERROR:",
      error
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to create emergency request",

      error: error.message,
    });
  }
});

// =====================================================
// GET ALL EMERGENCIES
// =====================================================

router.get("/", async (req, res) => {
  try {

    const emergencies =
      await EmergencyRequest.find()
        .sort({
          createdAt: -1,
        });

    // Recalculate priority information
    // for existing emergency records

    const enrichedEmergencies =
      emergencies.map(
        (emergency) => {

          const priorityResult =
            calculatePriority(
              emergency.toObject()
            );

          return {
            ...emergency.toObject(),

            priorityScore:
              priorityResult.score,

            priorityReasons:
              priorityResult.reasons,
          };
        }
      );

    res.json({
      success: true,

      count:
        enrichedEmergencies.length,

      emergencies:
        enrichedEmergencies,
    });

  } catch (error) {

    console.error(
      "FETCH ERROR:",
      error
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to fetch emergencies",

      error: error.message,
    });
  }
});

// =====================================================
// UPDATE STATUS
// =====================================================

router.patch(
  "/:id/status",
  async (req, res) => {

    try {

      const {
        status,
        responderName,
      } = req.body;

      // =================================================
      // VALIDATE STATUS
      // =================================================

      const validStatuses = [
        "new",
        "assigned",
        "rescued",
        "resolved",
      ];

      if (
        !validStatuses.includes(
          status
        )
      ) {

        return res.status(400).json({
          success: false,

          message:
            "Invalid emergency status",
        });
      }

      // =================================================
      // BUILD UPDATE
      // =================================================

      const updateData = {
        status,
      };

      // =================================================
      // ASSIGN RESPONDER
      // =================================================

      if (
        status === "assigned"
      ) {

        updateData.assignedResponder =
          responderName ||
          "Responder 01";

        updateData.assignedAt =
          new Date();
      }

      // =================================================
      // RESET ASSIGNMENT
      // =================================================

      if (
        status === "new"
      ) {

        updateData.assignedResponder =
          null;

        updateData.assignedAt =
          null;
      }

      // =================================================
      // UPDATE DATABASE
      // =================================================

      const emergency =
        await EmergencyRequest.findByIdAndUpdate(
          req.params.id,

          updateData,

          {
            new: true,

            runValidators: true,
          }
        );

      // =================================================
      // NOT FOUND
      // =================================================

      if (!emergency) {

        return res.status(404).json({
          success: false,

          message:
            "Emergency request not found",
        });
      }

      // =================================================
      // RECALCULATE PRIORITY
      // =================================================

      const priorityResult =
        calculatePriority(
          emergency.toObject()
        );

      const emergencyPayload = {
        ...emergency.toObject(),

        priorityScore:
          priorityResult.score,

        priorityReasons:
          priorityResult.reasons,
      };

      // =================================================
      // REAL-TIME UPDATE
      // =================================================

      getIO().emit(
        "emergencyStatusUpdated",
        emergencyPayload
      );

      // =================================================
      // RESPONSE
      // =================================================

      res.json({
        success: true,

        message:
          "Emergency status updated successfully",

        emergency:
          emergencyPayload,
      });

    } catch (error) {

      console.error(
        "STATUS UPDATE ERROR:",
        error
      );

      res.status(500).json({
        success: false,

        message:
          "Failed to update emergency",

        error: error.message,
      });
    }
  }
);

module.exports = router;