# Campus Ride Animation Framework: Visual Guide

## 🎨 Animation Categories

### 1. ENTRANCE ANIMATIONS

#### Bounce-In
```
Duration: 600ms | Easing: cubic-bezier(0.34, 1.56, 0.64, 1)
Used For: Cards, modals, main content sections
Effect: Element scales from 0.3 to 1 with bounce back
```
```tsx
<AnimatedCard animation="bounce-in">Content</AnimatedCard>
```

#### Scale-Up
```
Duration: 400ms | Easing: ease-out
Used For: Buttons, images, emphasis elements
Effect: Smooth scale from 0.95 to 1 with fade-in
```

#### Slide-In-Left
```
Duration: 500ms | Easing: ease-out
Used For: Sidebars, side panels, list items
Effect: Content slides in from left edge
```

#### Flip-In
```
Duration: 600ms | Easing: ease-out
Used For: Cards, containers, special reveals
Effect: 3D perspective flip from 90° to 0°
```

#### Rotate-In
```
Duration: 500ms | Easing: ease-out
Used For: Icons, badges, accent elements
Effect: Rotates -6° with scale-in to full size
```

---

### 2. HOVER & INTERACTION EFFECTS

#### Hover-Card-Lift
```
Transform: translateY(-6px)
Duration: 250ms | Easing: ease
Shadow: 0 10px 40px rgba(0, 0, 0, 0.3)
Used For: All interactive cards
```
```tsx
<div className="hover-card-lift">Card content</div>
```

#### Hover-Glow
```
Box-Shadow: 0 0 20px rgba(63, 81, 181, 0.4)
Duration: 250ms | Easing: ease
Used For: Primary buttons, action elements
```

#### Hover-Grow
```
Transform: scale(1.05)
Duration: 250ms | Easing: ease
Used For: Small interactive elements, icons
```

#### Button Press (btn-press)
```
On Active: scale(0.98)
Duration: 100ms | Easing: cubic-bezier(0.4, 0, 1, 1)
Creates tactile feedback on click
```

---

### 3. FORM ANIMATIONS

#### Input-Focus
```
Ring: 0 0 0 3px rgba(63, 81, 181, 0.1), 0 0 0 2px rgba(63, 81, 181, 0.5)
Border: border-primary/60
Duration: 250ms
Used For: All input fields
```

#### Input-Error-Shake
```
Keyframes: shake (±4px oscillation)
Duration: 500ms | Easing: ease-in-out
Used For: Validation errors
```

#### Input-Success
```
Animation: scale-up (0.4s ease-out)
Color: text-primary, bg-primary/5
Used For: Valid field confirmation
```

---

### 4. CONTINUOUS ANIMATIONS

#### Float
```
Duration: 3s | Easing: ease-in-out
Transform: translateY(-10px) then back
Used For: Decorative elements, icons in emphasis
```

#### Subtle-Bounce
```
Duration: 2s | Easing: ease-in-out
Transform: ±4px vertical bounce
Used For: CTA buttons, notification badges
```

#### Pulse-Glow
```
Duration: 2s (infinite)
Effect: Box-shadow pulsing from 0 to 10px
Used For: Loading states, active indicators
```

#### Shimmer (Skeleton)
```
Duration: 2s (infinite)
Background gradient sweeps left-to-right
Used For: Loading placeholders
```

---

### 5. STAGGERED ANIMATIONS

#### List Item Stagger
```
Base delay: 0ms
Increment: 80ms per item
Max items: 8+ (can stack)
```
```tsx
{items.map((item, idx) => (
  <AnimatedCard delay={idx as any} key={item.id}>
    {item.content}
  </AnimatedCard>
))}
// Item 0: 0ms   delay
// Item 1: 80ms  delay
// Item 2: 160ms delay
// etc.
```

---

### 6. PAGE TRANSITIONS

#### Fade-Slide-Up
```
Duration: 800ms | Easing: ease-out
Opacity: 0 → 1
Transform: translateY(18px) → 0
Used For: Page-level entrance
```

