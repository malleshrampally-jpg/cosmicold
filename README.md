# Cosmic Editor Academy

Premium editing training and recruitment platform for Cosmic Agency.

## Features

- **Authentication**: Google Sign-In + Email/Password
- **Candidate Dashboard**: Application tracking, training access
- **Admin Dashboard**: Manage candidates, training, tests
- **Firebase Compatible**: Uses existing Cosmic Agency user structure
- **Responsive**: Desktop, tablet, and mobile optimized

## Setup

1. Update `js/firebase.js` with your Firebase configuration
2. Deploy to Netlify, GitHub Pages, or similar static hosting

## Firestore User Structure

```
users/{uid}
├── active (boolean)
├── created_at (timestamp)
├── email (string)
├── lastSeen (timestamp)
├── online (boolean)
├── role ("admin" | "user")
├── uid (string)
└── username (string)
```

## License

Cosmic Agency © 2026
