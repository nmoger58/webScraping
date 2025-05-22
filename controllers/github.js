const puppeteer = require('puppeteer');

const fetchGithub = async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto('https://github.com/saadhussain01306');
    await page.waitForNetworkIdle()
    await page.screenshot({ path: 'screenshot.png' });
    const data = await page.evaluate(() => {
        const name = document.querySelector('.p-name').innerText;
        const fullName = document.querySelector('.p-nickname').innerText
        const bio = document.querySelector('.p-note').innerText
        const linkElements = document.querySelectorAll('.vcard-detail .wb-break-all'); // Select the <a> tag inside .wb-break-all

        const links = Array.from(linkElements).map(link => {
            // Ensure link.innerText and link.href are not null
            const linkText = link.innerText ? link.innerText.trim() : null;
            const linkUrl = link.href ? link.href : null;
            return { linkText, linkUrl };
        });
        const followers = Array.from(document.querySelectorAll('.Link--secondary.no-underline.no-wrap')).map(follower => {
            const followerText = follower.innerText ? follower.innerText.trim() : null;
            return followerText;
        });

        return { name, fullName, bio, links, followers };
    })
    console.log(data);
    await page.goto('https://github.com/saadhussain01306?page=1&tab=repositories');
    await page.waitForNetworkIdle()
    await page.screenshot({ path: 'screenshot2.png' });
    const repoData=await page.evaluate(() => {
       const totalRepos=document.querySelector('.Counter').innerText
       const repos = Array.from(document.querySelectorAll('.d-inline-block.mb-1')).map(repo => {
            const repoName = repo.querySelector('a').innerText;
            const repoLink = repo.querySelector('a').href; // Selector for description
            return { repoName, repoLink};
        });
        return { totalRepos, repos };
    })
    console.log(repoData);
    await browser.close(); 
    return { data, repoData };
}
   
    

module.exports={
    fetchGithub
}