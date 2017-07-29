const NodeCache = require('node-cache');
const myCache = new NodeCache({ stdTTL: 600, checkperiod: 620 });
const path = require('path');

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
const wwwRedirect = function (req, res, next) {
    if (req.headers.host.slice(0, 4) === 'www.') {
        var newHost = req.headers.host.slice(4);
        return res.redirect(301, req.protocol + '://' + newHost + req.originalUrl);
    }
    next();
};


const mountainList = [
    'whistler-blackcomb',
    'apex',
    'big-white',
    'cypress-mountain',
    'fernie',
    'kicking-horse',
    'manning-park-resort',
    'mount-washington',
    'silver-star',
    'sun-peaks',
    'revelstoke'
];

const performScrape = function (mountain) {
    return new Promise(function (resolve, reject) {
        const url = `http://www.snow-forecast.com/resorts/${mountain}/6day/mid`;
        request(url, function (error, response, html) {
            console.log('requesting :' + url);
            if (error) {
                console.log("error making Request to :" + url);
                reject(error);
            }

            var $ = cheerio.load(html);
            const createWeatherData = function (dayNodes, timeNodes, snowNodes, rainNodes, tempNodes) {
                var resultObject = { name: `${mountain}`, days: [] };
                dayNodes.each(function (i, day) {
                    resultObject.days.push({ name: $(day).text(), time: null, snow: null, rain: null, temp: null });
                });

                addTimedNodes(timeNodes, resultObject, 'time');
                addTimedNodes(snowNodes, resultObject, 'snow');
                addTimedNodes(rainNodes, resultObject, 'rain');
                addTimedNodes(tempNodes, resultObject, 'temp');
                return resultObject;
            }

            const addTimedNodes = function (dataTable, resultObject, variableName) {
                var tempObj = [];
                dataTable.each(function (j, item) {
                    var text = $(item).text();
                    tempObj.push(text);
                    // console.log(dataTable.length);
                    // console.log(j.length);
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
app.use(express.static(path.join(__dirname, 'client')));
app.set('trust proxy', true);
app.use(wwwRedirect);
app.get('/api/:mountain', function (req, res) {
    const mountain = req.params.mountain;
    if (mountainList.find(function (elem) { return elem == mountain.toLowerCase(); }) == undefined) {
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
var port = process.env.PORT || 8081;
app.listen(port, function () {
    console.log('server listening on :' + port);
});

