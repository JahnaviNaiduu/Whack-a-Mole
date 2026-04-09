require('dotenv').config();
const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Allow requests from your Vercel domain
  app.use(cors({
      origin: [
          'http://localhost:3000',
          'https://your-app.vercel.app',  // You'll add this after Vercel deployment
          /\.vercel\.app$/  // Allow all vercel preview deployments
      ],
      credentials: true
  }));
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Neo4j driver setup
const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const username = process.env.NEO4J_USERNAME || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

// Determine if we're using Aura (cloud) or local
const isAura = uri.includes('neo4j.io') || uri.includes('neo4j+s://');

const driverConfig = isAura ? {
    // Aura configuration
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 120000
} : {
    // Local configuration
    encrypted: false,
    trust: 'TRUST_ALL_CERTIFICATES',
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 120000
};

const driver = neo4j.driver(uri, neo4j.auth.basic(username, password), driverConfig);

// Global flag to track if database is available
let dbAvailable = false;

// Test database connection
async function testConnection() {
    const session = driver.session();
    try {
        await session.run('RETURN 1');
        console.log('✅ Neo4j connection successful');
        dbAvailable = true;
    } catch (error) {
        console.error('❌ Neo4j connection failed:', error.message);
        console.log('⚠️  Server will run in LOCAL MODE (no database)');
        dbAvailable = false;
    } finally {
        await session.close();
    }
}

// Initialize database constraints
async function initializeDatabase() {
    const session = driver.session();
    try {
        // Create unique constraint on username
        await session.run(`
            CREATE CONSTRAINT user_username_unique IF NOT EXISTS
            FOR (u:User) REQUIRE u.username IS UNIQUE
        `);
        console.log('✅ Database constraints initialized');
    } catch (error) {
        console.error('Error initializing database:', error.message);
    } finally {
        await session.close();
    }
}

// API Routes

// In-memory storage for local mode
const localUsers = new Map();
const localGames = [];

// Register/Login user
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    // LOCAL MODE FALLBACK
    if (!dbAvailable) {
        let user = localUsers.get(username);

        if (!user) {
            // Create new user in memory
            const hashedPassword = await bcrypt.hash(password, 10);
            user = {
                username,
                password: hashedPassword,
                highestScore: 0,
                gamesPlayed: 0
            };
            localUsers.set(username, user);
            console.log(`✅ [LOCAL] New user created: ${username}`);
        } else {
            // Verify password
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid password' });
            }
            console.log(`✅ [LOCAL] User logged in: ${username}`);
        }

        return res.json({
            success: true,
            username: user.username,
            highestScore: user.highestScore,
            gamesPlayed: user.gamesPlayed
        });
    }

    const session = driver.session();
    try {
        // Check if user exists
        const result = await session.run(
            'MATCH (u:User {username: $username}) RETURN u',
            { username }
        );

        let user;
        if (result.records.length === 0) {
            // Create new user
            const hashedPassword = await bcrypt.hash(password, 10);
            const createResult = await session.run(
                `CREATE (u:User {
                    username: $username,
                    password: $hashedPassword,
                    highestScore: 0,
                    gamesPlayed: 0,
                    createdAt: datetime(),
                    lastLogin: datetime()
                })
                RETURN u`,
                { username, hashedPassword }
            );
            user = createResult.records[0].get('u').properties;
            console.log(`✅ New user created: ${username}`);
        } else {
            // Verify password
            user = result.records[0].get('u').properties;
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            // Update last login
            await session.run(
                'MATCH (u:User {username: $username}) SET u.lastLogin = datetime()',
                { username }
            );
            console.log(`✅ User logged in: ${username}`);
        }

        res.json({
            success: true,
            username: user.username,
            highestScore: user.highestScore.toNumber ? user.highestScore.toNumber() : user.highestScore,
            gamesPlayed: user.gamesPlayed.toNumber ? user.gamesPlayed.toNumber() : user.gamesPlayed
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        await session.close();
    }
});

