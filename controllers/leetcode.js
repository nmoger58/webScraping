const puppeteer = require('puppeteer');

const fetchLeetcode = async () =>{
  const browser = await puppeteer.launch({
    headless: true,
     args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
    const page = await browser.newPage();
    await page.setUserAgent(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  );
    console.log('Navigating to LeetCode profile...');
    await page.goto('https://leetcode.com/lucifer58/', {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    await page.screenshot({ path: 'screenshot.png' });
    const data = await page.evaluate(() => {
      const singleFetch=(classname)=>{
         return document.querySelector(classname).innerText;
      }
      const multifetch=(classname)=>{
          return Array.from(document.querySelectorAll(classname)).map(el => el.innerText);
      }
        const name =singleFetch('div.text-label-1.break-all.text-base.font-semibold')// Select the <a> tag inside .wb-break-all
        const image=document.querySelector('img.rounded-lg.object-cover').src
        const username=singleFetch('div.text-label-3.text-xs')
        const rank=singleFetch('span.ttext-label-1.font-medium')
        const totalQuestions = singleFetch('div.text-sd-foreground.pointer-events-none.absolute')
        const views=singleFetch('div.flex.flex-col.space-y-1 div.flex.items-center.space-x-2')
        const languages=multifetch('div.text-xs span.text-xs.inline-flex.items-center.px-2.whitespace-nowrap.leading-6.rounded-full.text-label-3')
        const skills=multifetch('div.mb-3.mr-4.inline-block.text-xs');
        const questions=multifetch('div.text-sd-foreground.text-xs.font-medium')
        const submissions=singleFetch('div.flex.flex-1.items-center span.text-base.font-medium')
        const streak=singleFetch('div.flex.items-center.text-xs div.space-x-1')
        // const maxStreak=singleFetch('div.flex.items-center.text-xs div.space-x-1 span.font-medium.text-label-2')
        const recentSolved=multifetch('div.flex.flex-1.justify-between')
       return {name,username,image,rank,totalQuestions,views,languages,skills,questions,submissions,streak,recentSolved};
    })
    console.log(data);
    await browser.close();
    return {data};
}
fetchLeetcode()
module.exports = {
  fetchLeetcode,
};