# EpiCare Frontend

## Project Overview
EpiCare is an AI-powered epilepsy detection, seizure tracking, and personalized care platform. The frontend is built for extreme performance and aesthetics using React, TypeScript, and Vite.

## 🚀 Recent Features (Authentication & UI System)

### 1. Premium Authentication Screen
- **Side-by-side Desktop Layout**: A high-end design featuring a sliding video overlay panel to seamlessly transition between Sign In and Sign Up states.
- **Modern Aesthetics**: Forms and inputs utilize subtle glassmorphism effects, soft shadows, and rounded corners that strictly adhere to the EpiCare brand colors (Deep Earthy Green `--color-primary: #2d5a3f`).
- **Mobile Responsiveness**: Complete CSS media queries ensure the layout stacks perfectly on phones. The video overlay gracefully hides, replacing the sliding panel with a compact, easy-to-tap toggle link.

### 2. Advanced Multi-Step "Forgot Password" Flow
- **In-place Transitions**: The entire recovery process happens securely within `LoginForm.tsx` without ever requiring a page reload or route change.
- **Custom 6-Box OTP Component**:
  - A bespoke 6-digit OTP input grid designed for UX excellence.
  - **Dynamic Visual Feedback**: Empty boxes have a neutral border; as the user types, the active box instantly glows EpiCare Green.
  - **Auto-Verification**: The moment the 6th digit is entered, the UI automatically fires an API verification request.
  - **Success/Error States**: Incorrect codes flash red and provide instant error messages. Correct codes flash bright success green, wait for 800ms for visual confirmation, and smoothly sweep the user into the password creation step.
- **Anti-Enumeration Security**: The frontend flow expects and handles secure, generic success responses from the backend, protecting user data from email scraping bots.

### 3. API Integration
- A dedicated `axios`-based client (`src/api/auth.ts`) handles all communication with the FastAPI backend.
- Full end-to-end type safety using strict TypeScript interfaces (`LoginPayload`, `RegisterPayload`, etc.).
- Robust global and field-level error handling piped directly into the UI state.

### 4. Custom Reusable UI Components
- **Input**: Floating labels, focus animations, and built-in error states.
- **Button**: Support for multiple variants (solid, outline, ghost) and an integrated loading spinner state.
- **PhoneInput**: Specialized handling for phone number entry on the Sign Up screen.

## 🛠️ Setup Instructions

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev
```

## 🎨 Branding Tokens
The frontend relies heavily on CSS variables for consistent theming. The primary color palette resides in `src/styles/tokens.css`:
- `--color-primary`: `#2d5a3f`
- `--color-primary-light`: `#447a59`
- `--color-primary-dark`: `#1e402c`
