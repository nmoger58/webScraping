const express = require('express');
const { fetchGithub } = require('./controllers/github');

const app=express();

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.get('/',(req,res)=>{
    const githubData=fetchGithub();
    console.log(githubData);
    res.send('Hello World');
}
);
app.listen(3000,()=>{
    console.log('Server is running on port 3000');
}
);