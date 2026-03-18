# Moto-Guard IoT: Interface & Experience Plan

This document outlines the strategic plan for the Moto-Guard IoT platform's user interface. The goal is to transition from a simulator-centric dashboard to a product-focused experience that serves motorcycle owners in their daily rides and security needs.

---

## 1. Visual Identity & Design System

### **Core Aesthetic**
- **Dark Mode by Default**: Deep grays and blacks for a premium, automotive feel.
- **High-Contrast Accents**:
  - **Electric Blue**: Primary actions and connectivity status.
  - **Safety Orange**: Alerts, warnings, and critical data.
  - **Neon Green**: Success, healthy status, and efficiency.
- **Typography**: Clean, sans-serif fonts (e.g., Inter or Roboto) for high legibility at a glance.

### **Iconography**
- Custom SVG icons for motorcycle components: Helmet (Profile), Gas Pump (Fuel/Range), Oil Can (Engine Health), Kickstand (Side-stand Status).

---

## 2. Page Architecture & Features

### **A. Unified Dashboard (The "Command Center")**
*The current Dashboard is card-heavy. The new version will prioritize the motorcycle's "Digital Twin".*

- **Visual State**: A centralized 3D or schematic view of the motorcycle. Parts highlight based on real-time data (e.g., engine glows orange when hot).
- **Primary Gauges**: A large, circular Speed/RPM combo with integrated gear indicator.
- **Safety Hub**: Quick-toggle icons for ABS, TC, Side Stand, and Tilt status.
- **Health Snapshot**: "Health Score" (0-100%) based on battery, engine temp, and tire pressure.
- **Active Map**: A mini-map showing the current session's path, with a button to expand for navigation or full-screen tracking.

### **B. The "Garage" (Motorcycle Management)**
*Moving beyond just a list of bikes.*

- **My Bikes**: A carousel of the user's motorcycles with high-quality images.
- **Service Hub**: Track mileage vs. service intervals (e.g., "Next Oil Change in 1,200 km").
- **Hardware Status**: Connection strength and battery level of the Moto-Guard IoT device.
- **Custom Thresholds**: User-defined alerts (e.g., "Notify me if the bike moves more than 10 meters when locked").

### **C. Adventures & Trips (Ride History)**
*Transforming a list of files into a social and analytical feed.*

- **Ride Feed**: Cards for each trip with a thumbnail map, date, and "Ride Score".
- **Category Badges**: Automatic labeling (Commute, Weekend Ride, Track Day, Off-road).
- **Quick Comparison**: Compare the current ride's efficiency or speed with the previous one on the same route.

### **D. Post-Ride Deep Dive (Analysis)**
*Detailed data for enthusiasts.*

- **Interactive Timeline**: A slider that moves both the map marker and the chart cursors simultaneously.
- **Event Highlights**: Visual markers on the map for "Hard Braking", "Max Lean Angle", or "Speed Alerts".
- **Safety & Performance Insights**:
  - "Smoothness": Score based on G-force spikes.
  - "Cornering": Analysis of lean angle vs. speed.
  - "Engine Health": Review of temp and oil pressure during the ride.
- **Export & Share**: Generate a "Ride Summary Card" (Image with stats and map) for social sharing.

### **E. Security & Alerts Center**
*Dedicated space for what matters most.*

- **Live Security Feed**: If the bike is parked, show its location and "Locked" status prominently.
- **Alert History**: A log of all security events (Movement detected, Tilt alert, Low battery).
- **Emergency Contact Management**: Setup for automatic SMS/Email alerts in case of a crash.

---

## 3. Interaction Design (UX)

- **One-Handed Navigation**: Ensure primary buttons on mobile are reachable with a thumb.
- **Haptic Feedback**: Use subtle vibrations (on mobile) for critical alerts.
- **Glanceability**: Important data (Speed, Temperature, Alerts) should be readable in < 1 second.
- **Dynamic Contexts**: The UI should shift between "Ride Mode" (High contrast, large text) and "Analysis Mode" (Detailed charts, interactive maps).

---

## 4. Transition from Simulator

The **Simulator** remains a powerful tool for:
1. **Developer Testing**: Forcing edge cases (Crashes, Overheating) to test UI responses.
2. **User Education**: A "Demo Mode" where new users can explore the app's features using simulated data.
3. **QA**: Verifying the heuristic engine's accuracy across different motorcycle profiles.

*In the final product, the Simulator toggle will be moved to a "Developer/Debug" menu, hidden from the standard user.*
