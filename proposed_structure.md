# Proposed Frontend Structure (Product-Focused)

This document details the recommended component and page structure to implement the "Product-Focused" interface for Moto-Guard IoT.

---

## 1. New Core Components (`src/components/product/`)

- **`MotorcycleDigitalTwin.tsx`**: A centralized visual representation of the motorcycle.
  - *Features*: Interactive hot-spots (click for details), dynamic glow for engine/tires, and real-time orientation (using IMU data for tilt).
- **`HealthScoreGauge.tsx`**: A primary KPI component.
  - *Features*: Animated circular gauge showing the overall health score (0-100%).
- **`LiveSecurityPanel.tsx`**: Status indicator for when the bike is parked.
  - *Features*: "Locked/Unlocked" toggle, "Last Movement" timestamp, and "Quick Alert" button.
- **`AdventureCard.tsx`**: For the trip feed.
  - *Features*: Mini-map thumbnail, safety score badge, and category (Commute/Track/Tour).
- **`InteractiveRideTimeline.tsx`**: For post-ride analysis.
  - *Features*: A synchronized scrubber that links map, charts, and video (if available).

---

## 2. Page-Specific Enhancements

### **Dashboard (Refactored)**
- **Top Row**: Primary KPIs (Speed, Health Score, Battery).
- **Center**: `MotorcycleDigitalTwin` taking up 60% of the screen.
- **Bottom Row**: Quick Stats (Tire Pressure, Oil Pressure, Current Trip Distance).
- **Sidebar (Right)**: Real-time Alert Feed (replacing the technical simulator log).

### **Garage (New Page: `/garage`)**
- **Bike Selector**: Horizontal carousel of owned motorcycles.
- **Specs Overview**: Brand, Model, Year, VIN (optional), and current Odometer.
- **Maintenance Center**: "Next Service" countdown, oil life estimator, and service history log.
- **Device Management**: Pairing/Unpairing the IoT hardware and checking its firmware version.

### **Adventures (Enhanced `/trips`)**
- **Filter Bar**: Search by date range, category, or safety score.
- **Feed View**: A modern, infinite-scroll list of `AdventureCard` components.
- **Global Stats**: "Total Kilometers This Month", "Average Safety Score", and "Most Visited Locations".

### **Post-Ride Analysis (Refined `/trips/:id`)**
- **Map Focus**: Larger map with path-specific coloring (e.g., color by speed or lean angle).
- **Event Highlights**: Small icons on the map (Braking, Lean, Heat). Clicking opens a detail tooltip.
- **Insight Cards**: "Top Speed achieved at...", "Maximum Lean Angle of...", "Efficiency was...".
- **Social Sharing Utility**: A "Snapshot" tool to create a shareable summary image.

---

## 3. Thematic Improvements

- **Animations**: Use `framer-motion` for smooth transitions between pages and for gauge animations.
- **Micro-interactions**: Subtle hover effects on bike parts and map markers.
- **Responsive Layout**: Prioritize a "Mobile-First" approach for the Dashboard (since users check it on their phone next to the bike).

---

## 4. Implementation Strategy

1. **Phase 1: Component Library**: Build the new `product/` components alongside the existing ones.
2. **Phase 2: Layout Refactor**: Update `Layout.tsx` to support the new sidebar and header styles.
3. **Phase 3: Page Migration**: One by one, replace the "Simulator-centric" pages with the new "Product-centric" ones.
4. **Phase 4: Data Integration**: Connect the new components to the existing InfluxDB and PostgreSQL APIs.
