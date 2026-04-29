import { useEffect, useMemo, useReducer } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BellRing,
  CarFront,
  Gauge,
  Pause,
  Play,
  Radar,
  ShieldAlert,
  Sparkles,
  TrafficCone,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chooseSmartLane, getSmartGreenDuration, getActiveServiceRate } from './algorithms';

const LANES = ['north', 'south', 'east', 'west'];
const LANE_LABELS = {
  north: 'North',
  south: 'South',
  east: 'East',
  west: 'West',
};
const FIXED_GREEN_TIME = 20;
const BASE_GREEN_TIME = 8;
const SERVICE_BASE = 3;
const MIN_SMART_GREEN_TIME = 8;
const MAX_SMART_GREEN_TIME = 28;
const SMART_SERVICE_MIN = 6;
const SMART_SERVICE_MAX = 32;
const CONGESTION_THRESHOLD = 65;
const MAX_CHART_POINTS = 70;

const createLane = () => ({
  vehicleCount: 0,
  waitingTime: 0,
  arrivalRate: 0,
});

const createSystem = () => ({
  lanes: {
    north: createLane(),
    south: createLane(),
    east: createLane(),
    west: createLane(),
  },
  activeLane: 'north',
  remainingGreen: FIXED_GREEN_TIME,
  phaseIndex: 0,
  vehiclesProcessed: 0,
  totalWaitingTime: 0,
  arrivedVehicles: 0,
  congestionLevel: 0,
  signalSwitches: 0,
});

const createInitialState = () => ({
  currentMode: 'normal',
  isRunning: false,
  densityFactor: 6,
  simulationSpeed: 1,
  peakHour: false,
  emergencyMode: false,
  emergencyLane: 'north',
  emergencyCooldown: 0,
  time: 0,
  systems: {
    normal: createSystem(),
    smart: createSystem(),
  },
  logs: [
    {
      id: 1,
      level: 'info',
      text: 'Dashboard initialized. Normal timing is active.',
      time: '00:00:00',
    },
  ],
  chartData: [{ time: '00:00', normal: 0, smart: 0 }],
  cameraFeed: [42, 58, 77, 63],
});

const roundTime = (seconds) => {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
};

const laneSequence = ['north', 'east', 'south', 'west'];

