# BibleForge React

A modern React-based Bible study web application inspired by [BibleForge](https://github.com/bibleforge/BibleForge). Read, navigate, and search the Bible with a clean, responsive interface featuring light and dark themes.

![BibleForge Light Mode](https://github.com/user-attachments/assets/7fa21749-900c-4db7-b089-542612ee2862)

## Features

- **Bible Reading** — Browse all 66 books with chapter navigation
- **Search** — Search verses by keyword across the entire Bible
- **Reference Navigation** — Type "John 3" or "Genesis 1" in the search bar to jump directly
- **Dark Mode** — Toggle between light and dark themes (persisted in localStorage)
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Docker Ready** — Full Docker Compose setup with MySQL database support

## Quick Start (Local Development)

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Start the API server (uses embedded Bible data)
cd ../server && npm run dev

# 3. In another terminal, start the React dev server
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Docker

Run the complete application with Docker Compose:

```bash
# Build and start all services
docker compose up --build

# The app will be available at http://localhost:3001
```

This starts:
- **MySQL 8.0** database on port 3306
- **BibleForge app** (API + React frontend) on port 3001

### Loading Full Bible Data

The Docker setup creates the database schema automatically. To import the full BibleForge database:

1. Clone the [BibleForgeDB](https://github.com/bibleforge/BibleForgeDB) repository
2. Import the SQL dumps into the running MySQL container:

```bash
# Extract and import the English Bible text
gunzip -c BibleForgeDB/bible_en_all.sql.gz | docker compose exec -T db mysql -ubibleforge -pbibleforge bf
```

## Project Structure

```
bibleforge-react/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── BibleViewer.jsx
│   │   │   ├── BookSelector.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── SearchResults.jsx
│   │   │   └── ThemeToggle.jsx
│   │   ├── __tests__/      # Component tests
│   │   ├── App.jsx         # Main application
│   │   ├── App.css         # Styles with CSS variables for theming
│   │   └── main.jsx        # Entry point
│   └── vite.config.js
├── server/                 # Express.js backend
│   ├── data/
│   │   ├── bible.js        # Embedded KJV verse data (fallback)
│   │   └── books.js        # All 66 Bible books metadata
│   ├── tests/              # API tests
│   ├── db.js               # MySQL database module
│   └── index.js            # Express server
├── docker/
│   └── init-db/            # MySQL initialization scripts
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yml      # Docker Compose configuration
└── README.md
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/books` | List all 66 Bible books with chapter counts |
| `GET /api/verses/:book/:chapter` | Get verses for a specific book and chapter |
| `GET /api/search?q=keyword` | Search verses by keyword |
| `GET /api/health` | Health check with data source info |

## Running Tests

```bash
# Server tests
cd server && npm test

# Client tests
cd client && npm test
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `bibleforge` | MySQL username |
| `DB_PASSWORD` | `bibleforge` | MySQL password |
| `DB_NAME` | `bf` | MySQL database name |
| `STATIC_PATH` | — | Path to built client files (set in Docker) |

## License

MIT — Based on the original [BibleForge](https://github.com/bibleforge/BibleForge) project.

