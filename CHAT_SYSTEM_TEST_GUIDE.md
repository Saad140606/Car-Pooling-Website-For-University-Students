# CHAT SYSTEM - QUICK TEST GUIDE

## How to Test All Features (5-10 minutes)

### Setup
1. Open two browser windows/tabs
2. Log in as two different users
3. Navigate to a ride that shows chat

---

## FEATURE TESTS

### ✅ TEST 1: Text Messages (30 seconds)
**Expected:** Instant delivery, read receipts
```
1. User A: Type "Hello" and send
2. User B: Should see message instantly
3. Verify: Check mark appears when received, double-check when read
4. User B: Reply "Hi there"
5. Verify: User A sees it immediately
```

---

### ✅ TEST 2: Image Upload (1 minute)
**Expected:** Upload bar, instant display
```
1. User A: Click paperclip icon
2. Select a JPG or PNG image from your device
3. Verify: Upload progress bar shows 0-100%
4. Verify: Image appears in chat immediately after reaching 100%
5. User B: Refresh page - image still visible
6. Click image: Should open in new tab
```

---

### ✅ TEST 3: File Upload (1 minute)
**Expected:** File icon, download button
```
1. User A: Click paperclip icon
2. Select a PDF or DOCX file
3. Verify: Upload progress bar shows percentage
4. Verify: File appears with icon and name (not image)
5. User B: Verify file is visible with download button
6. Click download: File should download to your device
```

---

### ✅ TEST 4: Voice Message - Success Case (1 minute)
**Expected:** Records, uploads, plays
```
1. User A: Click microphone icon
2. Verify: Record UI appears with "Recording..." state
3. Speak into microphone: "This is a test"
4. Click stop (square) button
5. Verify: Waveform preview appears with play button
6. Click send (arrow) button
7. Verify: Upload progress shows 0-100%
8. Verify: Voice message appears with play button
9. User B: Click play button - should hear audio
```

---

### ✅ TEST 5: Voice Message - Retry Case (1 minute)
**Expected:** Error message, retry button
```
1. Disable internet (or use browser dev tools Network tab > offline)
2. Record a voice message and try to send
3. Verify: Error message appears (red with X icon)
4. Verify: Recording is preserved (you can still see it)
5. Re-enable internet
6. Click "Retry" button in error message
7. Verify: Upload succeeds and message sends
8. User B: Can see and play the voice message
```

---

### ✅ TEST 6: Audio Call - Success Case (2 minutes)
**Expected:** Ring, connect, audio flows, can end
```
1. User A: Click phone icon (audio call)
2. Verify: Status shows "Connecting..."
3. User B: Should see "Incoming audio call" notification
4. Verify: Accept button visible
5. User B: Click Accept
6. Verify: User A no longer shows "Connecting..."
7. Verify: Both can speak and hear each other
8. User A: Click mic icon to mute
9. Verify: Mic icon shows muted state (red or different color)
10. User A: Click mic again to unmute
11. User A: Click phone hang-up button
12. Verify: Both see call ended
```

---

### ✅ TEST 7: Audio Call - Rejection (1 minute)
**Expected:** Caller sees rejection, call ends
```
1. User A: Start audio call
2. User B: Click Reject button (before accepting)
3. Verify: User A sees error: "Call was rejected"
4. Verify: No audio is connected
5. Verify: Both can chat normally after
```

---

### ✅ TEST 8: Audio Call - Timeout (1+ minute)
**Expected:** Caller sees timeout after 60s
```
1. User A: Start audio call
2. User B: Do NOT accept (let it ring)
3. Wait 60 seconds
4. Verify: User A sees: "Call timeout - recipient did not answer in 60 seconds"
5. Verify: Call ends automatically
6. Verify: User B can still answer but gets error (call doc deleted)
```

---

### ✅ TEST 9: Video Call - Success Case (2 minutes)
**Expected:** Video streams, camera on/off, works
```
1. User A: Click video camera icon
2. Verify: Asks for camera permission - click Allow
3. Verify: Status shows "Connecting..."
4. User B: See incoming video call notification
5. User B: Click Accept
6. Verify: User A's local camera shows in bottom-right (small)
7. Verify: User B's camera shows full screen for User A
8. Verify: Both see each other's video
9. User A: Click camera toggle (video off)
10. Verify: Local video freezes or shows "camera off" indicator
11. User A: Click camera toggle again (video on)
12. Verify: Local video resumes
13. User A: Click hang-up button
14. Verify: Both see call ended, video disappears
```

---

### ✅ TEST 10: Video Call - Permission Denied (30 seconds)
**Expected:** Clear error message
```
1. User A: Deny camera permission when asked
2. Verify: Error message appears: "Microphone or camera permission denied"
3. Verify: Can try again if permissions enabled
```

---

## ERROR SCENARIOS

### Scenario: Slow Network / Upload Stalls
```
1. Throttle network in DevTools: Network tab > Throttling > "Slow 3G"
2. Try uploading a file
3. Verify: Progress bar moves slowly but doesn't get stuck
4. If disconnects: Error shows with retry button
5. Re-enable network
6. Retry: File uploads successfully
```

### Scenario: Network Drops During Call
```
1. Start audio call successfully
2. Go to browser DevTools: Network tab > offline
3. Verify: Error message appears or call closes
4. Verify: No hanging connection or app freeze
5. Re-enable network
6. Can start new call
```

### Scenario: Browser Doesn't Support Feature
```
For Example: Voice recording in IE (not supported)
1. Try to record voice message in unsupported browser
2. Verify: Clear error: "Voice recording not supported in your browser"
3. Works normally in Chrome/Firefox/Edge
```

---

## PERFORMANCE CHECKS

| Action | Expected Time | Status |
|--------|---|---|
| Text message send | <100ms | ✅ Instant |
| File upload (5MB) | <5 seconds | ✅ Fast |
| File upload (50MB) | <30 seconds | ✅ Slow but works |
| Voice upload (30s) | <3 seconds | ✅ Fast |
| Audio call connect | <2 seconds | ✅ Quick |
| Video call connect | <3 seconds | ✅ Quick |
| Image display | Instant | ✅ Instant |
| Download starts | <1 second | ✅ Quick |

---

## DEBUG MODE

Enable detailed logging:
```javascript
// In browser console:
localStorage.setItem('DEBUG_CHAT', '1');
// Reload page
// Check console for [ChatRoom], [MediaUploader], [VoiceRecorder] logs
```

---

## QUICK FIXES IF SOMETHING BREAKS

### "Message not sending"
- Check internet connection
- Check Firestore rules allow writes
- Check user is logged in

### "File won't upload"
- Check file size < 50MB
- Check internet connection
- Disable ad blocker / extensions
- Check Firebase Storage bucket exists

### "Can't hear audio in call"
- Check microphone permission granted
- Check microphone not muted in system
- Check volume not at 0
- Check WebRTC connection established

### "Video not showing"
- Check camera permission granted
- Check camera not in use by another app
- Check other app is closed and try again
- Refresh page

---

## SUCCESS CRITERIA

✅ **All tests pass** = System is ready for production
❌ **Any test fails** = Document issue and contact support

All features should work smoothly without:
- Loading loops
- Silent failures
- Stuck states
- Unclear error messages

