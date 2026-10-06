# 🌬️ Aire — Air Quality Intelligence Platform

Aire is a modern web application for monitoring and understanding air quality across India. It provides AQI information, pollutant-level details, historical trends, health guidance, location-based monitoring, and educational information about air pollution.

The project is built with React, TypeScript, Vite, Tailwind CSS, and a modular service architecture that can later be connected to a real air-quality API.

---

## ✨ Features

### 🔐 Authentication

* Login and signup pages
* Protected application routes
* Authentication context
* User information displayed in the navigation bar
* Logout functionality
* Protected dashboard access

### 📍 Location Selection

* Search for monitored locations
* Location-based AQI information
* India-focused location dataset
* State and Union Territory classification
* Selected location persisted using browser `localStorage`
* Validation of stored locations to prevent stale/invalid selections

### 🌫️ AQI Overview

* Current AQI
* AQI category and status
* Pollutant summary
* AQI trend information
* Current location information
* Previous AQI comparison

### 🗺️ India AQI Map

* India-wide AQI visualization
* Current AQI for monitored locations
* Location-based air-quality information
* Support for identifying pollution levels across locations

### 📊 AQI Trends

* Historical AQI data
* Multiple time ranges:

  * 24 hours
  * 3 days
  * 7 days
* AQI trend visualization

### 🧪 Pollutant Monitoring

The application supports monitoring of:

* PM2.5
* PM10
* NO₂
* SO₂
* CO
* O₃

Pollutant information includes current values, units, and pollution-level classifications.

### ❤️ Health Information

* AQI-based health information
* Location-specific air-quality guidance
* Explanation of pollutant effects
* Health and safety information

> The health information provided by the application is general educational information and is not medical advice.

### 📚 Learn Page

The Learn section explains:

* What AQI means
* Major air pollutants
* Sources of pollution
* Effects of pollutants
* Ways to reduce exposure
* AQI categories
* Frequently asked questions
* Air-quality data sources

### 🌓 Theme Support

* Light/dark theme support
* Theme toggle
* Responsive UI

### ⚡ Loading & Error States

* Skeleton loading components
* Empty states
* Error handling
* Stale-data simulation
* Partial pollutant-data handling

---

## 🛠️ Tech Stack

### Frontend

* React
* TypeScript
* Vite
* React Router
* Tailwind CSS
* Lucide React
* Recharts
* Leaflet

### Development

* Node.js
* npm
* TypeScript
* Vite
* ESLint / TypeScript tooling

---

## 📁 Project Structure

```text
AireProject/
│
├── public/
│
├── src/
│   ├── components/
│   │   ├── aqi/
│   │   ├── auth/
│   │   ├── layout/
│   │   ├── location/
│   │   └── ui/
│   │
│   ├── config/
│   │
│   ├── context/
│   │   ├── AirQualityContext.tsx
│   │   ├── AuthContext.tsx
│   │   ├── LocationContext.tsx
│   │   └── ThemeContext.tsx
│   │
│   ├── data/
│   │   └── indiaLocations.ts
│   │
│   ├── lib/
│   │
│   ├── pages/
│   │   ├── AuthPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── AirQualityPage.tsx
│   │   ├── InsightsPage.tsx
│   │   ├── RoutesPage.tsx
│   │   ├── HealthPage.tsx
│   │   ├── AlertsPage.tsx
│   │   ├── LearnPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── DesignSystemPage.tsx
│   │
│   ├── services/
│   │   ├── airQualityService.ts
│   │   └── mock.ts
│   │
│   ├── types/
│   │   └── airQuality.ts
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/parthgupta-programmer/AireProject.git
```

### 2. Navigate to the project

```bash
cd AireProject
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the development server

```bash
npm run dev
```

The application will be available through the Vite development server.

---

## 🏗️ Production Build

To create a production build:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

## 🧪 Mock Air-Quality Service

The current application uses a mock air-quality service designed to behave similarly to a real data feed.

The service generates:

* Current AQI
* Pollutant readings
* Historical AQI
* Location-based readings
* National AQI information
* Previous AQI values

The architecture is designed so that a real API can later replace the mock implementation without requiring major changes to the UI.

### Mock States

The application supports different mock states through query parameters.

Example:

```text
/?mock=stale
```

The mock service can simulate different data conditions such as stale readings, partial pollutant data, and unavailable historical data.

---

## 🔌 API Integration Architecture

The UI communicates with air-quality information through:

```text
UI Components
      ↓
React Context
      ↓
Air Quality Service
      ↓
Mock Data / Future API
```

The service layer separates data acquisition from the UI.

This means the future implementation can replace the mock service with a real API while maintaining the existing UI data contracts.

---

## 📊 Data Model

The application uses structured TypeScript contracts for air-quality data.

### Location

```ts
interface LocationOption {
  id: string
  name: string
  region?: string
  regionType?: 'State' | 'Union Territory'
  country: string
  latitude: number
  longitude: number
}
```

### Air Quality

```ts
interface AirQualityData {
  location: LocationOption
  aqi: number
  timestamp: string
  pollutants: PollutantReadings
  previousAqi?: number
}
```

### Pollutants

```text
PM2.5
PM10
NO₂
SO₂
CO
O₃
```

---

## 🔐 Application Routing

The application separates public authentication routes from protected application routes.

### Public

```text
/login
/signup
```

### Protected

```text
/
/air-quality
/insights
/routes
/health
/alerts
/learn
/settings
/design
```

Authenticated users access the main application through the protected routing layer.

---

## 🎨 UI/UX

Aire uses a responsive and component-based interface with:

* Responsive layouts
* Cards
* Navigation components
* Skeleton loading
* Hover states
* Active navigation states
* Theme support
* Accessible labels
* Keyboard navigation
* Location search
* Modal/dropdown interactions
* Empty states
* Error states
* Consistent typography and spacing

---

## 🔮 Future Development

The current architecture allows the project to be extended with:

* Real-time air-quality APIs
* Live monitoring stations
* Weather integration
* AI-based AQI forecasting
* Pollution alerts
* Personalized health recommendations
* Route-based pollution comparison
* Advanced pollution analytics
* More cities and monitoring stations
* Backend authentication
* Persistent user profiles
* Real-time notifications

---

## 👥 Project Collaboration

The project is developed collaboratively using Git and GitHub.

### Main workflow

```text
Local Development
       ↓
Git
       ↓
GitHub
       ↓
main
```

Contributors can work on the project locally, commit their changes, and push updates to the shared repository.

---

## 📜 License

This project is intended for educational and development purposes.
