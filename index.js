const express = require('express');
const { fetchGithub } = require('./controllers/github');
const { fetchLeetcode, fetchLeetcodeFast, cleanup } = require('./controllers/leetcode');

require('dotenv').config();
const app = express();
const cors = require('cors');
const redisClient = require('./DB/redis');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: 'Welcome to the Profile Fetcher API',
        endpoints: {
            github: 'GET /github/:username',
            leetcode: 'GET /leetcode/:username',
            batch: 'POST /batch',
            clearCache: 'DELETE /cache/:platform/:username'
        },
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// GitHub endpoint with caching
app.get('/github/:username', async (req, res) => {
    const startTime = Date.now();
    try {
        const username = req.params.username;
        
        if (!username || username.trim() === '') {
            return res.status(400).json({
                status: false,
                message: 'Username is required',
                data: null
            });
        }

        const redisKey = `user:github:${username.toLowerCase()}`;

        // Check Redis cache first
        const cachedData = await redisClient.get(redisKey);
        if (cachedData) {
            const responseTime = Date.now() - startTime;
            console.log(`✅ GitHub cache hit: ${username} (${responseTime}ms)`);
            const parsed = JSON.parse(cachedData);
            return res.status(200).json({
                status: true,
                message: 'Github data fetched from cache',
                data: parsed.data || parsed,
                cached: true,
                responseTime: `${responseTime}ms`
            });
        }

        // Fetch from GitHub
        console.log(`🔄 Fetching GitHub data: ${username}`);
        const githubData = await fetchGithub(username);

        if (!githubData || githubData.error) {
            return res.status(404).json({
                status: false,
                message: githubData?.error || 'Github profile not found',
                data: null
            });
        }

        // Validate data
        if (!githubData.data || Object.keys(githubData.data).length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Github profile not found or data is empty',
                data: null
            });
        }

        // Cache the result (1 hour)
        await redisClient.setex(redisKey, 3600, JSON.stringify(githubData));
        
        const responseTime = Date.now() - startTime;
        console.log(`💾 Cached GitHub data: ${username} (${responseTime}ms)`);

        res.json({
            status: true,
            message: 'Github data fetched successfully',
            data: githubData.data,
            cached: false,
            responseTime: `${responseTime}ms`
        });
    } catch (error) {
        console.error('❌ GitHub Error:', error.message);
        res.status(500).json({
            status: false,
            message: 'Failed to fetch Github data',
            error: error.message,
            responseTime: `${Date.now() - startTime}ms`
        });
    }
});

// LeetCode endpoint with optimized caching and API fallback
app.get('/leetcode/:username', async (req, res) => {
    const startTime = Date.now();
    try {
        const username = req.params.username;
        
        if (!username || username.trim() === '') {
            return res.status(400).json({
                status: false,
                message: 'Username is required',
                data: null
            });
        }

        const redisKey = `user:leetcode:${username.toLowerCase()}`;

        // Check Redis cache first
        const cachedData = await redisClient.get(redisKey);
        if (cachedData) {
            const responseTime = Date.now() - startTime;
            console.log(`✅ LeetCode cache hit: ${username} (${responseTime}ms)`);
            const parsed = JSON.parse(cachedData);
            return res.status(200).json({
                status: true,
                message: 'Leetcode data fetched from cache',
                data: parsed.data || parsed,
                cached: true,
                responseTime: `${responseTime}ms`
            });
        }

        // Fetch from LeetCode using fast API method
        console.log(`🔄 Fetching LeetCode data: ${username}`);
        const leetcodeData = await fetchLeetcodeFast(username);

        // Handle errors
        if (leetcodeData.error) {
            return res.status(404).json({
                status: false,
                message: leetcodeData.error,
                data: null,
                responseTime: `${Date.now() - startTime}ms`
            });
        }

        // Validate data before caching
        if (!leetcodeData.data || Object.keys(leetcodeData.data).length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Leetcode profile not found or data is empty',
                data: null,
                responseTime: `${Date.now() - startTime}ms`
            });
        }

        // Cache the result (1 hour TTL)
        await redisClient.setex(redisKey, 3600, JSON.stringify(leetcodeData));
        
        const responseTime = Date.now() - startTime;
        console.log(`💾 Cached LeetCode data: ${username} (${responseTime}ms)`);

        res.json({
            status: true,
            message: 'Leetcode data fetched successfully',
            data: leetcodeData.data,
            cached: false,
            responseTime: `${responseTime}ms`
        });
    } catch (error) {
        console.error('❌ LeetCode Error:', error.message);
        res.status(500).json({
            status: false,
            message: 'Failed to fetch Leetcode data',
            error: error.message,
            responseTime: `${Date.now() - startTime}ms`
        });
    }
});

