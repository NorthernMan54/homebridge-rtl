# homebridge-acurite-temperature

[![NPM Downloads](https://img.shields.io/npm/dm/homebridge-acurite-temperature.svg?style=flat)](https://npmjs.org/package/homebridge-acurite-temperature)

After dealing with issues with my refrigerator not maintaining temperature, I bought the [AcuRite Digital Wireless Fridge and Freezer Thermometer](https://www.amazon.ca/gp/product/B004QJVU78/ref=oh_aui_detailpage_o00_s00?ie=UTF8&psc=1) so I could track what was happening.  And my first thought after buying it was where was the integration into HomeBridge?  So I quickly cobbled this together using a RPI, [RTL_433](https://github.com/merbanan/rtl_433) and a [RTL SDR](https://www.amazon.ca/NooElec-NESDR-Mini-Compatible-ESD-Safe/dp/B00PAGS0HO/ref=sr_1_8?ie=UTF8&qid=1528028132&sr=8-8&keywords=rtl+sdr+nooelec)


* Display of temperature and low battery
* Also shows "not responding" if the sensor stops sending data
* Archives results every hour to a google spreadsheet
* Support the graphing feature of the Eve app for trends

I have tested this on both a Mac and a RPI3

## Installation
1.	Install Homebridge using
`sudo npm install -g homebridge`
2.	Install this plugin
`sudo npm install -g homebridge-acurite-temperature`
3.	Install [RTL_433](https://github.com/merbanan/rtl_433) following the instructions [here](https://github.com/merbanan/rtl_433#installation-instructions)
4. Configure homebridge

## Configuration
* `platform`: "Acurite"
* `name`: "Acurite"
* `devices - 1F`: Name for fridge sensor
* `devices - 2R`: Name for freezer sensor
* `storage`: ( optional ) storage of chart graphing data for history graphing, either fs or googleDrive, defaults to fs
* `spreadsheetId` ( optional ) Log data to a google sheet, this is part of the URL of your spreadsheet.  ie the spreadsheet ID in the URL https://docs.google.com/spreadsheets/d/abc1234567/edit#gid=0 is "abc1234567".

Example configuration:

```json
"platforms": [{
  "platform": "Acurite",
  "name": "Acurite",
  "devices": {
    "1R": "Fridge",
    "2F": "Freezer"
  }
}],
```


## Optional - Enable access to Google Sheets to log data

This presumes you already have a google account, and have access to google drive/sheets already

Step 1: Turn on the Drive API
a. Use this wizard ( https://console.developers.google.com/start/api?id=sheets.googleapis.com )
to create or select a project in the Google Developers Console and automatically turn on the API. Click Continue, then Go to credentials.

b. On the Add credentials to your project page, click the Cancel button.

c. At the top of the page, select the OAuth consent screen tab. Select an Email address, enter a Product name if not already set, and click the Save button.  I used 'Sheets Data Logger'

d. Select the Credentials tab, click the Create credentials button and select OAuth client ID.

e. Select the application type Other, enter the name "Drive API Quickstart", and click the Create button.

f. Click OK to dismiss the resulting dialog.

g. Click the file_download (Download JSON) button to the right of the client ID.

h. Move this file to your .homebridge and rename it logger_client_secret.json.

Step 2: Authorize your computer to access your Drive Account

a. Change to the directory where the plugin is installed i.e.

cd /usr/lib/node_modules/homebridge-mcuiot/node_modules/mcuiot-logger

b. Run the authorization module

node quickstart.js

c. Browse to the provided URL in your web browser.

If you are not already logged into your Google account, you will be prompted to log in. If you are logged into multiple Google accounts, you will be asked to select one account to use for the authorization.

d. Click the Accept button.

e. Copy the code you're given, paste it into the command-line prompt, and press Enter.


## Credits
* merbanan - RTL_433 Sensor decoder
* simont77 - History Service
