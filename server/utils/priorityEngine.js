// =====================================================
// FLOODLINK — AI-ASSISTED PRIORITY ENGINE
// =====================================================

const calculatePriority = (emergency) => {
  let score = 0;

  const reasons = [];

  const people =
    Number(emergency.peopleCount) || 0;

  const children =
    Number(emergency.children) || 0;

  const elderly =
    Number(emergency.elderly) || 0;

  const injured =
    Number(emergency.injured) || 0;

  const waterLevel =
    Number(emergency.waterLevel) || 0;

  const emergencyType =
    emergency.emergencyType || "other";

  // ===================================================
  // PEOPLE AFFECTED
  // ===================================================

  if (people >= 10) {
    score += 25;

    reasons.push(
      `${people} people affected`
    );
  } else if (people >= 5) {
    score += 18;

    reasons.push(
      `${people} people affected`
    );
  } else if (people >= 3) {
    score += 10;

    reasons.push(
      `${people} people affected`
    );
  } else if (people > 0) {
    score += 5;
  }

  // ===================================================
  // CHILDREN
  // ===================================================

  if (children > 0) {
    const points =
      Math.min(children * 12, 30);

    score += points;

    reasons.push(
      `${children} child${
        children > 1 ? "ren" : ""
      } involved`
    );
  }

  // ===================================================
  // ELDERLY
  // ===================================================

  if (elderly > 0) {
    const points =
      Math.min(elderly * 10, 25);

    score += points;

    reasons.push(
      `${elderly} elderly person${
        elderly > 1 ? "s" : ""
      } involved`
    );
  }

  // ===================================================
  // INJURY
  // ===================================================

  if (injured > 0) {
    const points =
      Math.min(injured * 25, 60);

    score += points;

    reasons.push(
      `${injured} injured person${
        injured > 1 ? "s" : ""
      }`
    );
  }

  // ===================================================
  // WATER LEVEL
  // ===================================================

  if (waterLevel >= 2) {
    score += 35;

    reasons.push(
      `water level ${waterLevel} m`
    );
  } else if (waterLevel >= 1.5) {
    score += 25;

    reasons.push(
      `water level ${waterLevel} m`
    );
  } else if (waterLevel >= 1) {
    score += 15;

    reasons.push(
      `water level ${waterLevel} m`
    );
  } else if (waterLevel > 0.5) {
    score += 8;
  }

  // ===================================================
  // EMERGENCY TYPE
  // ===================================================

  const typeWeights = {
    trapped: 25,
    medical: 30,
    injury: 30,
    stranded: 15,
    evacuation: 20,
    other: 5,
  };

  const typeScore =
    typeWeights[emergencyType] || 5;

  score += typeScore;

  reasons.push(
    `${emergencyType} emergency`
  );

  // ===================================================
  // PRIORITY
  // ===================================================

  let priority;

  if (score >= 90) {
    priority = "critical";
  } else if (score >= 60) {
    priority = "high";
  } else if (score >= 30) {
    priority = "medium";
  } else {
    priority = "low";
  }

  return {
    score,
    priority,
    reasons,
  };
};

module.exports = {
  calculatePriority,
};