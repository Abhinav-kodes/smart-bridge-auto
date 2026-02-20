const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

(async () => {
    console.log("Booting up SBA Bot");

    const userDataDir = './chrome-session'; 
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false, 
        args: ['--start-maximized'],
        noViewport: true
    });

    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();
    
    console.log("Navigating to the FutureSkills Prime homepage...");
    await page.goto('https://www.futureskillsprime.in/');

    console.log("==========================================");
    console.log("Go ahead and log in.");
    console.log("Navigate to your first course module or the main pathway page.");
    console.log("The bot will autonomously take over and complete the entire pathway.");
    console.log("==========================================\n");

    const processedUrls = new Set();
    let parentCheckedUrl = null;

    const subModulePattern = /\/Products_detail\/\d+\/\d+.*$/;  
    const parentPattern = /\/Products_detail\/\d+\/?$/;         

    while (true) {
        try {
            const currentUrl = page.url();

            // ==========================================
            // SCENARIO A: THE SUB-MODULE AUTOMATOR
            // ==========================================
            if (subModulePattern.test(currentUrl) && !processedUrls.has(currentUrl)) {
                
                console.log(`\nSub-Module URL detected: ${currentUrl}`);
                console.log(`Triggering automation...`);
                
                processedUrls.add(currentUrl);
                parentCheckedUrl = null; 

                await page.waitForSelector('.productDetail_left', { timeout: 10000 }); 

                console.log("Allowing 3 seconds for backend tokens to initialize...");
                await page.waitForTimeout(3000); 

                // PHASE 1A: DOM-BASED ENROLMENT PASS
                console.log("Phase 1A: Scanning for unenrolled modules inside sub-module...");
                const enrolCount = await page.evaluate(async () => {
                    let productNodes = document.querySelectorAll('div[id^="pro_"]');
                    for (let node of productNodes) {
                        let currentId = node.id.split('_')[1];
                        if (!currentId || currentId === "") {
                            let prodClass = Array.from(node.classList).find(c => c.startsWith('my_ls_prod_'));
                            if (prodClass) {
                                currentId = prodClass.replace('my_ls_prod_', '');
                                node.id = `pro_${currentId}`;
                            }
                        }
                    }

                    let enrolBtns = Array.from(document.querySelectorAll('.getStarted'))
                        .filter(btn => btn.innerText.trim().toLowerCase() === 'enrol' && btn.offsetParent !== null);
                    
                    for (let i = 0; i < enrolBtns.length; i++) {
                        enrolBtns[i].click();
                        await new Promise(r => setTimeout(r, 6000)); 
                    }
                    return enrolBtns.length;
                });

                if (enrolCount > 0) console.log(`Successfully enrolled in ${enrolCount} modules!`);

                // PHASE 1B: DOM-BASED COMPLETION PASS
                console.log("Phase 1B: Filtering and marking sub-modules complete...");
                const completeCount = await page.evaluate(async () => {
                    let productNodes = document.querySelectorAll('div[id^="pro_"]');
                    let pendingIds = [];

                    for (let node of productNodes) {
                        let titleNode = node.querySelector('h3');
                        if (titleNode && titleNode.innerText.trim().toLowerCase() === 'quiz') continue; 

                        let completedSpan = node.querySelector('.compltxt');
                        if (completedSpan && completedSpan.offsetParent !== null) continue; 

                        let currentId = node.id.split('_')[1];
                        if (currentId && currentId !== "") pendingIds.push(currentId);
                    }

                    for (let j = 0; j < pendingIds.length; j++) {
                        let currentId = pendingIds[j];
                        let startBtn = document.querySelector(`#pro_${currentId} .getStarted`);
                        if (startBtn && startBtn.offsetParent !== null) {
                            startBtn.click();
                            await new Promise(r => setTimeout(r, 1000)); 
                        }

                        if (typeof window.mark_as_complete_hub_product === "function") {
                            window.mark_as_complete_hub_product(currentId);
                        }
                        
                        if (j < pendingIds.length - 1) await new Promise(resolve => setTimeout(resolve, 3500));
                    }
                    return pendingIds.length;
                });

                console.log(`Phase 1 complete! Sent ${completeCount} completion payloads.`);

                // STABILIZATION RELOAD
                if (enrolCount > 0 || completeCount > 0) {
                    console.log("Reloading page to synchronize UI with server state...");
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await page.waitForSelector('.productDetail_left', { timeout: 15000 }).catch(()=>{});
                    await page.waitForTimeout(3000); 
                }

                // ==========================================
                // PHASE 2 & 3: CHECK FOR QUIZ & HANDLE IFRAMES
                // ==========================================
                console.log("Checking quiz status...");
                const launchBtnElement = await page.waitForSelector('.launchBtn', { state: 'attached', timeout: 5000 }).catch(() => null);
                
                if (launchBtnElement) {
                    const launchBtn = page.locator('.launchBtn').first(); 
                    const btnText = await launchBtn.textContent();
                    
                    if (btnText.trim().toLowerCase() === 'retake') {
                        console.log("Quiz is already completed. Skipping!");
                    } else {
                        console.log("Launching Quiz Instance...");
                        
                        const [quizPage] = await Promise.all([
                            context.waitForEvent('page'),
                            launchBtn.click() 
                        ]);

                        await quizPage.waitForLoadState('networkidle');
                        console.log("Quiz tab opened. Hunting for the iframe...");

                        await quizPage.waitForTimeout(3000); 

                        let targetFrame = quizPage.mainFrame();
                        let frameFound = false;

                        for (const frame of quizPage.frames()) {
                            const btnExists = await frame.$('.start_quiz_btn.start_btn').catch(() => null);
                            if (btnExists) {
                                targetFrame = frame;
                                frameFound = true;
                                console.log(`Target locked! Quiz found inside iframe: ${frame.url()}`);
                                break;
                            }
                        }

                        if (!frameFound) console.log("Could not find an iframe with the button. Defaulting to main page...");

                        try {
                            const startQuizSelector = '.start_quiz_btn.start_btn';
                            await targetFrame.waitForSelector(startQuizSelector, { state: 'visible', timeout: 10000 });
                            
                            console.log("Button visible! Waiting 1.5s for event listeners...");
                            await quizPage.waitForTimeout(1500);
                            await targetFrame.click(startQuizSelector);

                            console.log("Start Quiz clicked! Extracting data and forging API requests...");

                            // Failsafe wait for questions data
                            await targetFrame.waitForFunction(() => typeof window.questions_data !== 'undefined' && window.questions_data.length > 0, { timeout: 5000 }).catch(() => console.log("Warning: questions_data array took too long to render."));

                            const frameError = await targetFrame.evaluate(async () => {
                                try {
                                    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || document.querySelector('input[name="authenticity_token"]')?.value || '';
                                    const urlParams = new URLSearchParams(window.location.search);
                                    const c_id = urlParams.get('c_id') || '';
                                    const content_id = urlParams.get('content_id') || urlParams.get('id') || '';
                                    const quiz_url_params = urlParams.get('quiz_url_params') || '';

                                    let payload = new URLSearchParams();
                                    payload.append('utf8', '✓');
                                    payload.append('authenticity_token', csrfToken);
                                    payload.append('content_id', content_id);
                                    payload.append('id', content_id);
                                    payload.append('current_community_id', c_id);
                                    payload.append('enb_id', content_id);
                                    payload.append('cont_type', 'enablr');
                                    payload.append('from', 'content_player');
                                    payload.append('single_node_hub', 'false');
                                    payload.append('content_ui', 'true');
                                    if (quiz_url_params) payload.append('quiz_url_params', quiz_url_params);

                                    if (!window.questions_data) return "window.questions_data is missing!";

                                    window.questions_data.forEach(q => {
                                        let correctOpt = q.all_options.find(opt => opt.is_true == 1 || opt.is_true === true || opt.is_true === 'true');
                                        if (correctOpt) {
                                            payload.append(`select_option_${q.ques_id}`, correctOpt.answer_id);
                                        } else if (q.all_options.length > 0) {
                                            payload.append(`select_option_${q.ques_id}`, q.all_options[0].answer_id);
                                        }
                                    });

                                    await fetch(`/LX/quiz_question_answers/create_survey?c_id=${encodeURIComponent(c_id)}`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
                                        body: payload.toString()
                                    });

                                    let timePayload = new URLSearchParams();
                                    timePayload.append('timeSpentOn', `${content_id}~~120`);
                                    timePayload.append('paused_time', '');

                                    await fetch(`/LX/contents/update_time_spent?current_community_id=${encodeURIComponent(c_id)}`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
                                        body: timePayload.toString()
                                    });

                                    await fetch(`/LX/vccourses/declare_course_complete_self_pace?c_id=${encodeURIComponent(c_id)}&content_player=true&new_ui_flag=true&single_node_hub=false`, {
                                        method: 'GET',
                                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                                    });

                                    return null; 
                                } catch (e) {
                                    return e.message; 
                                }
                            });

                            if (frameError) {
                                console.log(`API Forgery Failed internally: ${frameError}`);
                            } else {
                                console.log("Quiz forged, telemetry sent, and result processed!");
                            }
                        } catch (quizErr) {
                            console.log(`Quiz processing threw an exception: ${quizErr.message}`);
                        }

                        console.log("Closing quiz tab...");
                        await quizPage.waitForTimeout(1000); 
                        await quizPage.close().catch(()=>{}); 
                        
                        console.log("Reloading main page to verify quiz completion...");
                        await page.waitForTimeout(1500);
                        await page.reload({ waitUntil: 'domcontentloaded' });
                        await page.waitForSelector('.productDetail_left', { timeout: 15000 }).catch(()=>{});
                    }
                } else {
                    console.log("No quiz found on this page.");
                }
                
                // ==========================================
                // PHASE 4: AUTO-ADVANCE / FAILSAFE RERUN
                // ==========================================
                console.log("Phase 4: Waiting for page to stabilize to find the 'Next' button...");
                
                await page.waitForSelector('#pathway_button_content', { state: 'attached', timeout: 15000 }).catch(() => null);
                await page.waitForTimeout(2000); 

                // Check for an active Next button
                const activeNextBtnSelector = 'button.next-button:not(.disabled):not([disabled])';
                const activeNextBtn = page.locator(activeNextBtnSelector).first();

                // Check for a disabled Next button
                const disabledNextBtnSelector = 'button.next-button.disabled, button.next-button[disabled]';
                const disabledNextBtn = page.locator(disabledNextBtnSelector).first();
                
                if (await activeNextBtn.count() > 0) {
                    console.log("Next button found! Moving to the next module in 3 seconds...");
                    await page.waitForTimeout(3000); 
                    await activeNextBtn.click();

                    // POPUP HUNTER
                    console.log("Checking for confirmation popup...");
                    try {
                        const okButton = page.locator('button:has-text("OK"), button:has-text("Ok")').first();
                        await okButton.waitFor({ state: 'visible', timeout: 5000 });
                        await okButton.click();
                        console.log("Clicked 'OK' to dismiss popup!");
                    } catch (e) {
                        console.log("No popup appeared. Moving forward.");
                    }

                } else if (await disabledNextBtn.count() > 0) {
                    // THE FAILSAFE
                    console.log("WARNING: The 'Next' button is DISABLED!");
                    console.log("This usually means a sub-module was missed. Rerunning the automation loop for this page...");
                    
                    // Clear this URL from memory so the loop runs it again
                    processedUrls.delete(currentUrl); 
                    
                    // Force a reload to start completely fresh
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(3000);

                } else {
                    console.log("No 'Next' button found at all. This appears to be the end of the course!");
                }
                
                console.log("Automation cycle complete!");
            }
            
            // ==========================================
            // SCENARIO B: THE PARENT PATHWAY NAVIGATOR
            // ==========================================
            else if (parentPattern.test(currentUrl) && currentUrl !== parentCheckedUrl) {
                console.log(`\nParent Pathway URL detected: ${currentUrl}`);
                console.log("Scanning for the next available incomplete module...");

                await page.waitForSelector('.productDetail_left', { timeout: 3000 }).catch(() => null);
                await page.waitForTimeout(2000); 

                const clickedIntoModule = await page.evaluate(async () => {
                    let productNodes = document.querySelectorAll('div[id^="pro_"]');
                    
                    for (let node of productNodes) {
                        let completedSpan = node.querySelector('.compltxt');
                        if (completedSpan && completedSpan.offsetParent !== null) continue;

                        let btn = node.querySelector('.getStarted');
                        if (btn && btn.offsetParent !== null) {
                            let btnText = btn.innerText.trim().toLowerCase();
                            
                            if (btnText === 'enrol') {
                                btn.click();
                                await new Promise(r => setTimeout(r, 6000));
                                
                                let newBtn = node.querySelector('.getStarted');
                                if (newBtn && newBtn.offsetParent !== null) newBtn.click();
                                return true;
                            } 
                            else {
                                btn.click();
                                return true;
                            }
                        }
                    }
                    return false;
                });

                if (clickedIntoModule) {
                    console.log("Successfully clicked into the next module! Waiting for it to load...");
                    await page.waitForNavigation({ timeout: 3000 }).catch(() => {});
                    parentCheckedUrl = null; 
                } else {
                    console.log("All modules on this Parent Pathway page appear to be completed!");
                    parentCheckedUrl = currentUrl; 
                }
            }

        } catch (err) {
            console.log("\n[DEBUG] Loop Interrupted! Error Details:");
            console.log(err.message);
        }
        
        await page.waitForTimeout(2000);
    }
})();