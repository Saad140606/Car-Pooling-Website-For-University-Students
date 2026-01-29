# Analytics Dashboard - Complete Implementation Guide

## 📊 Overview

This document provides comprehensive documentation for the Campus Ride Analytics Dashboard system, featuring separate dashboards for FAST and NED portals with premium UI/UX, smooth animations, and interactive data visualization.

## 🎯 Features

### Core Capabilities
- **Dual Portal Support**: Separate dashboards for FAST and NED universities
- **Real-time Metrics**: Live user, ride, engagement, and report statistics
- **Interactive Charts**: Area charts, pie charts, progress circles, heatmaps
- **Advanced Filtering**: Date ranges, ride types, user types, status filters
- **Animated Counters**: Numbers animate from 0 to actual value
- **Responsive Design**: Full mobile, tablet, and desktop support
- **Export Functionality**: Download data in various formats
- **Auto-refresh**: Real-time data updates with loading states

### Analytics Categories

#### 1. User Analytics
- Total users count with growth trend
- Active users in the current period
- New signups with comparison
- Weekly user activity chart
- Growth rate percentage

#### 2. Ride Analytics
- Total ride requests
- Completed rides count
- Pending rides count
- Cancelled rides count
- Ride distribution pie chart
- Completion rate progress circle

#### 3. Engagement Metrics
- Total page views with trend
- Average session duration
- Most popular pages with bar charts
- Weekly page views area chart
- User engagement rates

#### 4. Reports & Issues
- Total reports count
- Pending reports
- Resolved reports
- Rejected reports
- Report categories pie chart
- Priority alerts

#### 5. Activity Heatmap
- Day-by-day activity visualization
- Hour-by-hour ride requests
- Peak time identification
- Interactive tooltips

#### 6. Recent Rides Table
- Latest ride information
- Status-based filtering
- Sortable columns
- Driver and route details

## 📁 File Structure

```
src/
├── app/analytics/
│   ├── fast/
│   │   └── page.tsx              # FAST University dashboard
│   └── ned/
│       └── page.tsx              # NED University dashboard
└── components/analytics/
    ├── AnalyticsLayout.tsx       # Shared layout with filters
    └── AnalyticsCharts.tsx       # Reusable chart components
```

## 🎨 Design System

### Color Palette

#### FAST Portal (Primary Blue)
```css
Primary: #3F51B5 (Indigo)
Accent: #5C6BC0 (Light Indigo)
Success: #10b981 (Green)
Warning: #f59e0b (Amber)
Error: #ef4444 (Red)
Info: #3b82f6 (Blue)
```

#### NED Portal (Purple)
```css
Primary: #9333ea (Purple)
Accent: #a855f7 (Light Purple)
Success: #10b981 (Green)
Warning: #f59e0b (Amber)
Error: #ef4444 (Red)
Info: #3b82f6 (Blue)
```

#### Shared Colors
```css
Background: #21243D (Dark Slate)
Card: #2A2D47 (Card Background)
Border: rgba(255, 255, 255, 0.1)
Text Primary: #ffffff
Text Secondary: rgba(255, 255, 255, 0.8)
Text Muted: rgba(255, 255, 255, 0.6)
```

### Typography
- **Headlines**: Space Grotesk, Bold, 24-32px
- **Body**: Inter, Regular, 14-16px
- **Labels**: Inter, Medium, 12-14px
- **Numbers**: JetBrains Mono, Tabular, Bold

### Spacing Scale
- **4px**: Tight spacing (gaps, padding)
- **8px**: Comfortable spacing (card padding)
- **16px**: Section spacing
- **24px**: Component spacing
- **32px**: Page section spacing

## 🧩 Component Reference

### 1. AnalyticsLayout

Shared layout component providing consistent header, filters, and date pickers.

#### Props
```typescript
interface AnalyticsLayoutProps {
  children: React.ReactNode;
  title: string;
  portalName: "FAST" | "NED";
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  filters?: {
    label: string;
    options: FilterOption[];
    selected: string[];
    onChange: (selected: string[]) => void;
  }[];
  isLoading?: boolean;
}
```

#### Usage Example
```tsx
<AnalyticsLayout
  title="FAST Analytics Dashboard"
  portalName="FAST"
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
  onRefresh={handleRefresh}
  onExport={handleExport}
  isLoading={false}
  filters={[
    {
      label: "Ride Type",
      options: [
        { id: "shared", label: "Shared", value: "shared" },
        { id: "private", label: "Private", value: "private" },
      ],
      selected: filters.rideType,
      onChange: (selected) => setFilters({ ...filters, rideType: selected }),
    },
  ]}
>
  {/* Dashboard content */}
</AnalyticsLayout>
```

