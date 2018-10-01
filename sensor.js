'use strict';

var debug = require('debug')('homebridge-rtl_433');
var logger = require("mcuiot-logger").logger;
const moment = require('moment');
var os = require("os");
var hostname = os.hostname();

let Service, Characteristic;
var CustomCharacteristic;
var FakeGatoHistoryService;

var myAccessories = [];

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  CustomCharacteristic = require('./lib/CustomCharacteristic.js')(homebridge);
  FakeGatoHistoryService = require('fakegato-history')(homebridge);

  homebridge.registerPlatform('homebridge-rtl_433', 'rtl_433', rtl_433Plugin);
};

function rtl_433Plugin(log, config, api) {

  this.log = log;
  this.refresh = config['refresh'] || 60; // Update every minute
  this.options = config.options || {};
  this.storage = config['storage'] || "fs";
  this.spreadsheetId = config['spreadsheetId'];
  this.devices = config['devices'];
  if (this.spreadsheetId) {
    this.log_event_counter = 59;
    this.logger = new logger(this.spreadsheetId);
  }
  this.lastUpdated = Date.now();

}

rtl_433Plugin.prototype = {
  accessories: function(callback) {
    for (var i in this.devices) {
      this.log("Adding device", i, this.devices[i].name);
      myAccessories.push(new rtl_433Accessory(this.devices[i], this.log, i));
    }
    callback(myAccessories);

    var child_process = require('child_process');
    var readline = require('readline');
    var proc = child_process.spawn('/usr/local/bin/rtl_433', ['-q', '-F', 'json', '-C', 'si']);
    readline.createInterface({
      input: proc.stdout,
      terminal: false
    }).on('line', function(message) {
      debug("Message", message.toString());
      if (message.toString().startsWith('{')) {
        try {
          var data = JSON.parse(message.toString());
          var device = getDevice(data.id);

          if (device != undefined)
            device.updateStatus(data);
          // {"time" : "2018-06-02 08:27:20", "model" : "Acurite 986 Sensor", "id" : 3929, "channel" : "2F", "temperature_F" : -11, "temperature_C" : -23.889, "battery" : "OK", "status" : 0}
        } catch (err) {
          this.log.error("JSON Parse Error", message.toString(), err);
        }
      }
    }.bind(this));
  }
}

function rtl_433Accessory(device, log, unit) {
  this.id = device.id;
  this.type = device.type;
  this.log = log;
  this.name = device.name;
}

rtl_433Accessory.prototype = {
  updateStatus: function(data) {
    try {
      this.log("Updating", this.name);
      this.lastUpdated = Date.now();
      clearTimeout(this.timeout);
      this.timeout = setTimeout(deviceTimeout.bind(this), this.deviceTimeout * 60 * 1000);
      switch (this.type) {
        case "temperature":
          this.loggingService.addEntry({
            time: moment().unix(),
            temp: roundInt(data.temperature_C)
          });

          if (this.spreadsheetId) {
            this.log_event_counter = this.log_event_counter + 1;
            if (this.log_event_counter > 59) {
              this.logger.storeBME(this.name, 0, roundInt(data.temperature_C));
              this.log_event_counter = 0;
            }
          }
          this.sensorService
            .setCharacteristic(Characteristic.CurrentTemperature, roundInt(data.temperature_C));
          if (data.battery == "OK") {
            this.sensorService
              .setCharacteristic(Characteristic.StatusLowBattery, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
          } else {
            this.sensorService
              .setCharacteristic(Characteristic.StatusLowBattery, Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
          }
          break;
        case "motion":
          // {"time" : "2018-09-30 19:20:26", "model" : "Skylink HA-434TL motion sensor", "motion" : "true", "id" : "1e3e8", "raw" : "be3e8"}
          var value = data.motion;
          if (this.sensorService.getService(Service.MotionSensor).getCharacteristic(Characteristic.MotionDetected).value != value) {
            this.sensorService.getService(Service.MotionSensor).getCharacteristic(CustomCharacteristic.LastActivation)
              .updateValue(moment().unix() - this.sensorService.mLoggingService.getInitialTime());
          }
          this.sensorService.getService(Service.MotionSensor).getCharacteristic(Characteristic.MotionDetected)
            .updateValue(value);
          this.sensorService.mLoggingService.addEntry({
            time: moment().unix(),
            status: value
          });

          break;
        default:
          this.log.error("No events defined for sensor type %s", this.type);
      }


    } catch (err) {
      this.log.error("Error", err);
    }
  },

  getServices: function() {
    this.log("getServices", this.name);
    // Information Service
    var informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, "homebridge-rtl_433")
      .setCharacteristic(Characteristic.SerialNumber, hostname + "-" + this.name)
      .setCharacteristic(Characteristic.FirmwareRevision, require('./package.json').version);
    // Thermostat Service

    switch (this.type) {
      case "temperature":
        this.sensorService = new Service.TemperatureSensor(this.name);

        this.sensorService
          .getCharacteristic(Characteristic.CurrentTemperature)
          .setProps({
            minValue: -100,
            maxValue: 100
          });

        this.deviceTimeout = 5;
        this.timeout = setTimeout(deviceTimeout.bind(this), this.deviceTimeout * 60 * 1000); // 5 minutes

        this.sensorService.log = this.log;
        this.loggingService = new FakeGatoHistoryService("weather", this.sensorService, {
          storage: this.storage,
          minutes: this.refresh * 10 / 60
        });
        break;
      case "motion":
        this.sensorService = new Service.MotionSensor(this.name);

        this.deviceTimeout = 120;
        this.timeout = setTimeout(deviceTimeout.bind(this), this.deviceTimeout * 60 * 1000); // 5 minutes

        this.sensorService.log = this.log;
        this.loggingService = new FakeGatoHistoryService("motion", this.sensorService, {
          storage: this.storage,
          minutes: this.refresh * 10 / 60
        });
        break;
      default:
        this.log.error("No events defined for sensor type %s", this.type);
    }

    return [informationService, this.sensorService, this.loggingService];
  }
}

function deviceTimeout() {
  this.log("Timeout", this.name);
  this.sensorService
    .getCharacteristic(Characteristic.StatusLowBattery).updateValue(new Error("No response"));
}

function roundInt(string) {
  return Math.round(parseFloat(string) * 10) / 10;
}

function getDevice(unit) {
  for (var i in myAccessories) {
    if (myAccessories[i].unit == unit)
      return myAccessories[i];
  }
  console.log("ERROR: unknown unit -", unit);
  return (undefined);
}