#### Page-Rise
```
Duration: 600ms | Easing: ease-out
Opacity: 0 → 1
Transform: translateY(12px) → 0
Used For: Full page load
```

---

## 📊 Animation Timing Cheat Sheet

```
FAST (100-150ms):
  - Button press feedback
  - Hover state changes
  - Icon transitions
  
MEDIUM (200-300ms):
  - Form interactions
  - Focus transitions
  - Hover lifting
  
STANDARD (300-600ms):
  - Card entrances
  - Modal animations
  - Page transitions
  
SLOW (1-2s):
  - Loading spinners
  - Continuous animations
  - Scroll reveals
```

---

## 🎯 COMPONENT ANIMATION MAP

### AnimatedButton
```
Entrance: None (instant)
On Hover:  Glow + shadow (250ms)
On Active: Scale 0.98 (100ms)
On Focus:  Ring animation
Disabled:  Opacity 0.5
```

### AnimatedInput
```
Entrance: None
On Focus:  Ring + border (250ms)
On Error:  Shake animation (500ms)
On Success: Scale-up + color (400ms)
```

### AnimatedCard
```
Entrance: Bounce-in | Scale-up | Flip-in (400-600ms)
On Hover:  Card-lift (250ms)
Stagger:   Configurable delay
```

### AnimatedRideCard
```
Entrance: Bounce-in (400ms)
On Hover:  Lift + glow shadow (300ms)
Price:     Scale 1.05 (300ms)
View BTN:  Icon float (continuous)
Book BTN:  Gradient + glow (300ms)
```

### Skeleton Loaders
```
Animation: Shimmer (2s infinite)
Stagger:   80ms between items
Effect:    Gradient sweep left-to-right
```

### CountdownTimer
```
Timer Value: Updates every 1s
Color:       Normal → Yellow (warning) → Red (danger)
Urgency:     Subtle bounce when < 60s
```

### ChatBubble
```
Entrance: Scale-up (400ms)
Avatar:   Scale-up animation
Typing:   Dots fade in/out (1.4s)
```

### AnimatedModal
```
Entrance: Bounce-in content + fade backdrop (400ms)
Exit:     Scale-down (300ms)
Buttons:  Slide-and-fade (400ms)
```

---

## 🔧 CSS CLASSES QUICK LOOKUP

### For Cards
```css
.animate-bounce-in          /* Entrance */
.hover-card-lift            /* Hover effect */
.glass-surface              /* Styling */
.soft-shadow                /* Shadow */
```

### For Buttons
```css
.btn-press                  /* Click feedback */
.btn-ripple                 /* Ripple effect */
.hover-glow                 /* Hover glow */
.active-glow                /* Active state */
```

### For Forms
```css
.input-focus                /* Focus ring */
.input-error-shake          /* Error animation */
.input-success              /* Success state */
.label-float                /* Floating label */
```

### For Loading
```css
.animate-shimmer            /* Skeleton shimmer */
.animate-spin               /* Spinner */
.animate-pulse-glow         /* Pulsing glow */
```

### For Lists
```css
.stagger-1 .stagger-2 ...   /* Per-item delay */
.animate-bounce-in          /* Item entrance */
```

### For Scrolling
```css
.reveal                     /* Scroll reveal */
--reveal-delay: 80ms        /* Stagger reveals */
```

---

## 🎬 ANIMATION TIMING DIAGRAM

```
BUTTON CLICK FEEDBACK:
0ms   ─ User clicks button
100ms ─ Scale animation completes (0.98)
150ms ─ Visual feedback stops

FORM ERROR:
0ms   ─ Invalid input submitted
500ms ─ Shake animation completes
700ms ─ Toast notification appears (if needed)

CARD ENTRANCE (IN LIST):
Item 0: 0ms   ─ Bounce starts
Item 1: 80ms  ─ Next card starts (staggered)
Item 2: 160ms ─ Next card starts
...
400-600ms total for all items to settle

PAGE LOAD:
0ms    ─ Header appears
80ms   ─ Content section appears
160ms  ─ Feature grid appears
800ms  ─ All animations complete

MODAL DIALOG:
0ms    ─ Backdrop fades in
100ms  ─ Content bounces in
400ms  ─ Ready for interaction
```