#### Date Presets
- Today (0 days)
- Last 7 Days
- Last 30 Days
- Last 90 Days
- This Year (365 days)

### 2. AnimatedCounter

Animates numbers from 0 to target value with easing.

#### Props
```typescript
interface AnimatedCounterProps {
  end: number;
  duration?: number;        // Default: 2000ms
  prefix?: string;          // e.g., "$"
  suffix?: string;          // e.g., "%"
  decimals?: number;        // Default: 0
  className?: string;
}
```

#### Usage Example
```tsx
<AnimatedCounter
  end={2547}
  duration={2000}
  prefix=""
  suffix=" users"
  decimals={0}
  className="text-3xl font-bold"
/>
```

#### Animation Details
- **Easing**: Ease-out-quart for smooth deceleration
- **Duration**: 2 seconds (default)
- **Performance**: Uses requestAnimationFrame
- **Accessibility**: Final value is always rendered

### 3. AnimatedAreaChart

Smooth area chart with gradient fill and animated data points.

#### Props
```typescript
interface AreaChartProps {
  data: { label: string; value: number }[];
  height?: number;          // Default: 200px
  color?: string;           // Default: "#3F51B5"
  gradientFrom?: string;    // Default: "rgba(63, 81, 181, 0.4)"
  gradientTo?: string;      // Default: "rgba(63, 81, 181, 0.05)"
  showGrid?: boolean;       // Default: true
  showDots?: boolean;       // Default: true
  animate?: boolean;        // Default: true
}
```

#### Usage Example
```tsx
<AnimatedAreaChart
  data={[
    { label: "Mon", value: 320 },
    { label: "Tue", value: 380 },
    { label: "Wed", value: 410 },
    { label: "Thu", value: 390 },
    { label: "Fri", value: 450 },
    { label: "Sat", value: 380 },
    { label: "Sun", value: 340 },
  ]}
  height={250}
  color="#3F51B5"
  showGrid={true}
  showDots={true}
/>
```

#### Features
- SVG-based rendering for crisp graphics
- Gradient area fill
- Grid lines for reference
- Animated data points with glow effect
- Responsive labels
- 1-second entrance animation

### 4. AnimatedPieChart

Pie/donut chart with slice animations and legend.

#### Props
```typescript
interface PieChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;            // Default: 200px
  showLegend?: boolean;     // Default: true
  showPercentages?: boolean; // Default: true
  animate?: boolean;        // Default: true
}
```

#### Usage Example
```tsx
<AnimatedPieChart
  data={[
    { label: "Completed", value: 1234, color: "#10b981" },
    { label: "Pending", value: 98, color: "#f59e0b" },
    { label: "Cancelled", value: 124, color: "#ef4444" },
  ]}
  size={200}
  showLegend={true}
  showPercentages={true}
/>
```

#### Features
- Smooth slice entrance animations
- Color-coded legend with percentages
- Hover effects on slices
- Drop shadow for depth
- Responsive grid legend layout

### 5. MetricCard

Stat card with icon, value, trend indicator, and animations.

#### Props
```typescript
interface MetricCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  trend?: number;           // Percentage change
  trendLabel?: string;      // Default: "vs last period"
  icon?: React.ReactNode;
  color?: "primary" | "success" | "warning" | "error" | "info" | "purple";
  animate?: boolean;        // Default: true
  subtitle?: string;
}
```

#### Usage Example
```tsx
<MetricCard
  title="Total Users"
  value={2547}
  icon={<Users />}
  color="primary"
  trend={12.5}
  trendLabel="vs last period"
  subtitle="Active accounts"
/>
```

#### Features
- Gradient backgrounds based on color
- Animated counter for numeric values
- Trend arrows (up/down/neutral)
- Icon with colored background
- Hover scale effect
- Subtle glow on hover

### 6. ProgressCircle

Circular progress indicator with center text.

#### Props
```typescript
interface ProgressCircleProps {
  percentage: number;       // 0-100
  size?: number;            // Default: 120px
  strokeWidth?: number;     // Default: 8px
  color?: string;           // Default: "#3F51B5"
  label?: string;
  sublabel?: string;
  animate?: boolean;        // Default: true
}
```

