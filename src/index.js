const express = require('express');
const consola = require('consola');
const puppeteer = require("puppeteer-extra");
const prompt = require('prompt');
const totp = require("totp-generator");
const userAgent = require('user-agents');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha')
const e = require("express");
puppeteer.use(StealthPlugin());
puppeteer.use(
    RecaptchaPlugin({
        provider: {id: '2captcha', token: '768e7b787a1fe880307750736df35267'},
        visualFeedback: true
    })
)
require('dotenv').config();

const email = process.env.PAYPAL_EMAIL;
const password = process.env.PAYPAL_PASSWORD;
const key = process.env.PAYPAL_TOTP;

prompt.start();

let browser;

async function login() {
    const page = await browser.newPage();
    await page.setUserAgent(userAgent.toString())
    // await page.goto('https://www.paypal.com/myaccount/transfer/homepage/pay');
    await page.goto('https://www.paypal.com/signin');
    await page.waitForTimeout(3000);
    // let { captchas, error } = await page.findRecaptchas()
    // console.log(captchas);
    // console.log(error);
    //
    // await page.solveRecaptchas();
    // await page.waitForTimeout(60000);
    await page.waitForSelector('#email');
    await page.focus('#email');
    await page.waitForTimeout(100);
    await page.evaluate(() => document.getElementById('email').value = "")
    await page.keyboard.type(email);
    await page.click('#btnNext');
    await page.waitForTimeout(2000);
    await page.focus('#password');
    await page.keyboard.type(password);
    await page.click('#acceptAllButton');
    await page.waitForTimeout(500);
    await page.click('#btnLogin');
    await page.waitForTimeout(2500);

    await page.focus('#otpCode');
    let token = totp(key);
    consola.info(`TOTP: ${token}`);
    // const lastLetter = token[token.length - 1];
    // token = lastLetter + token.slice(0, -1);
    for (const i of [0, 1, 2, 3, 4, 5]) {
        await page.focus('#otpCode');
        await page.keyboard.type(token[i]);
        await page.waitForTimeout(100);
    }
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await page.screenshot({path: 'example.png'});
    await page.mouse.click(340, 411);
}

async function payout(req, res) {
    try {
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: {
                width: 800, height: 1500
            },
            args: ["--disable-gpu", "--disable-dev-shm-usage", "--disable-setuid-sandbox", "--no-sandbox", "--window-size=800,1400"]
        });
        if (req.params.key !== '4112') return res.json({error: 'invalid_key'});
        let recipient = req.params.recipient;
        const recipientOriginal = recipient;
        const value = req.params.value;
        res.json({success: true, recipient, value});
        await login();
        const page = await browser.newPage();
        await page.waitForTimeout(5000);
        await page.setUserAgent(userAgent.toString())
        await page.setViewport({width: 700, height: 0, deviceScaleFactor: 0.5});
        await page.goto('https://www.paypal.com/myaccount/transfer/homepage/pay');
        await page.waitForTimeout(3000);
        await page.focus('#fn-sendRecipient');
        await page.waitForTimeout(300);
        const lastLetter = recipient[recipient.length - 1];
        recipient = lastLetter + recipient.slice(0, -1);
        await page.type('#fn-sendRecipient', recipient);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);
        await page.keyboard.type(value);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
        try {
            await page.click('#personal');
        } catch (err) {
        }
        await page.waitForTimeout(1500);
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
        });
        await page.waitForTimeout(100);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
        await page.screenshot({path: 'example.png'});
        let success = false;
        try {
            await page.waitForXPath(`//*[contains(text(), "Poinformujemy użytkownika ${recipientOriginal}")]`, {timeout: 10000});
            success = true;
        } catch (err) {
        }
        if (success)
            consola.success(`Payout successful`)
        else
            consola.error(`Payout failed`)
        await page.goto('https://www.paypal.com/bizcomponents/logout');
        await browser.close();
    } catch (err) {
        console.log(err);
        consola.error('Payout failed due to browser exception');
    }
}

async function main() {
    const app = express();
    app.all('/payout/:recipient/:value/:key', payout);
    app.get('/totp', (req, res) => (res.json({code: totp(key)})));
    const port = process.env.PORT || 4110;
    await app.listen(port);
    consola.success(`Listening on port: ${port}`);
}

main();
// payout(null, null);
