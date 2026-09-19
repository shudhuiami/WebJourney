# WebJourney — User Pilot Testing Guide (WJ-505)

Step-by-step instructions to conduct a pilot test between an Author and a Learner using the local test environment.

---

## 🛠️ Step 1: Start the Demo Website
In your terminal, run:
```bash
npm run dev:demo
```
Open **`http://localhost:5173`** in Google Chrome.

---

## 🧩 Step 2: Load the WebJourney Extension
1. Navigate to `chrome://extensions/`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Choose directory: `D:\laragon\www\WebJourney\apps\extension\dist`

---

## ✍️ Step 3: Author Pilot Flow (Author Role)
1. On `http://localhost:5173`, click the **WebJourney** extension icon in Chrome's toolbar.
2. Click **Open Journey Builder &rarr;** to open the Chrome Side Panel.
3. In the Side Panel:
   - Click **🎯 Pick Element**.
   - Hover over the **`+ Open Modal Dialog`** button and click it.
   - Click **+ Add Step**.
   - Edit Title: *"Open Quick Actions"*.
   - Edit Instruction: *"Click this button to see the modal."*
4. Add a second step:
   - Click **Projects** in the demo navigation bar.
   - Click **🎯 Pick Element** and select the **Project Title input field**.
   - Click **+ Add Step**.
   - Verify action is set to **Field Complete**.
5. Test the draft:
   - Click **▶ Play** in the Side Panel header to test the tour locally.
6. Publish:
   - Click **🚀 Publish** in the header.
   - Note down the generated Share Code (e.g. `WJ-XXXXXX`).

---

## 🎓 Step 4: Learner Pilot Flow (Learner Role)
1. Open a new Chrome window or switch mode in the Extension Popup:
   - Click the extension icon and select **Learner**.
2. Enter the generated **Share Code** (`WJ-XXXXXX`).
3. Click **Start**.
4. Observe the spotlight highlight target the button and follow instructions to completion!
