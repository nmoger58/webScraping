const express = require('express');
const { fetchGithub } = require('./controllers/github');
const { fetchLeetcode } = require('./controllers/leetcode');

require('dotenv').config();
const app=express();
const cors=require('cors');
const redisClient = require('./DB/redis');
app.use(cors())
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.get('/',(req,res)=>{
    res.json({
        status:true,
        message:'Welcome to the profile fetcher API',
        data:{}
    });
}
);
app.get('/github/:username',async(req,res)=>{
    const githubData=await fetchGithub(req.params.username);
    console.log(githubData);
    res.json({
        status:true,
        message:'Github data fetched successfully',
        data:githubData
    });
}
);
app.get('/leetcode/:username', async (req, res) => {
    console.log('Fetching leetcode data...');
    const username = req.params.username;
    const redisKey = `user:leetcode:${username}`;
    console.log(redisKey);

    if (redisKey) {
        const cachedData = await redisClient.get(redisKey);
        if (cachedData) {
            console.log("✅ Found in Redis cache");
            return res.status(200).json({
                success: true,
                message: "Profile fetched from Redis cache",
                data: JSON.parse(cachedData).data,
            });
        }
    }

    const leetcodeData = await fetchLeetcode(username);
    console.log(leetcodeData);

    // ✅ Do not store null or empty data
    if (leetcodeData && Object.keys(leetcodeData).length > 0) {
        await redisClient.setex(redisKey, 3600, JSON.stringify(leetcodeData));
    } else {
        return res.status(404).json({
            status: false,
            message: "Leetcode profile not found or data is empty",
            data: null,
        });
    }

    res.json({
        status: true,
        message: 'Leetcode data fetched successfully',
        data: leetcodeData
    });
});

app.listen(process.env.PORT,()=> console.log('Server is running on port '+process.env.PORT));