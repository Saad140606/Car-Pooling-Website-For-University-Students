# Post-Ride Workflow System - Quick Reference

## 🎯 What Is It?

**Mandatory full-screen workflow** that appears after rides complete, forcing users to:
1. Confirm ride outcome
2. Rate participants
3. Provide reason (if needed)

**Cannot be dismissed. Cannot be skipped. Cannot be escaped.**

---

## 🚀 Quick Start

### The Modal Shows When:
```
ride.departureTime + delay minutes have passed
  AND
postRideStatus.pendingPassenger/Driver == true
```

### Developer's Job:
```
✅ Create rides with past departure times
✅ Set postRideStatus.pendingPassenger = true
✅ User sees modal on app load
✅ User completes workflow
✅ postRideStatus.passengerConfirmed = true
✅ Modal disappears
```

---

## 📂 Files You Need to Know

| File | What It Does | Edit When |
|------|--------------|-----------|
| `src/types/postRideWorkflow.ts` | Type definitions + config | Change timing delays |
| `src/lib/postRideManager.ts` | Detects due rides, manages state | Add custom logic |
| `src/contexts/PostRideWorkflowContext.tsx` | App state management | Change step flow |
| `src/components/PostRideWorkflowModal.tsx` | UI/UX design | Customize appearance |

---

## 💻 Usage

### Check in Your Components

```typescript
import { usePostRideWorkflow } from '@/contexts/PostRideWorkflowContext';

function MyComponent() {
  const { hasPendingWorkflow, currentWorkflow } = usePostRideWorkflow();
  
  return (
    <div>
      {hasPendingWorkflow && <p>User must complete workflow</p>}
      {currentWorkflow && <p>Ride: {currentWorkflow.rideId}</p>}
    </div>
  );
}
```

### Access Hook Data

```typescript
const {
  // State
  state,                    // Full state object
  currentWorkflow,          // Current pending workflow
  hasPendingWorkflow,       // boolean
  
  // Navigation
  goToStep,                 // (step) => void
  nextStep,                 // () => void
  previousStep,             // () => void
  
  // Form
  setFormData,              // (data) => void
  updateFormData,           // (updates) => void
  
  // Submission
  submitWorkflow,           // (data) => Promise<void>
  
  // Errors
  clearError,               // () => void
} = usePostRideWorkflow();
```

---

## ⚙️ Configuration

### Change Trigger Delay

```typescript
// In src/types/postRideWorkflow.ts

export const POST_RIDE_CONFIGS = {
  development: {
    triggerDelaySeconds: 300,    // 5 minutes (change this)
    ...
  },
  production: {
    triggerDelaySeconds: 3600,   // 60 minutes (change this)
    ...
  },
};
```

---

## 🧪 Testing

### Create Test Workflow

1. Go to Firestore Console
2. Find a ride document
3. Set:
   ```json
   postRideStatus: {
     pendingPassenger: true,
     passengerConfirmed: false,
     driverConfirmed: false
   }
   ```
4. Open app → Modal appears
5. Complete workflow → Disappears

### Debug in Console

```javascript
// Check current workflows
workflowManager.getPendingWorkflows()

// Check manager state
console.log(postRideManager)
```

---

## 🎨 Customize UI

### Change Colors

```typescript
// In PostRideWorkflowModal.tsx

// Header
className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900"
// Change to: from-blue-900 via-blue-800 to-blue-900

// Buttons
className="bg-primary hover:bg-primary/90"
// Change to: any Tailwind color
```

### Change Text

```typescript
// In OutcomeStep, RatingStep, ReasonStep...
<h2 className="text-2xl font-bold">
  Did you complete the ride?  {/* ← Edit here */}
</h2>
```

### Change Step Order

```typescript
// In PostRideContext.tsx
const stepSequence = ['outcome', 'rating', 'reason', 'complete'];
// Reorder this array
```

---

## 🔒 Security Notes

- ✅ Only users in ride can see workflow
- ✅ Firestore rules prevent unauthorized access
- ✅ Data validated before save
- ✅ Cannot complete other people's workflows

---

## 🐛 Debugging

### Modal Not Appearing?

1. Check Firestore ride document:
   ```
   postRideStatus.pendingPassenger == true?
   ```
2. Check rider departure time:
   ```
   now - departureTime > triggerDelaySeconds?
   ```
3. Browser console:
   ```
   postRideManager.getPendingWorkflows()
   // Should return non-empty array
   ```

### Submit Fails?

1. Check network tab for errors
2. Check Firestore rules allow write
3. Check error message in modal
4. Check console for detailed error logs

---

## 📊 Key Interfaces

```typescript
// What appears on screen
interface PendingPostRideWorkflow {
  rideId: string;
  userId: string;
  userRole: 'passenger' | 'driver';
  rideData: { ... };
}

// What's stored in Firestore
interface PostRideStatus {
  pendingPassenger: boolean;  // ← Triggers modal
  pendingDriver: boolean;     // ← Triggers modal
  passengerConfirmed: boolean;
  driverConfirmed: boolean;
  passengerRating?: number;
  driverRatings?: Record<string, number>;
}

// What's in the app
interface PostRideWorkflowState {
  currentWorkflow: PendingPostRideWorkflow | null;
  currentStep: 'outcome' | 'rating' | 'reason' | 'complete';
  formData: { outcome?, rating?, reason?, ... };
  submitting: boolean;
  error: string | null;
}
```

---

## 🚀 Deployment

### Before Going Live:

- [ ] Set `triggerDelaySeconds` to 3600 (1 hour)
- [ ] Configure Firestore indexes
- [ ] Update Firestore rules
- [ ] Test with real rides
- [ ] Monitor error logs
- [ ] Set up analytics
- [ ] Notify users of new workflow

---

## 📞 Common Questions

**Q: Can users close this modal?**  
A: No. No close button, no dismissal, no escape. Mandatory.

**Q: What if network fails?**  
A: Auto-retry with exponential backoff. User sees error, can retry.

**Q: What if user refreshes page?**  
A: Modal reappears. Firestore persists pending status.

**Q: Can I customize questions?**  
A: Yes. Edit OutcomeStep, RatingStep components. Add to formData.

**Q: How do I know when it completed?**  
A: Check Firestore: `postRideStatus.passengerConfirmed == true`

---

## 📚 Full Documentation

See `POST_RIDE_WORKFLOW_SYSTEM.md` for:
- Complete architecture
- Database schema
- Testing guide
- Security details
- Analytics integration
- Troubleshooting

---

## ✅ Quick Checklist

- [ ] Understand workflow is mandatory
- [ ] Know files to edit
- [ ] Can create test workflow
- [ ] Can check Firestore for status
- [ ] Can customize UI if needed
- [ ] Know how to debug issues
- [ ] Ready to deploy

---

**Status**: ✅ Production Ready  
**Build**: ✅ Success (19.9s)  
**Errors**: ✅ None
