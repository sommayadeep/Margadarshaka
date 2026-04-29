<div align="center">

# 🚦 Margadarshaka

### Smart Traffic Optimization Dashboard

**Margadarshaka** (मार्गदर्शक) — *Guide* in Sanskrit

A real-time 4-way intersection simulator that compares fixed-timing traffic signals against a greedy adaptive algorithm — visualizing efficiency gains through live analytics, emergency priority handling, and interactive controls.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-margadarshaka.vercel.app-brightgreen?style=for-the-badge&logo=vercel)](https://margadarshaka.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-sommayadeep%2FMargadarshaka-blue?style=for-the-badge&logo=github)](https://github.com/sommayadeep/Margadarshaka)

</div>

---

## 📖 About

Urban traffic congestion leads to wasted time, higher emissions, and delayed emergency response. **Margadarshaka** simulates a 4-way intersection and demonstrates — visually and statistically — how a greedy adaptive algorithm outperforms conventional fixed-cycle traffic signals.

The dashboard lets you observe both strategies running simultaneously, interact with traffic conditions in real time, and understand the measurable impact of smarter signal control.

---

## ✨ Features

### 🛣️ Intersection Simulation
- Animated 4-way intersection with live vehicle flow across North, South, East, and West lanes
- Vehicles queue, wait, and clear dynamically based on the active algorithm

### 📊 Real-Time Analytics
- Average waiting time per vehicle
- Queue length per lane
- Total throughput (vehicles cleared per cycle)
- Congestion level indicators

### 🔄 Algorithm Comparison Mode
- Run **Fixed Timing** and **Greedy Algorithm** side by side
- Watch efficiency stats diverge in real time as traffic builds up

### 🚨 Emergency Vehicle Priority
- Trigger an emergency vehicle (ambulance / fire truck) on any lane
- The system immediately overrides the active cycle, clears the lane, then resumes normal operation

### 🎛️ Interactive Controls
- Adjust traffic density (light → heavy)
- Control simulation speed
- Manually trigger signal changes
- Switch between algorithms on the fly

---

## 🧠 Algorithms

### Fixed Timing
Each direction receives a green signal for a fixed pre-set duration, cycling through all four lanes regardless of actual queue length. Predictable, but inefficient under uneven traffic loads.

### Greedy Algorithm
At every signal decision point, the algorithm scans all four lanes and grants green to the lane with the **longest current queue**. This greedy selection minimises maximum wait time and clears congestion faster — especially effective during peak or asymmetric traffic conditions.

### Emergency Priority
When an emergency vehicle is detected in any lane, normal scheduling is suspended. That lane immediately receives a green signal and holds it until the vehicle clears, after which the algorithm resumes from where it left off.

---

## 🗂️ Project Structure

```
Margadarshaka/
├── public/                 # Static assets
├── src/
│   ├── components/         # UI components (intersection, controls, charts)
│   ├── algorithms/         # Fixed timing & greedy algorithm logic
│   ├── simulation/         # Vehicle generation, queue management, tick engine
│   ├── analytics/          # Metrics calculation and stat tracking
│   └── App.jsx             # Root component
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v16 or later
- npm or yarn

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/sommayadeep/Margadarshaka.git

# 2. Enter the project directory
cd Margadarshaka

# 3. Install dependencies
npm install

# 4. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

---

## 🎮 How to Use

| Step | Action |
|------|--------|
| 1 | Click **Start** to begin the simulation |
| 2 | Use the **density slider** to set traffic volume |
| 3 | Enable **Comparison Mode** to run both algorithms simultaneously |
| 4 | Press **Emergency** to dispatch a priority vehicle and observe preemption |
| 5 | Watch the **analytics panel** to see real-time performance differences |

---

## 📈 Metrics Explained

| Metric | Description |
|--------|-------------|
| **Avg. Wait Time** | Mean seconds a vehicle spends queued before clearing the intersection |
| **Max Queue Length** | Longest lane queue observed during the simulation |
| **Throughput** | Number of vehicles that successfully cleared the intersection per minute |
| **Congestion Index** | Composite score of current lane saturation across all four directions |

---

## 🌐 Live Demo

> **[https://margadarshaka.vercel.app](https://margadarshaka.vercel.app)**

No installation required — open the link and start the simulation directly in your browser.

---

## 🤝 Contributing

Contributions are welcome! If you'd like to improve the simulation engine, add new algorithms, or enhance the UI:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source. See the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with by [sommayadeep](https://github.com/sommayadeep)

</div>
