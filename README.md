<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <h1>🍚 MessMate (Rice Meal Manager)</h1>
  
  <p>
    <strong>A modern, real-time web application to effortlessly manage your mess meals, members, finances, and reports.</strong>
  </p>

  <p>
    <img alt="React" src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" />
    <img alt="Firebase" src="https://img.shields.io/badge/firebase-ffca28?style=for-the-badge&logo=firebase&logoColor=black" />
  </p>
</div>

---

## ✨ Features

- **📊 Interactive Dashboard:** Get a quick overview of today's meals, total deposits, and active members.
- **👥 Member Management:** Add, edit, or remove members of your mess easily.
- **🍽️ Daily Meal Entry:** Track how many meals each member consumes every day.
- **💰 Finance & Deposits:** Keep a clear log of all money deposited by members.
- **📈 Advanced Reports:** Automatically generate detailed summaries of meal rates, total costs, and individual balances.
- **⚙️ Settings & Admin Control:** Secure the app with admin authentication and configure mess settings.
- **⚡ Real-time Updates:** Powered by Firebase Firestore for instant synchronization across devices.

## 🛠️ Technology Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** CSS / Tailwind CSS (Optional based on configuration), Lucide React (Icons)
- **Backend/Database:** Firebase (Auth, Firestore)
- **Other Tools:** `jspdf` for generating reports, PWA support.

## 🚀 Getting Started

Follow these steps to run the application locally on your machine.

### Prerequisites

- Node.js (v16 or higher)
- npm (Node Package Manager)
- A Firebase Project (for Auth & Firestore)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/ricemanager.git
   cd ricemanager
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Firebase Configuration:**
   Make sure you have your Firebase config correctly placed in the `firebase.ts` file or via `.env` variables if configured.

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   *The app will be available at `http://localhost:5173` (or another port if 5173 is in use).*

## 🔒 Firebase Security Rules (Important)

To ensure your app fetches data correctly from Firestore, make sure to deploy or update your Firestore rules in the Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

---
<div align="center">
  <i>Built with ❤️ for a hassle-free mess life.</i>
</div>