// Submit score
app.post('/api/score/submit', async (req, res) => {
    const { username, score, difficulty } = req.body;

    if (!username || score === undefined) {
        return res.status(400).json({ error: 'Username and score required' });
    }

    // LOCAL MODE FALLBACK
    if (!dbAvailable) {
        const user = localUsers.get(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.gamesPlayed++;
        if (score > user.highestScore) {
            user.highestScore = score;
        }

        localGames.push({
            username,
            score,
            difficulty: difficulty || 'EASY',
            playedAt: new Date()
        });

        return res.json({
            success: true,
            highestScore: user.highestScore,
            gamesPlayed: user.gamesPlayed,
            isNewHighScore: score === user.highestScore
        });
    }

    const session = driver.session();
    try {
        // Update user stats and create game record
        const result = await session.run(
            `MATCH (u:User {username: $username})
            SET u.gamesPlayed = u.gamesPlayed + 1,
                u.highestScore = CASE WHEN $score > u.highestScore THEN $score ELSE u.highestScore END
            CREATE (g:Game {
                score: $score,
                difficulty: $difficulty,
                playedAt: datetime()
            })
            CREATE (u)-[:PLAYED]->(g)
            RETURN u.highestScore as highestScore, u.gamesPlayed as gamesPlayed`,
            { username, score, difficulty: difficulty || 'EASY' }
        );

        const record = result.records[0];
        const highestScore = record.get('highestScore').toNumber ? record.get('highestScore').toNumber() : record.get('highestScore');
        const gamesPlayed = record.get('gamesPlayed').toNumber ? record.get('gamesPlayed').toNumber() : record.get('gamesPlayed');

        res.json({
            success: true,
            highestScore,
            gamesPlayed,
            isNewHighScore: score === highestScore
        });

    } catch (error) {
        console.error('Score submission error:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        await session.close();
    }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    console.log(`📊 Leaderboard request - limit: ${limit}, dbAvailable: ${dbAvailable}`);

    // LOCAL MODE FALLBACK
    if (!dbAvailable) {
        const leaderboard = Array.from(localUsers.values())
            .sort((a, b) => b.highestScore - a.highestScore)
            .slice(0, limit)
            .map((user, index) => ({
                rank: index + 1,
                username: user.username,
                highestScore: user.highestScore,
                gamesPlayed: user.gamesPlayed,
                lastLogin: null
            }));

        console.log(`✅ [LOCAL] Returning ${leaderboard.length} players`);
        return res.json(leaderboard);
    }

    const session = driver.session();

    try {
        console.log('🔍 Querying Neo4j for leaderboard...');
        const result = await session.run(
            `MATCH (u:User)
            RETURN u.username as username,
                   u.highestScore as highestScore,
                   u.gamesPlayed as gamesPlayed,
                   u.lastLogin as lastLogin
            ORDER BY u.highestScore DESC
            LIMIT $limit`,
            { limit: neo4j.int(limit) }  // Convert to Neo4j integer type
        );

        console.log(`✅ Found ${result.records.length} users in database`);

        const leaderboard = result.records.map((record, index) => ({
            rank: index + 1,
            username: record.get('username'),
            highestScore: record.get('highestScore').toNumber ? record.get('highestScore').toNumber() : record.get('highestScore'),
            gamesPlayed: record.get('gamesPlayed').toNumber ? record.get('gamesPlayed').toNumber() : record.get('gamesPlayed'),
            lastLogin: record.get('lastLogin')
        }));

        console.log('📤 Sending leaderboard:', leaderboard);
        res.json(leaderboard);

    } catch (error) {
        console.error('❌ Leaderboard error:', error.message);
        res.status(500).json({ error: 'Server error', details: error.message });
    } finally {
        await session.close();
    }
});

// Get user stats
app.get('/api/user/:username', async (req, res) => {
    const { username } = req.params;

    // LOCAL MODE FALLBACK
    if (!dbAvailable) {
        const user = localUsers.get(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userGames = localGames
            .filter(g => g.username === username)
            .map(g => g.score);

        return res.json({
            username: user.username,
            highestScore: user.highestScore,
            gamesPlayed: user.gamesPlayed,
            createdAt: null,
            lastLogin: null,
            recentScores: userGames
        });
    }

    const session = driver.session();

    try {
        const result = await session.run(
            `MATCH (u:User {username: $username})
            OPTIONAL MATCH (u)-[:PLAYED]->(g:Game)
            RETURN u.username as username,
                   u.highestScore as highestScore,
                   u.gamesPlayed as gamesPlayed,
                   u.createdAt as createdAt,
                   u.lastLogin as lastLogin,
                   collect(g.score) as recentScores
            LIMIT 1`,
            { username }
        );

        if (result.records.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const record = result.records[0];
        const userData = {
            username: record.get('username'),
            highestScore: record.get('highestScore').toNumber ? record.get('highestScore').toNumber() : record.get('highestScore'),
            gamesPlayed: record.get('gamesPlayed').toNumber ? record.get('gamesPlayed').toNumber() : record.get('gamesPlayed'),
            createdAt: record.get('createdAt'),
            lastLogin: record.get('lastLogin'),
            recentScores: record.get('recentScores').map(s => s.toNumber ? s.toNumber() : s)
        };

        res.json(userData);

    } catch (error) {
        console.error('User stats error:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        await session.close();
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await driver.close();
    console.log('\n👋 Neo4j driver closed');
    process.exit(0);
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    await testConnection();
    await initializeDatabase();
});
