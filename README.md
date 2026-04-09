# Whack-a-Mole Game with Neo4j Leaderboard

A fun Whack-a-Mole game with user authentication, score tracking, and leaderboard functionality using Neo4j graph database.

## Features

- 🎮 Classic Whack-a-Mole gameplay with three difficulty levels
- 👤 User authentication (automatic registration on first login)
- 🏆 Real-time leaderboard with top players
- 📊 Personal statistics tracking (high score, games played)
- 🔐 Secure password hashing with bcrypt
- 📱 Mobile-responsive design

## Prerequisites

- Node.js (v14 or higher)
- Neo4j Database (v4.4 or higher)

## Neo4j Setup

### Option 1: Neo4j Desktop (Recommended for local development)

1. Download and install [Neo4j Desktop](https://neo4j.com/download/)
2. Create a new project
3. Add a local DBMS (database):
   - Set a password (remember this!)
   - Version: 4.4 or higher
4. Start the database
5. Note your connection details (usually `neo4j://localhost:7687`)

### Option 2: Neo4j Aura (Cloud)

1. Sign up at [Neo4j Aura](https://neo4j.com/cloud/aura/)
2. Create a free instance
3. Download the credentials file
4. Note your connection URI and password

### Option 3: Docker

```bash
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your_password \
  neo4j:latest
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the project root:
```env
NEO4J_URI=neo4j://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password_here
PORT=3000
```

3. Update the `.env` file with your Neo4j credentials

## Running the Application

1. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

## Database Schema

The application creates the following Neo4j schema:

### Nodes

**User**
- `username` (string, unique) - Player username
- `password` (string) - Hashed password
- `highestScore` (integer) - Player's best score
- `gamesPlayed` (integer) - Total games played
- `createdAt` (datetime) - Account creation timestamp
- `lastLogin` (datetime) - Last login timestamp

**Game**
- `score` (integer) - Score achieved
- `difficulty` (string) - Game difficulty (EASY, MEDIUM, HARD)
- `playedAt` (datetime) - When the game was played

### Relationships

- `(User)-[:PLAYED]->(Game)` - Links users to their game sessions

## API Endpoints

### POST `/api/auth/login`
Login or register a new user
```json
{
  "username": "player1",
  "password": "password123"
}
```

### POST `/api/score/submit`
Submit a game score
```json
{
  "username": "player1",
  "score": 25,
  "difficulty": "MEDIUM"
}
```

### GET `/api/leaderboard?limit=10`
Get top players

### GET `/api/user/:username`
Get user statistics

## Game Controls

- **Mouse Click**: Whack the mole
- **Difficulty Settings**:
  - Easy: Slower moles
  - Medium: Moderate speed
  - Hard: Fast moles
- **Timer**: 30 seconds per game

## Troubleshooting

### "Neo4j connection failed"
- Verify Neo4j is running
- Check credentials in `.env` file
- Ensure the URI format is correct (`neo4j://` or `neo4j+s://` for SSL)

### "Failed to connect to server"
- Make sure the server is running (`npm start`)
- Check if port 3000 is available
- Look at browser console for errors

### Cannot login
- Check server logs for error messages
- Verify database connection is working
- Try creating a new user with a different username

## Development

To view the Neo4j database:
1. Open Neo4j Browser at `http://localhost:7474`
2. Login with your credentials
3. Run Cypher queries to inspect data:

```cypher
// View all users
MATCH (u:User) RETURN u

// View leaderboard
MATCH (u:User) 
RETURN u.username, u.highestScore, u.gamesPlayed 
ORDER BY u.highestScore DESC

// View all games for a user
MATCH (u:User {username: 'player1'})-[:PLAYED]->(g:Game)
RETURN g ORDER BY g.playedAt DESC
```

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Database**: Neo4j
- **Security**: bcrypt for password hashing
- **CORS**: Enabled for local development

## License

MIT License - Feel free to use and modify!