---

## 💡 ANIMATION USAGE EXAMPLES

### Example 1: Animated List of Cards
```tsx
<div className="space-y-4">
  {rides.map((ride, idx) => (
    <Reveal 
      key={ride.id}
      style={{ --reveal-delay: `${idx * 80}ms` } as React.CSSProperties}
    >
      <AnimatedRideCard 
        {...ride} 
        delay={idx as any}
        animation="bounce-in"
      />
    </Reveal>
  ))}
</div>
```
**Result**: Each card bounces in with 80ms stagger, creating a wave effect

---

### Example 2: Form with Live Validation
```tsx
const [email, setEmail] = useState('');
const isValid = email.includes('@');

<AnimatedInput
  label="Email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={email && !isValid ? 'Invalid email' : ''}
  success={isValid && email}
  icon={<MailIcon />}
/>
```
**Result**: Input shakes on error, scales up on success

---

### Example 3: Loading to Content Transition
```tsx
{isLoading ? (
  <SkeletonCard count={3} />
) : (
  <AnimatedCard animation="fade-slide">
    {content}
  </AnimatedCard>
)}
```
**Result**: Skeleton fades out, real content fades in smoothly

---

### Example 4: Interactive Countdown
```tsx
<CountdownTimer
  seconds={timeLeft}
  format="mm:ss"
  warningAt={60}  // Changes color at 60s
  onComplete={handleExpired}
/>
```
**Result**: Timer counts down, turns yellow at warning time, red at danger

---

### Example 5: Confirmation Dialog
```tsx
<ConfirmModal
  isOpen={showConfirm}
  title="Cancel Ride?"
  description="This action cannot be undone"
  confirmText="Yes, Cancel"
  isDangerous={true}
  isLoading={isCancelling}
  onConfirm={handleCancel}
  onClose={() => setShowConfirm(false)}
/>
```
**Result**: Modal bounces in with warning styling, buttons animate on hover

---

## 🎨 ANIMATION COLOR SCHEME

```
Primary Action:     #3F51B5 (primary)
Secondary Action:   #9575CD (accent)
Success State:      #10B981 (green)
Warning State:      #F59E0B (amber)
Error State:        #EF4444 (red)
Neutral:            #6B7280 (gray)

For animations:
- Use primary for main CTAs
- Use accent for secondary effects
- Use status colors for feedback (success/error/warning)
```

---

## 🚀 PERFORMANCE BEST PRACTICES

1. **Use GPU-Accelerated Properties Only**
   ```css
   /* Good */
   transform: translateY(-6px);
   opacity: 0.5;
   
   /* Bad */
   top: -6px;  /* Triggers layout recalc */
   width: 100%; /* Triggers layout recalc */
   ```

2. **Will-Change for Scroll Animations**
   ```css
   .will-animate {
     will-change: transform, opacity;
   }
   ```

3. **Group Animations with Stagger**
   ```
   Don't: 8 items × 400ms = 3.2s for all
   Do:    8 items × 80ms stagger = smoother wave
   ```

4. **Respect prefers-reduced-motion**
   ```css
   @media (prefers-reduced-motion: reduce) {
     * { animation: none !important; }
   }
   ```

---

## ✅ ANIMATION QUALITY CHECKLIST

- [ ] All animations use GPU-accelerated properties (transform/opacity)
- [ ] Duration is 100-600ms (never longer than 1s for interactions)
- [ ] Easing matches the animation purpose (ease-out for entrances, ease-in-out for loops)
- [ ] Hover effects provide clear visual feedback
- [ ] Loading states are animated
- [ ] Error states have shake or color change
- [ ] Success states have checkmark or color change
- [ ] Form focus has ring animation
- [ ] Buttons have press/ripple feedback
- [ ] Cards have staggered entrance
- [ ] Modals have smooth open/close
- [ ] Scrolling doesn't jank
- [ ] All animations accessible (prefers-reduced-motion)

---

**Animation Framework Version**: 1.0  
**Last Updated**: January 25, 2026  
**Status**: Production Ready ✅
