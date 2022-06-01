const express = require('express');
const consola = require('consola');
const puppeteer = require("puppeteer-extra");
puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')())
const prompt = require('prompt');
const totp = require("totp-generator");
const userAgent = require('user-agents');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha')

const {MongoClient} = require('mongodb');
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

async function ensureBrowserWorking() {
    if (browser == null)
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: {
                width: 800, height: 1500
            },
            args: ["--disable-gpu", "--disable-dev-shm-usage", "--disable-setuid-sandbox", "--no-sandbox", "--window-size=800,1400"]
        });
    const p = await browser.newPage();
    await p.goto('https://example.com/');
}

async function login() {
    await ensureBrowserWorking();
    const page = await browser.newPage();
    // await page.goto('https://www.paypal.com/myaccount/transfer/homepage/pay');
    await page.goto('https://www.paypal.com/signin');
    await page.waitForTimeout(5000);
    // let { captchas, error } = await page.findRecaptchas()
    // console.log(captchas);
    // console.log(error);
    //
    // await page.solveRecaptchas();
    // await page.waitForTimeout(60000);
    await page.waitForSelector('#email');
    await page.focus('#email');
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('email').value = "")
    await page.keyboard.type(email);
    await page.click('#btnNext');
    await page.waitForTimeout(5000);
    await page.focus('#password');
    await page.keyboard.type(password);
    await page.click('#acceptAllButton');
    await page.waitForTimeout(800);
    await page.click('#btnLogin');
    await page.waitForTimeout(5500);

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

async function payout(recipientOriginal, value) {
    try {
        let recipient = recipientOriginal;
        try {
            await login();
        } catch (err) {
        }
        const page = await browser.newPage();
        await page.waitForTimeout(7000);
        await page.setViewport({width: 700, height: 0, deviceScaleFactor: 0.5});
        await page.goto('https://www.paypal.com/myaccount/transfer/homepage/pay');
        await page.waitForTimeout(5000);
        await page.click('#fn-sendRecipient');
        await page.waitForTimeout(500);
        const lastLetter = recipient[recipient.length - 1];
        recipient = lastLetter + recipient.slice(0, -1);
        // await page.type('#fn-sendRecipient', recipientOriginal, {delay: 100});
        for (const c of recipientOriginal) {
            await page.keyboard.type(c, {delay: 100});
        }
        // await page.keyboard.type(recipient, {delay: 100})
        // await page.evaluate((recipient) => document.getElementById('fn-sendRecipient').value = recipient, recipientOriginal);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);
        await page.keyboard.type(value);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(5000);
        try {
            await page.click('#personal');
        } catch (err) {
        }
        await page.waitForTimeout(2500);
        // await page.evaluate(() => {
        //     window.scrollBy(0, window.innerHeight);
        // });
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(5000);
        await page.screenshot({path: 'example.png'});
        let success = false;
        try {
            await page.waitForXPath(`//*[contains(text(), "Poinformujemy użytkownika ${recipientOriginal}")]`, {timeout: 30000});
            success = true;
        } catch (err) {
            consola.error(err)
        }
        if (success)
            consola.success(`Payout successful`)
        else
            consola.error(`Payout failed`)
        await page.goto('https://www.paypal.com/bizcomponents/logout');
        await browser.close();
        return success;
    } catch (err) {
        console.log(err);
        consola.error('Payout failed due to browser exception');
        return false;
    }
}

async function listen() {
    await ensureBrowserWorking();
    const app = express();
    app.get('/totp', (req, res) => (res.json({code: totp(key)})));
    const port = process.env.PORT || 4110;
    await app.listen(port);
    consola.success(`Listening on port: ${port}`);
}

async function watch() {
    await listen();
    const client = await MongoClient.connect(process.env.MONGO_URI, {useNewUrlParser: true});
    const db = client.db('psc_exchange');
    const coll = db.collection('exchanges');
    while (true) {
        const exchange = await coll.findOne({
            payout_method: 'paypal',
            payout_status: 'pending',
            payment_status: 'valid'
        });
        if (exchange) {
            consola.info(exchange);
            exchange.payout_status = 'automated_payout_working';
            await coll.updateOne({_id: exchange._id}, {$set: exchange});
            consola.info(`Sending ${exchange.effective_value} PLN to ${exchange.paypalEmail}`);
            const success = await payout(exchange.paypalEmail, (Math.round(exchange.effective_value * 100) / 100).toFixed(2));
            exchange.payout_status = success ? 'success' : 'automated_payout_needs_marked';
            await coll.updateOne({_id: exchange._id}, {$set: exchange});
        }
        await delay(3000);
    }
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

watch();