function ControlGroup({ label, value, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
        <span>{label}</span>
        <span className="text-slate-500">{value}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ToggleButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-sm transition ${
        active
          ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200 shadow-neon'
          : 'border-white/10 bg-slate-950/60 text-slate-300 hover:border-white/20'
      }`}
    >
      {label}
    </button>
  );
}

const reducer = (state, action) => {
  switch (action.type) {
    case 'start':
      return { ...state, isRunning: true };
    case 'pause':
      return { ...state, isRunning: false };
    case 'togglePeakHour':
      return { ...state, peakHour: !state.peakHour };
    case 'toggleEmergencyMode':
      return {
        ...state,
        emergencyMode: !state.emergencyMode,
        emergencyCooldown: !state.emergencyMode ? 6 : 0,
      };
    case 'setEmergencyLane':
      return { ...state, emergencyLane: action.lane };
    case 'setDensityFactor':
      return { ...state, densityFactor: action.value };
    case 'setSimulationSpeed':
      return { ...state, simulationSpeed: action.value };
    case 'setMode':
      return { ...state, currentMode: action.value };
    case 'manualAddVehicles': {
      const systems = {
        normal: {
          ...state.systems.normal,
          lanes: {
            ...state.systems.normal.lanes,
            [action.lane]: {
              ...state.systems.normal.lanes[action.lane],
              vehicleCount: state.systems.normal.lanes[action.lane].vehicleCount + action.amount,
            },
          },
        },
        smart: {
          ...state.systems.smart,
          lanes: {
            ...state.systems.smart.lanes,
            [action.lane]: {
              ...state.systems.smart.lanes[action.lane],
              vehicleCount: state.systems.smart.lanes[action.lane].vehicleCount + action.amount,
            },
          },
        },
      };

      return {
        ...state,
        systems,
        logs: [
          {
            id: Date.now(),
            level: 'info',
            text: `Manual vehicle injection added ${action.amount} vehicles to ${LANE_LABELS[action.lane]}.`,
            time: roundTime(state.time),
          },
          ...state.logs,
        ],
      };
    }
    case 'reset':
      return createInitialState();
    case 'tick': {
      if (!state.isRunning) {
        return state;
      }

      const nextSystems = {
        normal: {
          ...state.systems.normal,
          lanes: { ...state.systems.normal.lanes },
        },
        smart: {
          ...state.systems.smart,
          lanes: { ...state.systems.smart.lanes },
        },
      };

      const multiplier = state.peakHour ? 1.65 : 1;
      const arrivals = LANES.reduce((memo, lane) => {
        memo[lane] = Math.floor(Math.random() * (state.densityFactor + 1) * multiplier);
        return memo;
      }, {});

      for (const systemName of ['normal', 'smart']) {
        const system = nextSystems[systemName];
        for (const lane of LANES) {
          const incoming = arrivals[lane];
          const previousCount = system.lanes[lane].vehicleCount;
          system.lanes[lane] = {
            ...system.lanes[lane],
            vehicleCount: previousCount + incoming,
            arrivalRate: incoming,
            waitingTime: system.lanes[lane].waitingTime + previousCount + incoming,
          };
          system.arrivedVehicles += incoming;
          system.totalWaitingTime += previousCount;
        }
      }

      let emergencyCooldown = state.emergencyCooldown;
      const emergencyActive = state.emergencyMode && emergencyCooldown > 0;

      for (const systemName of ['normal', 'smart']) {
        const system = nextSystems[systemName];
        const isSmart = systemName === 'smart';

        if (system.remainingGreen <= 0 || system.lanes[system.activeLane].vehicleCount === 0) {
          const nextLane = emergencyActive
            ? state.emergencyLane
            : isSmart
              ? chooseSmartLane(system)
              : laneSequence[(system.phaseIndex + 1) % laneSequence.length];

          system.phaseIndex = isSmart ? system.phaseIndex : (system.phaseIndex + 1) % laneSequence.length;
          system.activeLane = nextLane;
          system.signalSwitches += 1;
          system.remainingGreen = emergencyActive
            ? 6
            : isSmart
              ? getSmartGreenDuration(system.lanes[nextLane].vehicleCount)
              : FIXED_GREEN_TIME;
        }

        if (emergencyActive) {
          system.activeLane = state.emergencyLane;
          system.remainingGreen = Math.max(system.remainingGreen, 4);
        }

        const activeLane = system.activeLane;
        const serviceRate = getActiveServiceRate(system, isSmart ? 'smart' : 'normal', emergencyActive, state.emergencyLane);
        const processed = Math.min(system.lanes[activeLane].vehicleCount, serviceRate);

        system.lanes[activeLane] = {
          ...system.lanes[activeLane],
          vehicleCount: system.lanes[activeLane].vehicleCount - processed,
        };

        system.vehiclesProcessed += processed;
        system.remainingGreen -= 1;

        const totalVehicles = LANES.reduce((sum, lane) => sum + system.lanes[lane].vehicleCount, 0);
        system.congestionLevel = Math.min(100, Math.round((totalVehicles / 160) * 100));
      }

      if (emergencyActive && nextSystems.normal.lanes[state.emergencyLane].vehicleCount <= 0 && nextSystems.smart.lanes[state.emergencyLane].vehicleCount <= 0) {
        emergencyCooldown = 0;
      } else if (emergencyCooldown > 0) {
        emergencyCooldown -= 1;
      }

      const nextTime = state.time + 1;
      const normalAverage = nextSystems.normal.arrivedVehicles ? nextSystems.normal.totalWaitingTime / nextSystems.normal.arrivedVehicles : 0;
      const smartAverage = nextSystems.smart.arrivedVehicles ? nextSystems.smart.totalWaitingTime / nextSystems.smart.arrivedVehicles : 0;

      const nextChart = [
        ...state.chartData,
        {
          time: roundTime(nextTime).slice(3),
          normal: Number(normalAverage.toFixed(2)),
          smart: Number(smartAverage.toFixed(2)),
        },
      ].slice(-MAX_CHART_POINTS);

      const nextCameraFeed = state.cameraFeed.map((value, index) => {
        const lane = LANES[index];
        const vehicleCount = nextSystems[state.currentMode].lanes[lane].vehicleCount;
        return Math.min(99, Math.max(8, Math.round(value * 0.82 + vehicleCount * 2 + Math.random() * 8)));
      });

      const newLogs = [];
      if (nextSystems.normal.signalSwitches !== state.systems.normal.signalSwitches) {
        newLogs.push({
          id: Date.now() + 1,
          level: 'info',
          text: `Normal controller switched to ${LANE_LABELS[nextSystems.normal.activeLane]}.`,
          time: roundTime(nextTime),
        });
      }
      if (nextSystems.smart.signalSwitches !== state.systems.smart.signalSwitches) {
        newLogs.push({
          id: Date.now() + 2,
          level: 'info',
          text: `Smart controller prioritized ${LANE_LABELS[nextSystems.smart.activeLane]} with highest queue pressure.`,
          time: roundTime(nextTime),
        });
      }
      if (emergencyActive && emergencyCooldown === 0) {
        newLogs.push({
          id: Date.now() + 3,
          level: 'priority',
          text: `Emergency clearance finished for ${LANE_LABELS[state.emergencyLane]}. Control returned to adaptive flow.`,
          time: roundTime(nextTime),
        });
      }

      const nextEmergencyMode = emergencyCooldown > 0;

      return {
        ...state,
        time: nextTime,
        emergencyCooldown,
        emergencyMode: nextEmergencyMode,
        systems: nextSystems,
        chartData: nextChart,
        cameraFeed: nextCameraFeed,
        logs: [...newLogs, ...state.logs].slice(0, 12),
      };
    }
    default:
      return state;
  }
};

function SimulationContext({ state, dispatch }) {
  const {
    currentMode,
    isRunning,
    densityFactor,
    simulationSpeed,
    peakHour,
    emergencyMode,
    emergencyLane,
    time,
    systems,
    logs,
    chartData,
  } = state;

  const normal = systems.normal;
  const smart = systems.smart;

  const smartAverageWaiting = smart.arrivedVehicles ? smart.totalWaitingTime / smart.arrivedVehicles : 0;
  const normalAverageWaiting = normal.arrivedVehicles ? normal.totalWaitingTime / normal.arrivedVehicles : 0;
  const efficiencyImprovement = normalAverageWaiting
    ? Math.max(0, ((normalAverageWaiting - smartAverageWaiting) / normalAverageWaiting) * 100)
    : 0;

  const activeSystem = currentMode === 'normal' ? normal : smart;
  const activeAverageWaiting = currentMode === 'normal' ? normalAverageWaiting : smartAverageWaiting;
  const liveClock = roundTime(time);
  const totalQueued = LANES.reduce((sum, lane) => sum + activeSystem.lanes[lane].vehicleCount, 0);
  const trafficDensity = Math.min(100, Math.round((totalQueued / 160) * 100));

  const liveMetrics = [
    { label: 'Congestion Level', value: `${Math.round(activeSystem.congestionLevel)}%`, icon: Radar, accent: 'text-emerald-400' },
    { label: 'Avg Waiting Time', value: `${activeAverageWaiting.toFixed(1)} s`, icon: Gauge, accent: 'text-cyan-400' },
    { label: 'Vehicles Processed', value: `${activeSystem.vehiclesProcessed}`, icon: CarFront, accent: 'text-amber-400' },
    { label: 'Traffic Density', value: `${trafficDensity}%`, icon: TrafficCone, accent: 'text-rose-400' },
  ];

  const alerts = useMemo(() => {
    const list = [];

    if (activeSystem.congestionLevel >= CONGESTION_THRESHOLD) {
      list.push({ type: 'danger', text: 'High congestion detected in the active system.' });
    }

    if (state.emergencyMode && state.emergencyCooldown > 0) {
      list.push({ type: 'priority', text: `Emergency override engaged for ${LANE_LABELS[emergencyLane]} lane.` });
    }

    if (!isRunning) {
      list.push({ type: 'info', text: 'Simulation paused. Resume to continue processing traffic.' });
    }

    return list;
  }, [activeSystem.congestionLevel, emergencyLane, isRunning, state.emergencyCooldown, state.emergencyMode]);

  const comparisonCards = [
    {
      label: 'Normal Avg Waiting',
      value: `${normalAverageWaiting.toFixed(1)} s`,
      detail: 'Fixed cycle',
    },
    {
      label: 'Smart Avg Waiting',
      value: `${smartAverageWaiting.toFixed(1)} s`,
      detail: 'Greedy selection',
    },
    {
      label: 'Efficiency Improvement',
      value: `${efficiencyImprovement.toFixed(1)}%`,
      detail: 'Less waiting time',
    },
  ];

  const activeLaneDetail = activeSystem.lanes[activeSystem.activeLane];

  return (
    <div className="space-y-6 text-slate-100">
      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-panel relative overflow-hidden rounded-3xl p-5 xl:p-6"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.1),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(148,163,184,0.08),transparent_42%)]" />
          <div className="relative flex items-center justify-between gap-4 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Intersection Command Center</p>
              <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Margadarshaka</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Live 4-way intersection simulation with a fixed timing baseline and a greedy adaptive controller running side by side.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-right backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">System Status</p>
              <p className={`mt-1 text-lg font-semibold ${isRunning ? 'text-emerald-400' : 'text-amber-300'}`}>
                {isRunning ? 'Live' : 'Paused'}
              </p>
              <p className="text-sm text-slate-400">{liveClock}</p>
            </div>
          </div>

          <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {liveMetrics.map(({ label, value, icon: Icon, accent }) => (
              <div key={label} className="glass-card rounded-2xl border border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-300">{label}</p>
                  <Icon className={`h-4 w-4 ${accent}`} />
                </div>
                <p className="mt-4 text-2xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="relative mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Live Comparison</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Normal vs Smart</h2>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {comparisonCards.map((card) => (
                  <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{card.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
                    <p className="mt-2 text-sm text-slate-400">{card.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Current Active Lane</p>
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
                <div>
                  <p className="text-sm text-slate-300">{LANE_LABELS[activeSystem.activeLane]} Corridor</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{activeSystem.activeLane.toUpperCase()}</p>
                </div>
                <div className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-3 py-1 text-xs uppercase tracking-[0.25em] text-emerald-200">
                  Green
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="text-slate-500">Queue</p>
                  <p className="mt-2 text-xl font-semibold text-white">{activeLaneDetail.vehicleCount}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="text-slate-500">Green</p>
                  <p className="mt-2 text-xl font-semibold text-white">{Math.max(0, Math.ceil(activeSystem.remainingGreen))}s</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="glass-panel rounded-3xl p-5 xl:p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Alerts</p>
              <h2 className="mt-1 text-lg font-semibold text-white">System warnings and logs</h2>
            </div>
            <BellRing className="h-5 w-5 text-amber-300" />
          </div>
          <div className="mt-4 space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
              {alerts.length ? (
                alerts.map((alert, index) => (
                  <motion.div
                    key={`${alert.text}-${index}`}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -18 }}
                    className="rounded-2xl border px-4 py-3 text-sm font-semibold"
                    style={
                      alert.type === 'danger'
                        ? {
                            borderColor: 'rgba(239, 68, 68, 0.9)',
                            backgroundColor: 'rgba(127, 29, 29, 0.98)',
                            color: '#fff1f2',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                          }
                        : alert.type === 'priority'
                          ? {
                              borderColor: 'rgba(251, 191, 36, 0.75)',
                              backgroundColor: 'rgba(120, 53, 15, 0.96)',
                              color: '#fffbeb',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                            }
                          : {
                              borderColor: 'rgba(56, 189, 248, 0.35)',
                              backgroundColor: 'rgba(239, 246, 255, 0.98)',
                              color: '#0f172a',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
                            }
                    }
                  >
                    {alert.text}
                  </motion.div>
                ))
              ) : (
                <div
                  className="rounded-2xl border p-4 text-sm font-semibold"
                  style={{
                    borderColor: 'rgba(56, 189, 248, 0.35)',
                    backgroundColor: 'rgba(239, 246, 255, 0.98)',
                    color: '#0f172a',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
                  }}
                >
                  No active warnings. Traffic flow is stable.
                </div>
              )}
            </AnimatePresence>
          </div>

          <div
            className="mt-5 rounded-2xl border p-4"
            style={{
              borderColor: 'rgba(148, 163, 184, 0.38)',
              backgroundColor: 'rgba(15, 23, 42, 0.98)',
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em]" style={{ color: '#e2e8f0' }}>
                Signal Switching Logs
              </p>
              <ShieldAlert className="h-4 w-4" style={{ color: '#e2e8f0' }} />
            </div>
            <div className="mt-3 max-h-64 space-y-3 overflow-auto pr-1 scrollbar-thin">
              {logs.slice(0, 7).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border p-3"
                  style={{
                    borderColor: 'rgba(255, 255, 255, 0.16)',
                    backgroundColor: 'rgba(30, 41, 59, 0.96)',
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs uppercase tracking-[0.25em]" style={{ color: '#f8fafc' }}>
                      {entry.time}
                    </span>
                    <span
                      className="text-[11px] uppercase tracking-[0.2em]"
                      style={{
                        color: entry.level === 'danger' ? '#fda4af' : entry.level === 'priority' ? '#fcd34d' : '#67e8f9',
                      }}
                    >
                      {entry.level}
                    </span>
                  </div>
                  <p className="mt-2 text-sm" style={{ color: '#f8fafc' }}>
                    {entry.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="glass-panel rounded-3xl p-5 xl:p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Control Center</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Traffic and priority controls</h2>
            </div>
            <Sparkles className="h-5 w-5 text-emerald-300" />
          </div>

          <div className="mt-4 space-y-4">
            <ControlGroup label="Traffic Density" value={`${densityFactor}`}>
              <input
                type="range"
                min="1"
                max="15"
                value={densityFactor}
                onChange={(event) => dispatch({ type: 'setDensityFactor', value: Number(event.target.value) })}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-emerald-400"
              />
            </ControlGroup>

            <ControlGroup label="Simulation Speed" value={`${simulationSpeed}x`}>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={simulationSpeed}
                onChange={(event) => dispatch({ type: 'setSimulationSpeed', value: Number(event.target.value) })}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-cyan-400"
              />
            </ControlGroup>

            <div className="grid grid-cols-2 gap-3">
              <ToggleButton label="Peak Hour Mode" active={peakHour} onClick={() => dispatch({ type: 'togglePeakHour' })} />
              <ToggleButton
                label="Emergency Vehicle Mode"
                active={emergencyMode}
                onClick={() => dispatch({ type: 'toggleEmergencyMode' })}
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">Emergency Lane</p>
                <AlertTriangle className="h-4 w-4 text-amber-300" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {LANES.map((lane) => (
                  <button
                    key={lane}
                    type="button"
                    onClick={() => dispatch({ type: 'setEmergencyLane', lane })}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      emergencyLane === lane
                        ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200 shadow-neon'
                        : 'border-white/10 bg-slate-950/60 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    {LANE_LABELS[lane]}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">Emergency override grants instant priority to the selected lane.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-slate-300">Manual Add Vehicles</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {LANES.map((lane) => (
                  <button
                    key={lane}
                    type="button"
                    onClick={() => dispatch({ type: 'manualAddVehicles', lane, amount: Math.max(2, Math.ceil(densityFactor / 2)) })}
                    className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/10"
                  >
                    + {LANE_LABELS[lane]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => dispatch({ type: isRunning ? 'pause' : 'start' })}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isRunning ? 'Pause' : 'Start'} Simulation
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'reset' })}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-slate-800/80"
              >
                Reset
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="glass-panel rounded-3xl p-5 xl:p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Timeline Analytics</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Waiting time vs time</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">
              Realtime chart
            </div>
          </div>
          <div className="mt-5 h-80 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" strokeDasharray="4 6" />
                <XAxis dataKey="time" stroke="#64748B" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis stroke="#64748B" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid rgba(148,163,184,0.35)',
                    borderRadius: '16px',
                    color: '#0F172A',
                  }}
                  labelStyle={{ color: '#0F172A' }}
                />
                <Line type="monotone" dataKey="normal" stroke="#EF4444" strokeWidth={3} dot={false} name="Normal" />
                <Line type="monotone" dataKey="smart" stroke="#22C55E" strokeWidth={3} dot={false} name="Smart" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="glass-panel rounded-3xl p-5 xl:p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Intersection Brief</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Viva explanation</h2>
            </div>
            <CarFront className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Fixed timing keeps all directions equal, but it wastes green time when a lane is already empty and lets queues grow elsewhere.
            </p>
            <p className="rounded-2xl border border-white/10 bg-white/5 p-4">
              The greedy controller always selects the lane with the largest queue, so green time is assigned where congestion is highest.
            </p>
            <p className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Result: lower waiting time, faster clearance, and a better throughput profile under uneven traffic demand.
            </p>
          </div>
        </motion.div>
      </section>

      <section>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.28 }}
          className="glass-panel rounded-3xl p-5 xl:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Real World Signal Timing</p>
              <h2 className="mt-1 text-lg font-semibold text-white">4-way intersection comparison</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              Normal vs Smart controller
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <IntersectionSignalCard
              title="Normal System"
              subtitle="Fixed timing cycle"
              system={normal}
              type="normal"
            />
            <IntersectionSignalCard
              title="Smart System"
              subtitle="Adaptive greedy timing"
              system={smart}
              type="smart"
            />
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function IntersectionSignalCard({ title, subtitle, system, type }) {
  const activeLane = system.activeLane;
  const laneCounts = LANES.map((lane) => system.lanes[lane].vehicleCount);
  const highest = Math.max(...laneCounts, 0);

  const timerText = (lane) => {
    if (lane === activeLane) {
      return `${Math.max(0, Math.ceil(system.remainingGreen))}s`;
    }

    if (type === 'normal') {
      const activeIndex = laneSequence.indexOf(activeLane);
      const laneIndex = laneSequence.indexOf(lane);
      const offset = laneIndex >= activeIndex ? laneIndex - activeIndex : laneSequence.length - activeIndex + laneIndex;
      const eta = Math.ceil(system.remainingGreen + Math.max(0, offset - 1) * FIXED_GREEN_TIME);
      return `${eta}s`;
    }

    const sortedByPressure = [...LANES].sort((a, b) => system.lanes[b].vehicleCount - system.lanes[a].vehicleCount);
    const priorityIndex = Math.max(0, sortedByPressure.indexOf(lane));
    const laneQueue = system.lanes[lane].vehicleCount;
    const phaseEstimate = Math.ceil((MIN_SMART_GREEN_TIME + MAX_SMART_GREEN_TIME) / 2);
    const queueInfluence = Math.ceil(Math.min(24, laneQueue / 35));
    const eta = Math.min(180, Math.max(4, Math.ceil(system.remainingGreen + priorityIndex * phaseEstimate + queueInfluence)));
    return `~${eta}s`;
  };

  const signalColor = (lane) => {
    if (lane !== activeLane) {
      return 'red';
    }
    return system.remainingGreen <= 3 ? 'yellow' : 'green';
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{title}</p>
          <p className="text-sm text-slate-300">{subtitle}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-300">
          Active {LANE_LABELS[activeLane]}
        </div>
      </div>

      <div className="relative h-72 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(3,7,18,0.9),rgba(15,23,42,0.6))] p-4">
        <div className="absolute left-1/2 top-0 h-full w-20 -translate-x-1/2 rounded-xl bg-slate-700/40" />
        <div className="absolute left-0 top-1/2 h-20 w-full -translate-y-1/2 rounded-xl bg-slate-700/40" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-900/80" />

        <LaneSignalBadge
          lane="north"
          color={signalColor('north')}
          queue={system.lanes.north.vehicleCount}
          timer={timerText('north')}
          heavy={highest > 0 && system.lanes.north.vehicleCount === highest}
          className="left-1/2 top-2 -translate-x-1/2"
        />
        <LaneSignalBadge
          lane="south"
          color={signalColor('south')}
          queue={system.lanes.south.vehicleCount}
          timer={timerText('south')}
          heavy={highest > 0 && system.lanes.south.vehicleCount === highest}
          className="bottom-2 left-1/2 -translate-x-1/2"
        />
        <LaneSignalBadge
          lane="west"
          color={signalColor('west')}
          queue={system.lanes.west.vehicleCount}
          timer={timerText('west')}
          heavy={highest > 0 && system.lanes.west.vehicleCount === highest}
          className="left-2 top-1/2 -translate-y-1/2"
        />
        <LaneSignalBadge
          lane="east"
          color={signalColor('east')}
          queue={system.lanes.east.vehicleCount}
          timer={timerText('east')}
          heavy={highest > 0 && system.lanes.east.vehicleCount === highest}
          className="right-2 top-1/2 -translate-y-1/2"
        />
      </div>

      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
        {type === 'normal' ? 'Exact cycle ETA from fixed 20s phase' : 'Dynamic ETA estimate from queue pressure'}
      </p>
    </div>
  );
}

function LaneSignalBadge({ lane, color, queue, timer, heavy, className }) {
  const signalTone =
    color === 'green'
      ? 'bg-emerald-400 shadow-[0_0_16px_rgba(34,197,94,0.6)]'
      : color === 'yellow'
        ? 'bg-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.58)]'
        : 'bg-rose-500 shadow-[0_0_16px_rgba(239,68,68,0.58)]';

  return (
    <div className={`absolute ${className} min-w-[118px] rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 backdrop-blur`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.22em] text-slate-300">{LANE_LABELS[lane]}</span>
        <span className={`h-2.5 w-2.5 rounded-full ${signalTone}`} />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-slate-400">Q {queue}</span>
        <span className="font-semibold text-slate-200">{timer}</span>
      </div>
      {heavy ? <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-rose-300">Highest Traffic</p> : null}
    </div>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  useEffect(() => {
    const interval = window.setInterval(() => dispatch({ type: 'tick' }), 1000 / state.simulationSpeed);
    return () => window.clearInterval(interval);
  }, [state.simulationSpeed]);

  const contextProps = { state, dispatch };

  return (
    <div className="theme-light min-h-screen bg-[#F4F7FB] text-slate-800">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.12),transparent_26%),radial-gradient(circle_at_85%_0%,rgba(34,197,94,0.1),transparent_24%),linear-gradient(180deg,#F8FBFF_0%,#ECF2F8_58%,#E8EFF8_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:48px_48px] opacity-35" />
      <DashboardLayout state={state} dispatch={dispatch}>
        <SimulationContext {...contextProps} />
      </DashboardLayout>
    </div>
  );
}

function DashboardLayout({ state, dispatch, children }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[1900px] flex-col gap-6 px-4 py-4 lg:px-6">
      <Navbar state={state} dispatch={dispatch} />
      <div className="grid flex-1 gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="order-2 xl:order-1">
          <Sidebar state={state} dispatch={dispatch} />
        </aside>
        <main className="order-1 min-w-0 xl:order-2">{children}</main>
      </div>
    </div>
  );
}

function Navbar({ state, dispatch }) {
  const statusTone = state.isRunning ? 'text-emerald-400' : 'text-amber-300';

  return (
    <motion.header
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel sticky top-4 z-20 rounded-3xl px-4 py-3 shadow-xl shadow-slate-300/45 backdrop-blur-2xl"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Smart City Operations</p>
            <h1 className="text-lg font-semibold text-white">Intersection Monitor</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-2xl border border-white/10 bg-slate-950/50 p-1">
            {['normal', 'smart'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => dispatch({ type: 'setMode', value: mode })}
                className={`rounded-xl px-4 py-2 text-sm transition ${
                  state.currentMode === mode ? 'bg-emerald-400 text-slate-950 shadow-neon' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {mode === 'normal' ? 'Normal' : 'Smart'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => dispatch({ type: state.isRunning ? 'pause' : 'start' })}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-700 transition hover:border-slate-300"
          >
            {state.isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {state.isRunning ? 'Pause' : 'Start'}
          </button>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-300">
            Status: <span className={`font-semibold ${statusTone}`}>{state.isRunning ? 'Live' : 'Paused'}</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-300">
            Time: <span className="font-semibold text-slate-700">{roundTime(state.time)}</span>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

function Sidebar({ state, dispatch }) {
  const items = [
    { label: 'Overview', icon: Sparkles },
    { label: 'Simulation', icon: CarFront },
    { label: 'Analytics', icon: Gauge },
    { label: 'Alerts', icon: AlertTriangle },
  ];

  const currentModeLabel = state.currentMode === 'normal' ? 'Fixed Timing' : 'Greedy Adaptive';

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-panel sticky top-24 rounded-3xl p-5 backdrop-blur-2xl"
    >
      <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(245,249,255,0.88))] p-5">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Control Center</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-800">Margadarshaka</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Smart traffic control with glass UI, live telemetry, and side-by-side comparison of fixed versus greedy timing.
        </p>
      </div>

      <nav className="mt-5 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-600 transition hover:border-sky-200 hover:bg-sky-50"
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-sky-500" />
                {item.label}
              </span>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Live</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-5 grid gap-3 rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span>Mode</span>
          <span className="font-semibold text-white">{currentModeLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Peak Hour</span>
          <span className={state.peakHour ? 'text-amber-300' : 'text-slate-500'}>{state.peakHour ? 'On' : 'Off'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Emergency</span>
          <span className={state.emergencyMode ? 'text-rose-300' : 'text-slate-500'}>{state.emergencyMode ? 'Override' : 'Idle'}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: 'reset' })}
        className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white/95"
      >
        Restore Baseline
      </button>
    </motion.div>
  );
}