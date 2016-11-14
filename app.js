#!/usr/bin/env node

'use strict';


const Fs = require('fs');
const _ = require('lodash');
const Cheerio = require('cheerio');
const Async = require('async');
const Request = require('request-promise-native');
const CookieKit = require('tough-cookie-kit');
const Moment = require('moment');
const Bunyan = require('bunyan');
const Inquirer = require('inquirer');
const Chalk = require('chalk');


const Log = Bunyan.createLogger({
    name: 'kuaidaili-spider',
    src: true
});
// Log.trace, Log.debug, Log.info, Log.warn, Log.error, and Log.fatal


let gCookies = Request.jar(new CookieKit('cookies.json'));
const gRequest = Request.defaults({
    // 'proxy': 'http://8.8.8.8:8888',
    'gzip': true,
    'simple': false, // Get a rejection only if the request failed for technical reasons
    'resolveWithFullResponse': true, // Get the full response instead of just the body
    'followRedirect': false,
    'jar': gCookies
});

let gHeaders = {
    'Host': 'www.kuaidaili.com',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'Upgrade-Insecure-Requests': 1,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.87 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Referer': 'http://www.kuaidaili.com/free/outha/',
    'Accept-Encoding': 'gzip, deflate, sdch',
    'Accept-Language': 'zh-CN,zh;q=0.8'
};

let gLstIP = {};

main();

function main() {
    let startTime = new Date().getTime();
    return procMain(function(res) {
        let arrTask = []
        _.each(res, function(ip, index) {
            for(let i = 2; (i < 5) && (i < ip.count); i++) {
                arrTask.push({
                    'name': ip.name,
                    'page': i
                });
            }
        });
        return procTask(arrTask, 4, function(res) {
            return Fs.writeFileSync('ips.txt', JSON.stringify(gLstIP), 'utf8', function(err) {
                if (err) throw err;
                console.log(`耗时: ${new Date().getTime() - startTime} ms`);
            });
        });
    });
}

function procTask(arrTask, max, cb) {
    return Async.mapLimit(arrTask, max,
        function(task, done) {
            return getIPListHtml(task.name, task.page).then(function(res) {
                let arrIP = getIPListArray(res.body);
                gLstIP[task.name].list = _.concat(gLstIP[task.name].list, arrIP);
                return done(null, arrIP);
            });
        },
        function(err, res) {
            return err ? Log.error(err) : cb(res);
        }
    );
}

function procMain(cb) {
    return Async.map(['inha', 'intr', 'outha', 'outtr'],
        function(name, done) {
            return getIPListHtml(name, 1).then(function(res) {
                let count = getIPListMaxPage(res.body);
                let arrIP = getIPListArray(res.body);
                let objIP = {
                    'name': name,
                    'count': count,
                    'list': arrIP
                };
                gLstIP[name] = objIP;
                return done(null, objIP);
            });
        },
        function(err, res) {
            return err ? Log.error(err) : cb(res);
        }
    );
}

function getIPListMaxPage(html) {
    let $ = Cheerio.load(html);
    return $('#listnav a').last().text();
}

function getIPListArray(html) {
    let arrIP = [];
    let $ = Cheerio.load(html);
    $('tbody tr').each(function(i, elem) {
        let ip = {};
        $(elem).find('td').each(function(j, e) {
            ip[$(e).data('title')] = $(e).text();
        });
        return arrIP.push(ip);
    });
    return arrIP;
}

function getIPListHtml(name, page) {
    return getHtml(`http://www.kuaidaili.com/free/${name}/${page || 1}/`, gHeaders);
}

function getIP() {
    let headers = {
        'Host': 'ip.cn',
        'Connection': 'keep-alive',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': 1,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.87 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, sdch',
        'Accept-Language': 'zh-CN,zh;q=0.8'
    };

    return getHtml('http://ip.cn/', headers).then(function(res) {
        let $ = Cheerio.load(res.body);
        return $('code').each(function(i, elem) {
            return console.log($(elem).text());
        });
    });
}

function getHtml(url, headers, data) {
    let options = {
        'url': url,
        'headers': headers,
        'qs': data
    };
    return get(options);
}

function getJson(url, headers, data) {
    let options = {
        'url': url,
        'headers': headers,
        'qs': data,
        'json': true
    };
    return get(options);
}

function postJson(url, headers, json) {
    let options = {
        'url': url,
        'headers': headers,
        'form': json,
        'json': true
    };
    return post(options);
}

function postForm(url, headers, form) {
    let options = {
        'url': url,
        'headers': headers,
        'form': form
    };
    return post(options);
}

function get(options) {
    return reqHttp(_.assign({}, options, {
        'method': 'GET'
    }));
}

function post(options) {
    return reqHttp(_.assign({}, options, {
        'method': 'POST'
    }));
}

function reqHttp(options) {
    return gRequest(options)
        .then(procReqSucceeded)
        .catch(procReqFailed);
}

function procReqSucceeded(response) {
    return response;
}

function procReqFailed(error) {
    return Log.error(error);
}

