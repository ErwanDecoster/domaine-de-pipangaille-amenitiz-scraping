import fs from 'fs';
import path from 'path';

export class SessionManager {
  constructor(sessionDir = './session') {
    this.sessionDir = sessionDir;
    this.cookiesFile = path.join(sessionDir, 'cookies.json');
    
    // Ensure session directory exists
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
  }

  async saveCookies(page) {
    const cookies = await page.cookies();
    fs.writeFileSync(this.cookiesFile, JSON.stringify(cookies, null, 2));
  }

  async loadCookies(page) {
    if (!fs.existsSync(this.cookiesFile)) {
      return false;
    }

    const cookies = JSON.parse(fs.readFileSync(this.cookiesFile, 'utf8'));
    await page.setCookie(...cookies);
    return true;
  }

  clearSession() {
    if (fs.existsSync(this.cookiesFile)) {
      fs.unlinkSync(this.cookiesFile);
    }
  }
}