#### Usage Example
```tsx
<ProgressCircle
  percentage={84.7}
  size={180}
  color="#10b981"
  label="Success Rate"
  sublabel="Based on all rides"
/>
```

#### Features
- SVG circle with smooth animation
- 1-second fill animation
- Background circle for context
- Center percentage display
- Optional labels below circle

### 7. Sparkline

Compact inline line chart for trends.

#### Props
```typescript
interface SparklineProps {
  data: number[];
  width?: number;           // Default: 100px
  height?: number;          // Default: 30px
  color?: string;           // Default: "#3F51B5"
  showArea?: boolean;       // Default: true
}
```

#### Usage Example
```tsx
<Sparkline
  data={[45, 52, 38, 65, 72, 80, 75]}
  width={100}
  height={30}
  color="#3F51B5"
  showArea={true}
/>
```

#### Features
- Minimal inline rendering
- Optional area fill
- Auto-scales to data range
- Smooth line rendering
- Compact size for metric cards

### 8. Heatmap

Activity heatmap showing day-by-day and hour-by-hour patterns.

#### Props
```typescript
interface HeatmapProps {
  data: { day: string; hour: number; value: number }[];
  maxValue?: number;
  color?: string;           // Default: "#3F51B5"
}
```

#### Usage Example
```tsx
<Heatmap
  data={[
    { day: "Mon", hour: 8, value: 45 },
    { day: "Mon", hour: 9, value: 52 },
    { day: "Mon", hour: 17, value: 68 },
    // ... more data
  ]}
  color="#3F51B5"
/>
```

#### Features
- 7 days × 24 hours grid
- Color intensity based on value
- Hover tooltips with exact values
- Staggered entrance animations
- Responsive to container width
- Hour labels at 0, 6, 12, 18, 23

## 🎬 Animation System

### Entrance Animations

All components use consistent entrance animations:

```css
/* Scale up entrance */
.animate-scale-up {
  animation: scale-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Fade and slide up */
.animate-fade-slide-up {
  animation: fade-slide-up 0.5s ease-out;
}

/* Slide down (dropdowns) */
.animate-slide-down {
  animation: slide-down 0.3s ease-out;
}

/* Bounce in (badges) */
.animate-bounce-in {
  animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

### Staggered Animations

For lists and grids, use the stagger pattern:

```tsx
{items.map((item, idx) => (
  <div
    key={idx}
    className="stagger-item"
    style={{ animationDelay: `${idx * 80}ms` }}
  >
    {/* Item content */}
  </div>
))}
```

**Stagger Timing**: 80ms increments (optimal perceived performance)

### Chart Animations

All charts animate on load with 1-second durations:

- **Area Charts**: Line and fill animate together
- **Pie Charts**: Slices animate sequentially
- **Progress Circles**: Stroke animates from 0 to percentage
- **Counters**: Ease-out-quart from 0 to value

## 🔧 Integration Guide

### Step 1: Install Dependencies

No external chart libraries required. Uses:
- React 18+
- Lucide React (icons)
- Tailwind CSS

### Step 2: Import Components

```tsx
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import {
  MetricCard,
  AnimatedAreaChart,
  AnimatedPieChart,
  ProgressCircle,
  Heatmap,
} from "@/components/analytics/AnalyticsCharts";
```

### Step 3: Set Up State

```tsx
const [dateRange, setDateRange] = useState<DateRange>({
  from: new Date(new Date().setDate(new Date().getDate() - 7)),
  to: new Date(),
  preset: "Last 7 Days",
});

const [filters, setFilters] = useState({
  rideType: [] as string[],
  userType: [] as string[],
  status: [] as string[],
});

