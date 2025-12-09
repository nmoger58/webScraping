const axios = require('axios');

// GraphQL API approach (faster and more reliable)
const fetchLeetcodeAPI = async (username) => {
  if (!username) {
    return { error: 'Username is required' };
  }

  try {
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            realName
            userAvatar
            ranking
            reputation
          }
          submitStats {
            acSubmissionNum {
              difficulty
              count
            }
            totalSubmissionNum {
              difficulty
              count
            }
          }
          badges {
            id
            displayName
            icon
            creationDate
          }
        }
        recentAcSubmissionList(username: $username, limit: 10) {
          title
          titleSlug
          timestamp
        }
        matchedUserStats: matchedUser(username: $username) {
          submitStats: submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
              submissions
            }
          }
        }
      }
    `;

    const response = await axios.post('https://leetcode.com/graphql', {
      query,
      variables: { username }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com'
      },
      timeout: 10000
    });

    const userData = response.data.data.matchedUser;
    const userStats = response.data.data.matchedUserStats;
    const recentSubmissions = response.data.data.recentAcSubmissionList;

    if (!userData) {
      return { error: 'User not found' };
    }

    // Process submission stats
    const getStatsByDifficulty = (stats) => {
      const result = { easy: 0, medium: 0, hard: 0, total: 0 };
      if (stats && stats.acSubmissionNum) {
        stats.acSubmissionNum.forEach(item => {
          const diff = item.difficulty.toLowerCase();
          if (diff === 'all') {
            result.total = item.count;
          } else {
            result[diff] = item.count;
          }
        });
      }
      return result;
    };

    const solvedProblems = getStatsByDifficulty(userData.submitStats);

    const data = {
      username: userData.username,
      name: userData.profile.realName || userData.username,
      image: userData.profile.userAvatar,
      rank: userData.profile.ranking || null,
      reputation: userData.profile.reputation || 0,
      solvedProblems,
      totalSolved: solvedProblems.total,
      easySolved: solvedProblems.easy,
      mediumSolved: solvedProblems.medium,
      hardSolved: solvedProblems.hard,
      recentSubmissions: recentSubmissions ? recentSubmissions.slice(0, 5).map(sub => ({
        title: sub.title,
        titleSlug: sub.titleSlug,
        timestamp: sub.timestamp,
        date: new Date(parseInt(sub.timestamp) * 1000).toLocaleDateString()
      })) : [],
      badges: userData.badges ? userData.badges.slice(0, 5).map(badge => ({
        name: badge.displayName,
        icon: badge.icon
      })) : []
    };

    return { data };
  } catch (error) {
    console.error('❌ LeetCode API Error:', error.message);
    if (error.response?.status === 404) {
      return { error: 'User not found' };
    }
    return { error: 'Failed to fetch LeetCode data', message: error.message };
  }
};

// Puppeteer fallback with updated selectors
const puppeteer = require('puppeteer');

const fetchLeetcodeScraper = async (username) => {
  if (!username) {
    return { error: 'Username is required' };
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
    });

    const page = await browser.newPage();
    
    // Block resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    console.log(`📍 Navigating to: https://leetcode.com/${username}/`);
    
    await page.goto(`https://leetcode.com/${username}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Wait for profile to load
    await page.waitForSelector('[class*="text-"]', { timeout: 8000 }).catch(() => null);
    
    // Small delay for dynamic content
    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerText.trim() : null;
      };

      const getAttr = (selector, attr) => {
        const el = document.querySelector(selector);
        return el ? el.getAttribute(attr) : null;
      };

      // Try multiple selectors for better compatibility
      const trySelectors = (selectors) => {
        for (const selector of selectors) {
          const result = getText(selector);
          if (result) return result;
        }
        return null;
      };

      return {
        username: trySelectors(['div.text-label-3', '[class*="username"]', 'div[class*="text-label-3"]']),
        name: trySelectors(['div.text-label-1.font-semibold', 'div[class*="font-semibold"]', 'h1']),
        image: getAttr('img[alt*="avatar"]', 'src') || getAttr('img.rounded-lg', 'src'),
        rank: trySelectors(['span.font-medium', 'div[class*="ranking"]']),
        totalQuestions: trySelectors(['div.text-sd-foreground', 'span[class*="total"]']),
        // Get all text content for debugging
        pageText: document.body.innerText.substring(0, 500)
      };
    });

    console.log('📊 Scraped data:', data);
    await browser.close();
    
    return { data };
  } catch (error) {
    console.error('❌ Scraper Error:', error.message);
    if (browser) await browser.close();
    return { error: 'Failed to scrape LeetCode profile', message: error.message };
  }
};

// Main function that tries API first, then falls back to scraper
const fetchLeetcode = async (username) => {
  console.log(`🔍 Fetching LeetCode profile: ${username}`);
  
  // Try API first (faster and more reliable)
  const apiResult = await fetchLeetcodeAPI(username);
  
  if (apiResult.data) {
    console.log('✅ Fetched via API');
    return apiResult;
  }
  
  console.log('⚠️ API failed, trying scraper...');
  return await fetchLeetcodeScraper(username);
};

// Fast version for batch requests
const fetchLeetcodeFast = fetchLeetcodeAPI;

// Cleanup function (not needed for API approach)
const cleanup = async () => {
  console.log('✅ Cleanup complete');
};

module.exports = {
  fetchLeetcode,
  fetchLeetcodeFast,
  fetchLeetcodeAPI,
  fetchLeetcodeScraper,
  cleanup,
};