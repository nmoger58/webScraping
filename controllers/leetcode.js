const puppeteer = require('puppeteer');

const fetchLeetcode = async (username) => {
  if (!username) {
    console.error('❌ Username not provided!');
    return { error: 'Username is required' };
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );

    console.log(`Navigating to LeetCode profile: ${username}`);
    await page.goto(`https://leetcode.com/${username}/`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    const data = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerText : null;
      };

      const getTexts = (selector) => {
        return Array.from(document.querySelectorAll(selector)).map(el => el.innerText);
      };

      const getImage = (selector) => {
        const img = document.querySelector(selector);
        return img ? img.src : null;
      };

      return {
        name: getText('div.text-label-1.break-all.text-base.font-semibold'),
        username: getText('div.text-label-3.text-xs'),
        image: getImage('img.rounded-lg.object-cover'),
        rank: getText('span.ttext-label-1.font-medium'),
        totalQuestions: getText('div.text-sd-foreground.pointer-events-none.absolute'),
        views: getText('div.flex.flex-col.space-y-1 div.flex.items-center.space-x-2'),
        languages: getTexts('div.text-xs span.text-xs.inline-flex.items-center.px-2.whitespace-nowrap.leading-6.rounded-full.text-label-3'),
        skills: getTexts('div.mb-3.mr-4.inline-block.text-xs'),
        questions: getTexts('div.text-sd-foreground.text-xs.font-medium'),
        submissions: getText('div.flex.flex-1.items-center span.text-base.font-medium'),
        streak: getText('div.flex.items-center.text-xs div.space-x-1'),
        recentSolved: getTexts('div.flex.flex-1.justify-between'),
      };
    });

    await browser.close();
    console.log(data);
    return { data };
  } catch (error) {
    console.error('❌ Error fetching LeetCode data:', error);
    return { error: 'Failed to fetch LeetCode data' };
  }
};

// Example usage (Remove or modify in production)
// fetchLeetcode('nmoger58');

module.exports = {
  fetchLeetcode,
};
