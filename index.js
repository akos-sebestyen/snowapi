var express = require('express');
var fs = require('fs');

var request = require('request');
var cheerio = require('cheerio');
var app = express();

app.get('/scrape/:mountain', function (req, res) {
    var mountain = req.params.mountain;

    url = `http://www.snow-forecast.com/resorts/${mountain}/6day/mid`;
    var weatherData = null;
    request(url, function (error, response, html) {
        console.log('requesting :' + url);
        if (error) {
            console.log("error making Reuest to :" + url);
        }

        var $ = cheerio.load(html);
        var createWeatherData = function (dayNodes, timeNodes, snowNodes, rainNodes, tempNodes) {
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

        var addTimedNodes = function (dataTable, resultObject, variableName) {
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
        var days, times, snow, rain, temp, freezeLevel;
        var json = {
            days: {
                name: '',
                times: {

                },
                snow: {

                },
                rain: {

                },
                temp: {

                },
                freezeLevel: {

                }
            }
        };
        $('.forecasts').filter(function () {
            var data = $(this);
            var test = data.children('.lar');
            var daysTable = test.first();
            var timesTable = daysTable.next();
            var snowtable = timesTable.nextUntil('.lar').next('.lar');
            var rainTable = snowtable.next();
            var tempTable = rainTable.next();

            days = daysTable.find('td');
            days.each(function (i, day) {
                console.log("node: " + i, $(day).text());
            });
            console.log('---------------------');
            times = timesTable.find('td');
            times.each(function (i, time) {
                // console.log("node: " + i, $(time).text());
            });
            console.log('---------------------');
            snows = snowtable.find('td');
            // console.log('typeof snows:', typeof (snowtable));
            // console.log('is snow filled?', !!snowtable);
            // console.log('snow length:', snowtable.length);
            snows.each(function (i, snow) {
                // console.log("node: " + i, $(snow).text());
            });
            console.log('---------------------');
            rains = rainTable.find('td');
            // console.log('typeof rains:', typeof (rainTable));
            // console.log('is rains filled?', !!rainTable);
            // console.log('rains length:', rainTable.length);
            rains.each(function (i, snow) {
                // console.log("node: " + i, $(snow).text());
            });
            console.log('---------------------');
            temps = tempTable.find('td');
            temps.each(function (i, snow) {
                // console.log("node: " + i, $(snow).text());
            });
            // console.log(JSON.stringify());
            weatherData = createWeatherData(days, times, snows, rains, temps);
            res.json(weatherData);
        });

        // testdata = $('forecasts').contents();
    });
    // res.json('broken');
    // res.send(testdata);
    // res.send('hi');
});

app.listen('8081', function () {
    console.log('server listening on :8081');
});

