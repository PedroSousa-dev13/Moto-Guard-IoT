const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const screenshotsDir = path.join(__dirname, '..', 'imagens', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('Navigating to Home...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await delay(1000);
  await page.screenshot({ path: path.join(screenshotsDir, 'home_login.png') });
  console.log('Saved home_login.png');

  // Navigate to login
  console.log('Navigating to Login page...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await delay(1500);

  // Type login credentials
  console.log('Typing credentials...');
  await page.type('input[type="email"]', 'dadsa@sdasda.com');
  await page.type('input[type="password"]', 'password123');

  // Click login
  console.log('Clicking login button...');
  await page.click('button[type="submit"]');

  console.log('Waiting for login and redirect to /dashboard...');
  await delay(4000); // give time to load dashboard and redirect

  const pagesToScreenshot = [
    { url: '/dashboard', name: 'dashboard.png' },
    { url: '/garage', name: 'garagem.png' },
    { url: '/map', name: 'mapa.png' },
    { url: '/analytics', name: 'analytics.png' },
    { url: '/trips', name: 'viagens.png' },
    { url: '/real-simulator', name: 'simulador.png' },
    { url: '/alertas', name: 'alertas.png' },
    { url: '/settings', name: 'configuracoes.png' },
    { url: '/profile', name: 'perfil.png' },
    { url: '/about', name: 'sobre.png' },
    { url: '/gpx', name: 'gpx.png' },
    { url: '/gpx-simulator', name: 'gpx_simulador.png' },
    { url: '/simulator-contexts', name: 'simulator_contexts.png' }
  ];

  for (const item of pagesToScreenshot) {
    console.log(`Navigating to ${item.url}...`);
    await page.goto(`http://localhost:3000${item.url}`, { waitUntil: 'networkidle2' });
    await delay(1500); // ensure charts/animations load
    await page.screenshot({ path: path.join(screenshotsDir, item.name) });
    console.log(`Saved ${item.name}`);
  }

  // Try to take detailed trip screenshot
  console.log('Navigating to /trips for detailed trip screenshot...');
  await page.goto('http://localhost:3000/trips', { waitUntil: 'networkidle2' });
  await delay(1500);
  
  // Click the first completed link that starts with /trips/ (the second one, since the first is the active trip)
  const tripLinks = await page.$$('a[href^="/trips/"]');
  if (tripLinks.length > 0) {
    const completedLink = tripLinks.length > 1 ? tripLinks[1] : tripLinks[0];
    await completedLink.click();
    await delay(2500); // give Leaflet map and charts plenty of time to render
    await page.screenshot({ path: path.join(screenshotsDir, 'detalhe_viagem.png') });
    console.log('Saved detalhe_viagem.png');
  } else {
    // try to find any clickable element that leads to trip detail (maybe row)
    console.log('Could not find specific /trips/ links, saving detalhe_viagem.png anyway');
    await page.screenshot({ path: path.join(screenshotsDir, 'detalhe_viagem.png') });
  }

  await browser.close();
  console.log('All screenshots taken!');
})();
