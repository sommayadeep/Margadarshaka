// Greedy and service-rate helpers extracted from App.jsx
export const LANES = ['north', 'south', 'east', 'west'];

export const chooseSmartLane = (system) => {
  let bestLane = 'north';
  let bestCount = -1;

  for (const lane of LANES) {
    const count = system.lanes[lane].vehicleCount;
    if (count > bestCount) {
      bestCount = count;
      bestLane = lane;
    }
  }

  return bestLane;
};

export const getSmartGreenDuration = (queueCount) => {
  const BASE_GREEN_TIME = 8;
  const MIN_SMART_GREEN_TIME = 8;
  const MAX_SMART_GREEN_TIME = 28;
  const dynamic = BASE_GREEN_TIME + Math.ceil(Math.sqrt(Math.max(0, queueCount)) * 1.9);
  return Math.min(MAX_SMART_GREEN_TIME, Math.max(MIN_SMART_GREEN_TIME, dynamic));
};

export const getActiveServiceRate = (system, currentMode, emergencyActive, emergencyLane) => {
  const SERVICE_BASE = 3;
  const SMART_SERVICE_MIN = 6;
  const SMART_SERVICE_MAX = 32;
  const lane = system.lanes[system.activeLane];

  if (emergencyActive && system.activeLane === emergencyLane) {
    return 14;
  }

  if (currentMode === 'normal') {
    return SERVICE_BASE + 2;
  }

  return Math.min(SMART_SERVICE_MAX, Math.max(SMART_SERVICE_MIN, Math.ceil(6 + lane.vehicleCount * 0.22)));
};
