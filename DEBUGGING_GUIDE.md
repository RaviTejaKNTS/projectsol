# 🐛 Project Sol Debugging Guide

## **Current Issue: Actions Not Working**

The app is not responding to user actions (create, edit, move, delete tasks/columns).

## **🔍 Debug Steps**

### **1. Check Browser Console**
Open Developer Tools → Console and look for these logs:

#### **Expected Logs on App Load:**
```
useRelationalState refresh effect triggered for userId: [user-id]
No boards found for user, creating default board...
Creating default board for user: [user-id]
Board created successfully: [board-data]
Setting board state to: [board-data]
Setting current board ID to: [board-id]
Creating default columns...
Default columns created successfully
Creating sample tasks...
Sample tasks created successfully
Loading newly created board data...
Setting board: [board-data]
Current board ID set to: [board-id]
Board state changed: { board: [board-data], boardId: [board-id], hasBoard: true }
Current board ID set to: [board-id]
useColumnActions initialized with state: { hasState: true, columnsCount: 4, currentBoardId: [board-id] }
TaskActions initialized with state: { hasState: true, columnsCount: 4, tasksCount: 2, currentBoardId: [board-id] }
```

#### **Expected Logs on Action:**
```
moveTask called in App.tsx: { taskId: "...", fromColumnId: "...", toColumnId: "...", position: 0, board: [board-data], boardId: "[board-id]" }
Moving task with board ID: [board-id]
moveTask called with: { taskId: "...", fromColumnId: "...", toColumnId: "...", position: 0 }
Current board ID: [board-id]
```

### **2. Check Database State**
Run these queries in Supabase SQL Editor:

```sql
-- Check if profiles exist
SELECT * FROM profiles WHERE id = '[your-user-id]';

-- Check if boards exist
SELECT * FROM boards WHERE user_id = '[your-user-id]';

-- Check if columns exist
SELECT * FROM board_columns WHERE board_id = '[board-id]';

-- Check if tasks exist
SELECT * FROM tasks WHERE board_id = '[board-id]';
```

### **3. Common Issues & Solutions**

#### **Issue A: No Board Created**
**Symptoms:** No "Board created successfully" log
**Cause:** Profile FK constraint failure
**Solution:** Run the profile trigger SQL from `profile_trigger.sql`

#### **Issue B: Board Created but No Columns**
**Symptoms:** "Board created successfully" but no "Default columns created successfully"
**Cause:** Column creation failing
**Solution:** Check RLS policies on `board_columns` table

#### **Issue C: Board State Not Set**
**Symptoms:** Board created but `board` state is null
**Cause:** React state not updating properly
**Solution:** Check if `setBoard` is being called

#### **Issue D: Current Board ID Not Set**
**Symptoms:** Board exists but `getCurrentBoardId()` returns null
**Cause:** `setCurrentBoardId` not being called
**Solution:** Check if `setCurrentBoardId` is being called after board creation

#### **Issue E: Actions Not Receiving Board Context**
**Symptoms:** Actions initialized but `currentBoardId` is null
**Cause:** Board context not properly passed
**Solution:** Verify board state flow

### **4. Manual Testing Steps**

#### **Test 1: Sign In as New User**
1. Sign out completely
2. Sign in with a new account
3. Check console for bootstrap logs
4. Verify board appears with 4 columns and 2 sample tasks

#### **Test 2: Check Board State**
1. In console, run: `console.log('Board state:', window.boardState)`
2. Should show board object with ID

#### **Test 3: Test Simple Action**
1. Try to move a sample task between columns
2. Check console for action logs
3. Verify database is updated

#### **Test 4: Check Real-time Updates**
1. Open app in two browser tabs
2. Make a change in one tab
3. Verify change appears in other tab

### **5. Debug Commands**

#### **Check Current State:**
```javascript
// In browser console
console.log('Board:', window.boardState);
console.log('Current Board ID:', window.currentBoardId);
console.log('User:', window.currentUser);
```

#### **Force Refresh:**
```javascript
// In browser console
window.location.reload();
```

#### **Check Database Connection:**
```javascript
// In browser console
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
```

### **6. Expected Behavior**

#### **New User Flow:**
1. Sign in → Profile created automatically
2. Board created with 4 columns
3. 2 sample tasks added
4. Full kanban functionality ready

#### **Existing User Flow:**
1. Sign in → Existing board loads
2. All data preserved
3. Actions work immediately

### **7. If Still Not Working**

#### **Check These Files:**
- `src/hooks/useRelationalState.ts` - Board loading logic
- `src/state/currentBoard.ts` - Board context management
- `src/pages/App.tsx` - Board state synchronization
- `src/data/boards.ts` - Board creation logic

#### **Common Fixes:**
1. **Clear browser cache** and reload
2. **Check Supabase RLS policies** are correct
3. **Verify database schema** matches expected structure
4. **Check environment variables** are set correctly

## **🚨 Emergency Debug Mode**

If nothing works, add this to any component:

```typescript
useEffect(() => {
  console.log('EMERGENCY DEBUG - Current state:', {
    board,
    loaded,
    state,
    userId: user?.id,
    currentBoardId: getCurrentBoardId()
  });
}, [board, loaded, state, user]);
```

## **📞 Next Steps**

1. **Run the app** and check console logs
2. **Follow the debug steps** above
3. **Report specific error messages** or missing logs
4. **Check database state** in Supabase
5. **Test with a completely new user account**

---

**Remember:** The debug logs will show exactly where the process is failing!