// Batch endpoint for fetching multiple profiles
app.post('/batch', async (req, res) => {
    const startTime = Date.now();
    try {
        const { usernames, platform } = req.body;

        if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
            return res.status(400).json({
                status: false,
                message: 'usernames array is required',
                data: null
            });
        }

        if (usernames.length > 20) {
            return res.status(400).json({
                status: false,
                message: 'Maximum 20 usernames allowed per batch request',
                data: null
            });
        }

        if (!['github', 'leetcode'].includes(platform)) {
            return res.status(400).json({
                status: false,
                message: 'platform must be either "github" or "leetcode"',
                data: null
            });
        }

        console.log(`📦 Batch request: ${usernames.length} ${platform} profiles`);

        const results = await Promise.allSettled(
            usernames.map(async (username) => {
                const redisKey = `user:${platform}:${username.toLowerCase()}`;
                
                // Try cache first
                const cached = await redisClient.get(redisKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    return {
                        username,
                        data: parsed.data || parsed,
                        cached: true,
                        error: null,
                        status: 'success'
                    };
                }

                // Fetch data
                const fetchFn = platform === 'leetcode' ? fetchLeetcodeFast : fetchGithub;
                const result = await fetchFn(username);

                if (result.error) {
                    return { 
                        username, 
                        data: null, 
                        error: result.error, 
                        cached: false,
                        status: 'error'
                    };
                }

                // Validate data
                if (!result.data || Object.keys(result.data).length === 0) {
                    return {
                        username,
                        data: null,
                        error: 'Profile not found or empty',
                        cached: false,
                        status: 'error'
                    };
                }

                // Cache result
                await redisClient.setex(redisKey, 3600, JSON.stringify(result));
                
                return {
                    username,
                    data: result.data || result,
                    cached: false,
                    error: null,
                    status: 'success'
                };
            })
        );

        // Process results
        const processedResults = results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return {
                    username: usernames[index],
                    data: null,
                    error: result.reason?.message || 'Unknown error',
                    cached: false,
                    status: 'error'
                };
            }
        });

        const successCount = processedResults.filter(r => r.status === 'success').length;
        const responseTime = Date.now() - startTime;

        console.log(`✅ Batch complete: ${successCount}/${usernames.length} successful (${responseTime}ms)`);

        res.json({
            status: true,
            message: 'Batch fetch completed',
            platform,
            summary: {
                total: usernames.length,
                successful: successCount,
                failed: usernames.length - successCount,
                responseTime: `${responseTime}ms`
            },
            results: processedResults
        });
    } catch (error) {
        console.error('❌ Batch Error:', error.message);
        res.status(500).json({
            status: false,
            message: 'Batch fetch failed',
            error: error.message,
            responseTime: `${Date.now() - startTime}ms`
        });
    }
});

// Get profile with both GitHub and LeetCode data
app.get('/profile/:username', async (req, res) => {
    const startTime = Date.now();
    try {
        const username = req.params.username;

        if (!username || username.trim() === '') {
            return res.status(400).json({
                status: false,
                message: 'Username is required',
                data: null
            });
        }

        console.log(`🔍 Fetching combined profile: ${username}`);

        // Fetch both profiles in parallel
        const [githubResult, leetcodeResult] = await Promise.allSettled([
            fetchGithub(username),
            fetchLeetcodeFast(username)
        ]);

        const profile = {
            username,
            github: githubResult.status === 'fulfilled' && !githubResult.value.error
                ? githubResult.value.data
                : null,
            leetcode: leetcodeResult.status === 'fulfilled' && !leetcodeResult.value.error
                ? leetcodeResult.value.data
                : null
        };

        const responseTime = Date.now() - startTime;

        res.json({
            status: true,
            message: 'Combined profile fetched successfully',
            data: profile,
            responseTime: `${responseTime}ms`
        });
    } catch (error) {
        console.error('❌ Profile Error:', error.message);
        res.status(500).json({
            status: false,
            message: 'Failed to fetch profile',
            error: error.message,
            responseTime: `${Date.now() - startTime}ms`
        });
    }
});

// Clear cache endpoint
app.delete('/cache/:platform/:username', async (req, res) => {
    try {
        const { platform, username } = req.params;

        if (!['github', 'leetcode'].includes(platform)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid platform. Use "github" or "leetcode"'
            });
        }

        const redisKey = `user:${platform}:${username.toLowerCase()}`;
        const deleted = await redisClient.del(redisKey);
        
        console.log(`🗑️ Cache cleared: ${redisKey} (${deleted ? 'found' : 'not found'})`);

        res.json({
            status: true,
            message: deleted ? 'Cache cleared successfully' : 'No cache found',
            deleted: deleted > 0
        });
    } catch (error) {
        console.error('❌ Cache clear error:', error.message);
        res.status(500).json({
            status: false,
            message: 'Failed to clear cache',
            error: error.message
        });
    }
});

// Clear all cache for a platform
app.delete('/cache/:platform', async (req, res) => {
    try {
        const { platform } = req.params;

        if (!['github', 'leetcode'].includes(platform)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid platform. Use "github" or "leetcode"'
            });
        }

        const pattern = `user:${platform}:*`;
        const keys = await redisClient.keys(pattern);
        
        if (keys.length === 0) {
            return res.json({
                status: true,
                message: 'No cache entries found',
                deleted: 0
            });
        }

        const deleted = await redisClient.del(...keys);
        console.log(`🗑️ Bulk cache clear: ${deleted} ${platform} entries removed`);

        res.json({
            status: true,
            message: `Cache cleared for ${platform}`,
            deleted
        });
    } catch (error) {
        console.error('❌ Bulk cache clear error:', error.message);
        res.status(500).json({
            status: false,
            message: 'Failed to clear cache',
            error: error.message
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: false,
        message: 'Endpoint not found',
        path: req.path,
        method: req.method,
        availableEndpoints: {
            github: 'GET /github/:username',
            leetcode: 'GET /leetcode/:username',
            profile: 'GET /profile/:username',
            batch: 'POST /batch',
            clearCache: 'DELETE /cache/:platform/:username'
        }
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(500).json({
        status: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 ${signal} received, closing server gracefully...`);
    try {
        await cleanup(); // Close puppeteer browser
        await redisClient.quit(); // Close Redis connection
        console.log('✅ All connections closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log('═'.repeat(50));
    console.log(`🚀 Profile Fetcher API v2.0`);
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('═'.repeat(50));
});