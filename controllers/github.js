const puppeteer = require('puppeteer');

const fetchGithub = async (username) => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    
    try {
        await page.goto(`https://github.com/${username}`);
        await page.waitForNetworkIdle();
        await page.screenshot({ path: 'screenshot.png' });
        
        const data = await page.evaluate(() => {
            // Helper function to safely get text content
            const safeGetText = (selector) => {
                const element = document.querySelector(selector);
                return element ? element.innerText.trim() : null;
            };
            
            const name = safeGetText('.p-name');
            const fullName = safeGetText('.p-nickname');
            const bio = safeGetText('.p-note');
            
            // Get links with null checks
            const linkElements = document.querySelectorAll('.vcard-detail .wb-break-all');
            const links = Array.from(linkElements).map(link => {
                const linkText = link && link.innerText ? link.innerText.trim() : null;
                const linkUrl = link && link.href ? link.href : null;
                return { linkText, linkUrl };
            }).filter(link => link.linkText || link.linkUrl); // Filter out empty links
            
            // Get followers with null checks
            const followerElements = document.querySelectorAll('.Link--secondary.no-underline.no-wrap');
            const followers = Array.from(followerElements).map(follower => {
                return follower && follower.innerText ? follower.innerText.trim() : null;
            }).filter(follower => follower !== null); // Filter out null values
            
            return { name, fullName, bio, links, followers };
        });
        
        console.log('Profile data:', data);
        
        // Navigate to repositories page
        await page.goto(`https://github.com/${username}?page=1&tab=repositories`);
        await page.waitForNetworkIdle();
        await page.screenshot({ path: 'screenshot2.png' });
        
        const repoData = await page.evaluate(() => {
            // Helper function to safely get text content
            const safeGetText = (selector) => {
                const element = document.querySelector(selector);
                return element ? element.innerText.trim() : null;
            };
            
            const totalRepos = safeGetText('.Counter') || '0';
            
            const repoElements = document.querySelectorAll('.d-inline-block.mb-1');
            const repos = Array.from(repoElements).map(repo => {
                if (!repo) return null;
                
                const linkElement = repo.querySelector('a');
                const repoName = linkElement && linkElement.innerText ? linkElement.innerText.trim() : null;
                const repoLink = linkElement && linkElement.href ? linkElement.href : null;
                
                const descElement = repo.querySelector('li div div p')
                const description = descElement && descElement.innerText ? descElement.innerText.trim() : 'No description';
                
                return { repoName, repoLink, description };
            }).filter(repo => repo && repo.repoName); // Filter out null/invalid repos
            
            return { totalRepos, repos };
        });
        
        console.log('Repository data:', repoData);
        
        await browser.close();
        return { data, repoData };
        
    } catch (error) {
        console.error('Error during scraping:', error);
        await browser.close();
        throw error;
    }
};

module.exports = {
    fetchGithub
};