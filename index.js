const NodeCache = require('node-cache');
const myCache = new NodeCache({ stdTTL: 600, checkperiod: 620 });

const express = require('express');
const Promise = require('bluebird');

const request = require('request');
const cheerio = require('cheerio');
const app = express();

myCache.on('set', function (key, value) {
    console.log("Cache-Add: " + key + ": " + value);
});
myCache.on('del', function (key, value) {
    console.log("Cache-Del: " + key + ": " + value);
});
myCache.on('expired', function (key, value) {
    console.log("Cache-Expired: " + key + ": " + value);
});

const mountainList = [
    'Cypress-Mountain',
    'Whistler-Blackcomb'
];

const performScrape = function (mountain) {
    return new Promise(function (resolve, reject) {
        const url = `http://www.snow-forecast.com/resorts/${mountain}/6day/mid`;;
        request(url, function (error, response, html) {
            console.log('requesting :' + url);
            if (error) {
                console.log("error making Reuest to :" + url);
                reject(error);
            }

            var $ = cheerio.load(html);
            const createWeatherData = function (dayNodes, timeNodes, snowNodes, rainNodes, tempNodes) {
                var resultObject = { name: `${mountain}`, days: [] };
                dayNodes.each(function (i, day) {
                    resultObject.days.push({ name: $(day).text(), times: null, snows: null, rains: null, maxTemps: null });
                });

                addTimedNodes(timeNodes, resultObject, 'times');
                addTimedNodes(snowNodes, resultObject, 'snows');
                addTimedNodes(rainNodes, resultObject, 'rains');
                addTimedNodes(tempNodes, resultObject, 'maxTemps');
                return resultObject;
            }

            const addTimedNodes = function (dataTable, resultObject, variableName) {
                var tempObj = [];
                dataTable.each(function (j, item) {
                    var text = $(item).text();
                    tempObj.push(text);
                    if (dataTable.length % 3 == 0 && (j + 1) % 3 == 0) {
                        // normal flow...
                        (resultObject.days[((j + 1) / 3) - 1])[variableName] = tempObj;
                        tempObj = [];
                    }
                    else if (dataTable.length + 1 % 3 == 0 && (j + 2) % 3 == 0) {
                        // missing AM
                        (resultObject.days[((j + 2) / 3) - 1])[variableName] = tempObj;
                        tempObj = [];
                    }
                    else if (dataTable.length + 2 % 3 == 0 && (j + 3) % 3 == 0) {
                        // missing AM+PM
                        (resultObject.days[((j + 3) / 3) - 1])[variableName] = tempObj;
                        tempObj = [];
                    }
                });
            };
            $('.forecasts').filter(function () {
                const data = $(this);
                const test = data.children('.lar');
                const daysTable = test.first();
                const timesTable = daysTable.next();
                const snowtable = timesTable.nextUntil('.lar').next('.lar');
                const rainTable = snowtable.next();
                const tempTable = rainTable.next();

                const days = daysTable.find('td');
                const times = timesTable.find('td');
                const snows = snowtable.find('td');
                const rains = rainTable.find('td');
                const temps = tempTable.find('td');

                resolve(createWeatherData(days, times, snows, rains, temps));
            });

        });
    });
};

app.get('/api/:mountain', function (req, res) {
    const mountain = req.params.mountain;
    if (mountainList.find(function (elem) { return elem == mountain; }) == undefined) {
        res.status(500).send('Invalid Mountain');
        return;
    }
    const result = myCache.get(mountain);
    if (result != undefined) {
        console.log('-------------------CACHED----------------------');
        res.json(result);
    } else {
        performScrape(mountain).then(function (data) {
            console.log('-------------------FRESH----------------------');
            myCache.set(mountain, data);
            res.json(data);
        });
    }
});

app.listen('8081', function () {
    console.log('server listening on :8081');
});

