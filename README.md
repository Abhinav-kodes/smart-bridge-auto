# smart-bridge-auto

An automation script for FutureSkills Prime. This bot seamlessly handles course enrollments, sub-module completions, API-level quiz solving, popup handling, and auto-advancing through entire learning pathways.

---

## ✨ Features

- **Zero-Click Automation:** Scans, enrolls, and marks modules complete automatically.
- **Invisible Quiz Solver:** Intercepts quiz data, bypasses the UI, and perfectly forges passing API requests in the background.
- **Smart Navigation:** Auto-clicks "Next", handles popups, and recursively retries if a module fails to load properly.
- **Stealth Mode:** Utilizes `playwright-extra` and `puppeteer-extra-plugin-stealth` to bypass bot detection.
- **Persistent Sessions:** Saves your login state locally so you don't have to log in every single time.

---

## 📋 Prerequisites

Before you can run this script, you must have **Node.js** installed on your computer.

### How to check
```bash
node -v
npm -v
```
⚠️ If version not visible then download the package according your system

### Windows
Download and install the **LTS (Long Term Support)** version from:
https://nodejs.org/

### Linux (Ubuntu / Debian)

```bash
sudo apt update
sudo apt install nodejs npm
```
### MacOS
Install using Homebrew

If Homebrew not installed:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
Then install Node:
```bash
brew install node
```

### Verify Installation

```bash
node -v
```

It should print a version number (e.g., `v18.x.x` or `v20.x.x`).

---

## ⚙️ Installation

1. Download the project and open your terminal (or Command Prompt / PowerShell on Windows).

2. Navigate to the project folder (where the `index.js` and `package.json` files are located):

```bash
cd path/to/smart-bridge-auto/chrome
```

3. Install the required Node.js dependencies:

```bash
npm install
```

4. Install the Playwright Chromium browser binary (required for the bot to run a stealth browser):

```bash
npx playwright install chromium
```

---

## ▶️ Usage

1. Open your terminal in the project folder and start the bot:

```bash
node index.js
```

2. A Chromium browser window will automatically open and navigate to the FutureSkills Prime homepage.

3. Log in to your account manually.

4. Navigate to your desired Learning Pathway or click into the first sub-module of a course.

5. Sit back and watch — the terminal will light up, the bot will detect the URL, and it will autonomously take over to complete the entire pathway.

---

## ⚠️ Important Warnings & Notes

- **Do not minimize the browser completely.** Playwright operates best when the browser is visible or running in the background behind other windows. If you minimize it to the taskbar, the website's JavaScript might pause and freeze the bot.

- **If it gets stuck:** Occasionally, server lag might cause the bot to pause. The script has built-in auto-recovery, but if it completely hangs, press `Ctrl + C` in your terminal to stop it, then run:

```bash
node index.js
```

It will pick up exactly where it left off.
