# 🎉 Download Button - Quick Reference

## 📍 Di Mana Download Button?

### Reports Tab → Table → Actions Column

```
┌─────────────────────────────────────────────────────────────────────┐
│                                              Actions Column Here ⬇️  │
│                                                                      │
│ Test ID          | Tester | Platform | Score | Status | ... │[👁️][⬇️]│
│ test_facebook_001| john   | facebook | 90.50 | ✅ PASS│ ... │[👁️][⬇️]│
│ test_instagram_2 | jane   | instagram| 95.00 | ✅ PASS│ ... │[👁️][⬇️]│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
     ↑                                                         ↑
   Click untuk View Details                  Click untuk Download
```

---

## 🎯 3 Langkah Download

### **Step 1️⃣: Go to Reports Tab**
```
Navigate → Reports (or click #reports in URL)
```

### **Step 2️⃣: Click Download Button (⬇️)**
```
Find test run row
↓
Click [⬇️] button di kolom "Actions"
↓
Dropdown menu muncul
```

### **Step 3️⃣: Select & Download**
```
Pilih artifact dari menu:
  ├─ JSON report
  ├─ HTML report  
  └─ Screenshots

↓ Click
File didownload otomatis ke Downloads folder
```

---

## 📥 Download Menu

### What You'll See

```
╔══════════════════════════════╗
║   Download Menu              ║
╠══════════════════════════════╣
║ JSON                         ║
║ └─ report.json (15 KB)      ║ ← CLICK to download
║                              ║
║ HTML                         ║
║ └─ report.html (2.3 MB)     ║ ← CLICK to download
║                              ║
║ SCREENSHOT                   ║
║ └─ screenshot_001.png (234KB)║ ← CLICK to download
║ └─ screenshot_002.png (198KB)║ ← CLICK to download
╚══════════════════════════════╝
```

### Features
- ✅ Organized by type
- ✅ Shows file size
- ✅ Hover highlights selection
- ✅ Click anywhere outside to close
- ✅ Auto-closes after download

---

## 🖼️ Screenshots

### Before (No Download Button)
```
| test_facebook_001 | john | facebook | 90.50 | ✅ PASS | ... | [👁️] |
└──────────────────────────────────────────────────────────────────────┘
                                                         Only View button
```

### After (With Download Button) ✨
```
| test_facebook_001 | john | facebook | 90.50 | ✅ PASS | ... | [👁️][⬇️] |
└────────────────────────────────────────────────────────────────────────┘
                                                    View + Download buttons
```

---

## 💡 Buttons Explained

### 👁️ View Button (Left)
- Open full details modal
- See all information about test run
- View all artifacts organized
- See test results

### ⬇️ Download Button (Right) ← **NEW!**
- Quick download menu
- See available artifacts
- One-click download
- Choose which file to download

---

## 🚀 Use Cases

### Case 1: Download Test Report
1. Find test run in Reports table
2. Click ⬇️ button
3. Select `report.json`
4. ✅ Downloaded!

### Case 2: Download HTML Report for Sharing
1. Find test run
2. Click ⬇️ button
3. Select `report.html`
4. ✅ Downloaded! (Send to stakeholder)

### Case 3: Download Screenshots for Bug Report
1. Find failing test
2. Click ⬇️ button
3. Select `screenshot_001.png`, `screenshot_002.png`
4. ✅ Downloaded! (Attach to bug ticket)

---

## 🎨 Visual Layout

### Current Reports Table

```
Table Header:
┌─────┬────────────┬────────┬──────────┬───────┬────────┬─────────┬──────────┬──────────┐
│ Pin │ Run Title  │ Tester │ Platform │ Score │ Status │ Started │ Duration │ Actions  │
├─────┼────────────┼────────┼──────────┼───────┼────────┼─────────┼──────────┼──────────┤
│ 📌  │ test_fb_01 │ john   │ facebook │ 90.50 │ ✅ P   │ 10:30   │ 2m 15s   │ [👁️][⬇️] │
│     │ test_ig_02 │ jane   │ instagram│ 95.00 │ ✅ P   │ 10:45   │ 1m 58s   │ [👁️][⬇️] │
│ 📌  │ test_web03 │ alice  │ webchat  │ 87.25 │ ✅ P   │ 11:00   │ 3m 12s   │ [👁️][⬇️] │
└─────┴────────────┴────────┴──────────┴───────┴────────┴─────────┴──────────┴──────────┘
                                                                               ↑
                                                                    New Actions Column
                                                                    with Download button
```

---

## ⌨️ Keyboard Shortcuts (Future Enhancement)

```
Once implemented:
- D = Download button click
- V = View details click
- Esc = Close menu
```

---

## 🔄 Workflow

```
1. Run Test
   ↓
2. Test completes
   ↓
3. Artifacts auto-upload to database
   ↓
4. Reports tab shows test run with download button
   ↓
5. Click [⬇️] to download artifacts
   ↓
6. Select artifact from dropdown
   ↓
7. ✅ File downloaded!
```

---

## 🎯 Tips & Tricks

### Tip 1: Quick Download vs Full View
- **Quick Download (⬇️)** - For fast artifact download
- **View Details (👁️)** - For comprehensive information

### Tip 2: Artifact Organization
- JSON reports for data analysis
- HTML reports for sharing
- Screenshots for documentation

### Tip 3: Menu Won't Close?
- Click anywhere outside menu
- Select an artifact (auto-closes)
- Refresh page if stuck

---

## 🆘 Troubleshooting

### Problem: Download button not visible
**Solution**: 
- Make sure you're on Reports tab
- Refresh page (F5)
- Check if backend is running

### Problem: Dropdown menu doesn't appear
**Solution**:
- Wait for artifacts to load (< 500ms)
- Check browser console for errors
- Verify database connection

### Problem: Download doesn't work
**Solution**:
- Check if artifact has data
- Try View (👁️) button to see details
- Check browser download folder

---

## 📊 Summary

| Feature | Where | How | Benefit |
|---------|-------|-----|---------|
| **View Details** | Actions column | Click 👁️ | Full information |
| **Download Artifacts** | Actions column | Click ⬇️ | Quick download |
| **See File Sizes** | Dropdown menu | Hover | Know what to download |
| **Organized by Type** | Dropdown menu | Auto-grouped | Find artifact easily |

---

## ✅ What's New

✨ **Reports table now has**:
- ✅ Download button for each test run
- ✅ Dropdown menu showing all artifacts
- ✅ File size information
- ✅ One-click download
- ✅ Better organization

---

**Status**: ✅ READY TO USE NOW!  
**Updated**: February 23, 2026