const [isLoading, setIsLoading] = useState(false);
```

### Step 4: Fetch Data from Firebase

```tsx
useEffect(() => {
  const fetchAnalytics = async () => {
    setIsLoading(true);
    
    try {
      const db = getFirestore();
      
      // Fetch users
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const totalUsers = usersSnapshot.size;
      
      // Fetch rides
      const ridesRef = collection(db, "rides");
      const ridesSnapshot = await getDocs(ridesRef);
      const rides = ridesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const completedRides = rides.filter(r => r.status === "completed").length;
      const pendingRides = rides.filter(r => r.status === "pending").length;
      const cancelledRides = rides.filter(r => r.status === "cancelled").length;
      
      // Update state with real data
      setAnalyticsData({
        users: { total: totalUsers, /* ... */ },
        rides: { completed: completedRides, /* ... */ },
        // ... more data
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  fetchAnalytics();
}, [dateRange, filters]);
```

### Step 5: Render Dashboard

```tsx
return (
  <AnalyticsLayout
    title="FAST Analytics Dashboard"
    portalName="FAST"
    dateRange={dateRange}
    onDateRangeChange={setDateRange}
    onRefresh={handleRefresh}
    onExport={handleExport}
    isLoading={isLoading}
    filters={filterConfig}
  >
    {/* Your metric cards and charts */}
  </AnalyticsLayout>
);
```

## 📊 Data Structure Examples

### User Analytics Data
```typescript
{
  users: {
    total: 2547,
    active: 1823,
    newSignups: 234,
    growth: 12.5,
    weeklyData: [
      { label: "Mon", value: 320 },
      { label: "Tue", value: 380 },
      // ... rest of week
    ],
  }
}
```

### Ride Analytics Data
```typescript
{
  rides: {
    requested: 1456,
    completed: 1234,
    pending: 98,
    cancelled: 124,
    completionRate: 84.7,
    distribution: [
      { label: "Completed", value: 1234, color: "#10b981" },
      { label: "Pending", value: 98, color: "#f59e0b" },
      { label: "Cancelled", value: 124, color: "#ef4444" },
    ],
  }
}
```

### Heatmap Data
```typescript
{
  heatmap: [
    { day: "Mon", hour: 8, value: 45 },
    { day: "Mon", hour: 9, value: 52 },
    { day: "Mon", hour: 17, value: 68 },
    // ... more entries
  ]
}
```

## 🎯 Best Practices

### Performance Optimization

1. **Lazy Load Charts**: Load charts only when visible
2. **Memo Components**: Use React.memo for static charts
3. **Debounce Filters**: Debounce filter changes to reduce re-renders
4. **Virtual Scrolling**: Use for large data tables
5. **SVG Optimization**: Keep SVG paths minimal

### Accessibility

1. **Keyboard Navigation**: All filters and buttons are keyboard-accessible
2. **ARIA Labels**: All interactive elements have proper labels
3. **Color Contrast**: Meets WCAG 2.1 AA standards
4. **Screen Readers**: Chart data is available in accessible tables
5. **Focus Indicators**: Clear focus states on all interactive elements

### Responsive Design

```tsx
// Mobile-first grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Metric cards */}
</div>

// Responsive chart heights
<AnimatedAreaChart
  data={data}
  height={window.innerWidth < 768 ? 200 : 250}
/>
```

### Error Handling

```tsx
try {
  const data = await fetchAnalytics();
  setAnalyticsData(data);
} catch (error) {
  console.error("Failed to fetch analytics:", error);
  
  // Show error notification
  toast({
    title: "Error",
    description: "Failed to load analytics data. Please try again.",
    variant: "error",
  });
}
```

## 🚀 Advanced Features

### Real-time Updates

```tsx
useEffect(() => {
  const db = getFirestore();
  const ridesRef = collection(db, "rides");
  
  // Subscribe to real-time updates
  const unsubscribe = onSnapshot(ridesRef, (snapshot) => {
    const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateRideMetrics(rides);
  });
  
  return () => unsubscribe();
}, []);
```

### Export Functionality

```tsx
const handleExport = () => {
  const csv = convertToCSV(analyticsData);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `analytics-${portalName}-${new Date().toISOString()}.csv`;
  link.click();
  
  URL.revokeObjectURL(url);
};
```

### Custom Date Ranges

```tsx
const handleCustomDateRange = (from: Date, to: Date) => {
  if (to < from) {
    toast({
      title: "Invalid Date Range",
      description: "End date must be after start date.",
      variant: "error",
    });
    return;
  }
  
  setDateRange({ from, to, preset: undefined });
};
```

## 📝 Example: Complete Dashboard Page

```tsx
"use client";

import { useState, useEffect } from "react";
import { Users, Car, Eye } from "lucide-react";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import {
  MetricCard,
  AnimatedAreaChart,
  AnimatedPieChart,
} from "@/components/analytics/AnalyticsCharts";

export default function CustomAnalyticsPage() {
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
    preset: "Last 7 Days",
  });
  
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);
  
  const fetchAnalytics = async () => {
    setIsLoading(true);
    // Fetch your data here
    setIsLoading(false);
  };
  
  return (
    <AnalyticsLayout
      title="Custom Analytics"
      portalName="FAST"
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      onRefresh={fetchAnalytics}
      isLoading={isLoading}
    >
      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">
          Overview
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <MetricCard
            title="Total Users"
            value={2547}
            icon={<Users />}
            color="primary"
            trend={12.5}
          />
          <MetricCard
            title="Total Rides"
            value={1456}
            icon={<Car />}
            color="success"
          />
          <MetricCard
            title="Page Views"
            value={15420}
            icon={<Eye />}
            color="info"
            trend={8.7}
          />
        </div>
        
        <div className="bg-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Weekly Activity
          </h3>
          <AnimatedAreaChart
            data={weeklyData}
            height={250}
            color="#3F51B5"
          />
        </div>
      </section>
    </AnalyticsLayout>
  );
}
```

## 🎨 Customization

### Custom Colors

```tsx
// Override portal colors in AnalyticsLayout
const customColors = {
  primary: "from-blue-600 to-blue-500",
  badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};
```

### Custom Chart Colors

```tsx
<AnimatedAreaChart
  data={data}
  color="#FF5733"
  gradientFrom="rgba(255, 87, 51, 0.4)"
  gradientTo="rgba(255, 87, 51, 0.05)"
/>
```

### Custom Metric Icons

```tsx
import { CustomIcon } from "lucide-react";

<MetricCard
  title="Custom Metric"
  value={1234}
  icon={<CustomIcon />}
  color="primary"
/>
```

## 🐛 Troubleshooting

### Charts Not Animating

**Issue**: Charts appear instantly without animation

**Solution**: Ensure `animate={true}` prop is set and component is mounted

```tsx
<AnimatedAreaChart
  data={data}
  animate={true}  // Make sure this is true
/>
```

### Counter Not Starting from 0

**Issue**: Counter shows final value immediately

**Solution**: Ensure component has proper key to trigger re-mount on data change

```tsx
<AnimatedCounter
  key={`counter-${value}`}  // Unique key triggers re-animation
  end={value}
/>
```

### Filters Not Working

**Issue**: Filter changes don't update dashboard

**Solution**: Ensure filter state is passed to data fetching logic

```tsx
useEffect(() => {
  fetchAnalytics();
}, [dateRange, filters]);  // Include filters in dependencies
```

### Layout Overflow on Mobile

**Issue**: Content overflows on small screens

**Solution**: Use responsive classes and overflow handling

```tsx
<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* Table content */}
  </table>
