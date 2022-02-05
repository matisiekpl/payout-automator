const express = require('express');
const consola = require('consola');
const puppeteer = require("puppeteer");
const prompt = require('prompt');
require('dotenv').config();

const email = process.env.PAYPAL_EMAIL;
const password = process.env.PAYPAL_PASSWORD;

prompt.start();

async function payout(req, res) {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: {
            width: 800,
            height: 1500
        },
        args: [
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-setuid-sandbox",
            "--no-sandbox",
            "--window-size=800,1400"
        ]
    });
    const page = await browser.newPage();
    await page.goto('https://www.paypal.com/myaccount/transfer/homepage/pay');
    await page.waitForSelector('#email');
    await page.focus('#email');
    await page.keyboard.type(email);
    await page.click('#btnNext');
    await page.waitForTimeout(2000);
    await page.focus('#password');
    await page.keyboard.type(password);
    await page.click('#acceptAllButton');
    await page.waitForTimeout(500);
    await page.click('#btnLogin');
    await page.mouse.click(340, 400);
    await page.waitForTimeout(5000);
    await page.mouse.click(344, 575);
    await page.waitForTimeout(3000);
    await page.focus('#answer');
    const {code} = await prompt.get(['code']);
    await page.keyboard.type(code);
    await page.click('#securityCodeSubmit');
    const {recipient} = await prompt.get(['recipient']);
    await page.focus('#fn-sendRecipient');
    await page.keyboard.type(recipient);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await page.keyboard.type('1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    await page.click('.ppvx_text--md___5-7-5');
    await page.waitForTimeout(500);
    await page.click('.vx_text-3');
    await page.waitForTimeout(3000);
    await page.mouse.click(344, 962);
}

async function main() {
    const app = express();
    app.post('/payout', payout);
    const port = process.env.PORT || 4110;
    await app.listen(port);
    consola.success(`Listening on port: ${port}`);
}

// main();
payout(null, null);
