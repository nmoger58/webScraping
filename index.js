const express = require('express');
const { fetchGithub } = require('./controllers/github');
const { fetchLeetcode } = require('./controllers/leetcode');
require('dotenv').config();
const app=express();

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
app.get('/leetcode/:username',async(req,res)=>{
    console.log('Fetching leetcode data...');
    const leetcodeData=await fetchLeetcode(req.params.username)
    console.log(leetcodeData);
    res.json({
        status:true,
        message:'Leetcode data fetched successfully',
        data:leetcodeData
    });
}
);
app.listen(process.env.PORT,()=> console.log('Server is running on port 3000'));