</div>
```

## 📦 Bundle Size

Estimated component sizes (gzipped):

- **AnalyticsCharts.tsx**: ~12 KB
- **AnalyticsLayout.tsx**: ~8 KB
- **Dashboard Page**: ~15 KB
- **Total Analytics System**: ~35 KB

**Optimization Tips**:
- Tree-shake unused chart types
- Code-split dashboard pages
- Lazy load heavy components

## 🔒 Security Considerations

### Data Access Control

```tsx
// Verify user permissions before showing analytics
const canViewAnalytics = await checkUserPermission(userId, "view_analytics");

if (!canViewAnalytics) {
  return <UnauthorizedPage />;
}
```

### API Rate Limiting

```tsx
// Implement rate limiting for data fetching
const rateLimiter = new RateLimiter({ maxRequests: 10, perMinutes: 1 });

const fetchAnalytics = async () => {
  if (!rateLimiter.canMakeRequest()) {
    toast({ title: "Too many requests", variant: "error" });
    return;
  }
  
  // Fetch data
};
```

## 📈 Future Enhancements

Potential improvements for future versions:

1. **Real-time Streaming**: WebSocket integration for live updates
2. **Custom Dashboards**: User-configurable widget layouts
3. **Advanced Filtering**: Query builder interface
4. **Data Comparison**: Side-by-side period comparison
5. **Scheduled Reports**: Email delivery of analytics
6. **PDF Export**: Generate printable reports
7. **Mobile App**: Native mobile analytics viewer
8. **AI Insights**: Automated trend detection and recommendations

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Lucide Icons](https://lucide.dev)
- [Firebase Analytics](https://firebase.google.com/docs/analytics)
- [D3.js Alternatives](https://github.com/d3/d3/wiki#alternatives)

## 🤝 Contributing

When contributing new chart types or features:

1. Follow existing naming conventions
2. Include TypeScript types
3. Add animations with consistent timing
4. Ensure accessibility compliance
5. Document new props and usage
6. Add examples to this documentation

## 📞 Support

For questions or issues:
- Check this documentation first
- Review existing dashboard implementations
- Test with mock data before integrating Firebase
- Verify animation classes are available in globals.css

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Author**: GitHub Copilot
**License**: MIT
