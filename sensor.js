'use strict';

var debug = require('debug')('homebridge-rtl_433');
var Logger = require("mcuiot-logger").logger;
const moment = require('moment');
var os = require("os");
var _ = require('lodash');
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

  homebridge.registerPlatform('homebridge-rtl', 'rtl_433', rtl433Plugin);
};

function rtl433Plugin(log, config, api) {
  this.log = log;
  this.refresh = config['refresh'] || 60; // Update every minute
  this.options = config.options || {};
  this.storage = config['storage'] || "fs";

  this.spreadsheetId = config['spreadsheetId'];
  this.devices = config['devices'];

  if (this.spreadsheetId) {
    this.log_event_counter = 59;
    this.logger = new Logger(this.spreadsheetId);
  }
}

rtl433Plugin.prototype = {
  accessories: function(callback) {
    for (var i in this.devices) {
      this.log("Adding device", i, this.devices[i].name);
      myAccessories.push(new Rtl433Accessory(this.devices[i], this.log, i));
    }
    callback(myAccessories);
    // console.log("Pre-This", this);
    rtl433Server.call(this);
  }
};

function rtl433Server() {
  // console.log("This", this);
  console.log("This", this);
  var childProcess = require('child_process');
  var readline = require('readline');
  var previousMessage;
  this.log("Spawning rtl_433");
//  var proc = childProcess.spawn('pkill rtl_433;/usr/local/bin/rtl_433', ['-q', '-F', 'json', '-C', 'si'], {
  // DO NOT RUN homebridge AS ROOT
  // start outside homebride (as root) the cmd: rtl_433 -v -F json -C si -M protocol > /tmp/rtl433.json
  var proc = childProcess.spawn('/usr/bin/truncate -s 0 /tmp/rtl433.json;/usr/bin/tail', ['-F','/tmp/rtl433.json'], {
    shell: true
  });
  readline.createInterface({
    input: proc.stdout,
    terminal: false
  }).on('line', function(message) {
    debug("Message", message.toString());

    if (message.toString().startsWith('{')) {
      try {
        var data = JSON.parse(message.toString());
        var devices = [];
        this.message = message;
        if (data.id) {
          devices = getDevices.call(this, data.id);
        } else if (data.channel) {
          devices = getDevices.call(this, data.channel);
        } else {
          this.log.error("FYI: RTL Message missing device or channel identifier.");
          this.log("Message", this.message.toString());
        }

        if (!duplicateMessage(previousMessage, data)) {
          if (devices.length > 0) {
            previousMessage = Object.assign({}, data);
            for (var i in devices) {
              var device = devices[i]
              device.updateStatus(data);
            }
          }
        }
        // {"time" : "2020-03-14 11:34:22", "model" : "Philips outdoor temperature sensor", "channel" : 1, "temperature_C" : 1.500, "battery" : "LOW"}
        // {"time" : "2018-06-02 08:27:20", "model" : "Acurite 986 Sensor", "id" : 3929, "channel" : "2F", "temperature_F" : -11, "temperature_C" : -23.889, "battery" : "OK", "status" : 0}
      } catch (err) {
        this.log.error("JSON Parse Error", message.toString(), err);
      }
    }
  }.bind(this));
  proc.on('close', function(code) {
    this.log.error('child close code (spawn)', code);
    setTimeout(rtl433Server.bind(this), 10 * 1000);
  }.bind(this));
  proc.on('disconnect', function(code) {
    this.log.error('child disconnect code (spawn)', code);
  }.bind(this));
  proc.on('error', function(code) {
    this.log.error('child error code (spawn)', code);
  }.bind(this));
  proc.on('exit', function(code) {
    this.log.error('child exit code (spawn)', code);
  }.bind(this));
}

function Rtl433Accessory(device, log, unit) {
  this.id = device.id;
  this.type = device.type;
  this.log = log;
  this.name = device.name;
  this.alarm = device['alarm']
  this.deviceTimeout = device['timeout'] || 120; // Mark as unavailable after 2 hours
  this.humidity = device['humidity'] || false; // Add humidity data to temerature sensor
}

Rtl433Accessory.prototype = {
  updateStatus: function(data) {
    try {
      this.log("Updating", this.name);
      this.lastUpdated = Date.now();
      clearTimeout(this.timeout);
      this.timeout = setTimeout(deviceTimeout.bind(this), this.deviceTimeout * 60 * 1000);
      switch (this.type) {
        case "temperature":
          var humidity;
          var entry = {
            time: moment().unix(),
            temp: roundInt(data.temperature_C)
          }
          if (this.humidity && data.humidity) {
            humidity = roundInt(data.humidity)
            entry.humidity = humidity
          }
          this.loggingService.addEntry(entry);

          if (this.spreadsheetId) {
            this.log_event_counter = this.log_event_counter + 1;
            if (this.log_event_counter > 59) {
              this.logger.storeBME(this.name, 0, roundInt(data.temperature_C), humidity);
              this.log_event_counter = 0;
            }
          }
          this.sensorService
            .setCharacteristic(Characteristic.CurrentTemperature, roundInt(data.temperature_C));
          if (humidity !== undefined) {
            this.sensorService
              .setCharacteristic(Characteristic.CurrentRelativeHumidity, humidity)
          }

          if (data.battery !== undefined || data.battery_ok != undefined) {
            var batteryOk = data.battery === "OK" || data.battery_ok === 1
            this.sensorService
              .setCharacteristic(Characteristic.StatusLowBattery, batteryOk ? Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL : Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
          }
          if (this.alarm !== undefined) {
            if (roundInt(data.temperature_C) > this.alarm) {
              this.alarmService
                .setCharacteristic(Characteristic.ContactSensorState, Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
              debug(this.name + " Temperature Alarm" + roundInt(data.temperature_C) + " > " + this.alarm);
            } else {
              this.alarmService
                .setCharacteristic(Characteristic.ContactSensorState, Characteristic.ContactSensorState.CONTACT_DETECTED);
            }
          }
          break;
        case "humidity":
          var entry = {
            time: moment().unix(),
            humidity: roundInt(data.humidity)
          }
          this.loggingService.addEntry(entry);

          if (this.spreadsheetId) {
            this.log_event_counter = this.log_event_counter + 1;
            if (this.log_event_counter > 59) {
              this.logger.storeBME(this.name, 0, (undefined), roundInt(data.humidity));
              this.log_event_counter = 0;
            }
          }

          this.sensorService
            .setCharacteristic(Characteristic.CurrentRelativeHumidity, roundInt(data.humidity))

          if (data.battery !== undefined || data.battery_ok != undefined) {
            var batteryOk = data.battery === "OK" || data.battery_ok === 1
            this.sensorService
              .setCharacteristic(Characteristic.StatusLowBattery, batteryOk ? Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL : Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
          }
          if (this.alarm !== undefined) {
            if (roundInt(data.humidity) > this.alarm) {
              this.alarmService
                .setCharacteristic(Characteristic.ContactSensorState, Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
              debug(this.name + " Humidity Alarm" + roundInt(data.humidity) + " > " + this.alarm);
            } else {
              this.alarmService
                .setCharacteristic(Characteristic.ContactSensorState, Characteristic.ContactSensorState.CONTACT_DETECTED);
            }
          }
          break;
        case "motion":
          // {"time" : "2018-09-30 19:20:26", "model" : "Skylink HA-434TL motion sensor", "motion" : "true", "id" : "1e3e8", "raw" : "be3e8"}
	  // {"time" : "2022-03-17 21:58:46.319049", "protocol" : 68, "model" : "Kerui-Security", "id" : 840811, "cmd" : 10, "motion" : 1, "state" : "motion" }
          // debug("update motion this--->",this);

          var value = (data.motion === "true") || (data.motion === 1) ;
          if (this.sensorService.getCharacteristic(Characteristic.MotionDetected).value !== value) {
            this.sensorService.getCharacteristic(CustomCharacteristic.LastActivation)
              .updateValue(moment().unix() - this.loggingService.getInitialTime());
          }
          this.sensorService.getCharacteristic(Characteristic.MotionDetected)
            .updateValue(value);
          this.loggingService.addEntry({
            time: moment().unix(),
            status: value
          });

          if (value) {
            clearTimeout(this.motionTimeout);
            this.motionTimeout = setTimeout(function() {
              var value = false;
              if (this.sensorService.getCharacteristic(Characteristic.MotionDetected).value !== value) {
                this.sensorService.getCharacteristic(CustomCharacteristic.LastActivation)
                  .updateValue(moment().unix() - this.loggingService.getInitialTime());
              }
              this.sensorService.getCharacteristic(Characteristic.MotionDetected)
                .updateValue(value);
              this.loggingService.addEntry({
                time: moment().unix(),
                status: value
              });
            }.bind(this), 2 * 60 * 1000);
          }

          break;
        case "contact":
	  // {"time" : "2022-03-17 23:04:08.430623", "protocol" : 68, "model" : "Kerui-Security", "id" : 297536, "cmd" : 14, "opened" : 1, "state" : "open" }
	  // {"time" : "2022-03-17 23:04:19.447761", "protocol" : 68, "model" : "Kerui-Security", "id" : 297536, "cmd" : 7, "opened" : 0, "state" : "close" }
          // debug("update door this--->",this);
          // console.log("update door this--->",this);

          this.sensorService
              .setCharacteristic(Characteristic.ContactSensorState, data.opened );

          if (data.battery !== undefined || data.battery_ok != undefined) {
            var batteryOk = data.battery === "OK" || data.battery_ok === 1
            this.sensorService
              .setCharacteristic(Characteristic.StatusLowBattery, batteryOk ? Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL : Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
          }
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

        this.timeoutCharacteristic = Characteristic.CurrentTemperature;
        this.timeout = setTimeout(deviceTimeout.bind(this), this.deviceTimeout * 60 * 1000); // 5 minutes

        this.sensorService.log = this.log;
        this.loggingService = new FakeGatoHistoryService("weather", this.sensorService, {
          storage: this.storage,
          minutes: this.refresh * 10 / 60
        });
        if (this.alarm !== undefined) {
          this.alarmService = new Service.ContactSensor(this.name + " Alarm");
          informationService
            .setCharacteristic(Characteristic.Model, "Temperature Sensor with Alarm @ " + this.alarm);
        } else {
          informationService
            .setCharacteristic(Characteristic.Model, "Temperature Sensor");
        }
        break;
      case "humidity":
        this.sensorService = new Service.HumiditySensor(this.name);

        this.sensorService
          .getCharacteristic(Characteristic.CurrentRelativeHumidity)
          .setProps({
            minValue: 0,
            maxValue: 100
          });

        this.timeoutCharacteristic = Characteristic.CurrentRelativeHumidity;
        this.timeout = setTimeout(deviceTimeout.bind(this), this.deviceTimeout * 60 * 1000); // 5 minutes

        this.sensorService.log = this.log;
        this.loggingService = new FakeGatoHistoryService("weather", this.sensorService, {
          storage: this.storage,
          minutes: this.refresh * 10 / 60
        });
        if (this.alarm !== undefined) {
          this.alarmService = new Service.ContactSensor(this.name + " Alarm");
          informationService
            .setCharacteristic(Characteristic.Model, "Humidity Sensor with Alarm @ " + this.alarm);
        } else {
          informationService
            .setCharacteristic(Characteristic.Model, "Humidity Sensor");
        }
        break;
      case "motion":
        this.sensorService = new Service.MotionSensor(this.name);

        this.sensorService.addCharacteristic(CustomCharacteristic.LastActivation);

        this.timeoutCharacteristic = Characteristic.MotionDetected;
        this.timeout = setTimeout(deviceTimeout.bind(this), this.deviceTimeout * 60 * 1000); // 5 minutes

        this.sensorService.log = this.log;
        this.loggingService = new FakeGatoHistoryService("motion", this.sensorService, {
          storage: this.storage,
          minutes: this.refresh * 10 / 60
        });
        informationService
          .setCharacteristic(Characteristic.Model, "Motion Sensor");
        break;
      case "contact":
       // debug("get door this--->",this);
       // console.log("get door this--->",this);

       this.sensorService = new Service.ContactSensor(this.name);
       this.sensorService.addCharacteristic(CustomCharacteristic.LastActivation);

       this.sensorService.log = this.log;
       informationService
          .setCharacteristic(Characteristic.Model, "Contact Sensor");
        break;

      default:
        this.log.error("No events defined for sensor type %s", this.type);
    }

    if (this.alarm !== undefined) {
      return [informationService, this.sensorService, this.alarmService, this.loggingService];
    } else {
      return [informationService, this.sensorService, this.loggingService];
    }
  }
};

function deviceTimeout() {
  this.log("Timeout", this.name);
  this.sensorService
    .getCharacteristic(this.timeoutCharacteristic).updateValue(new Error("No response"));
}

function roundInt(string) {
  return Math.round(parseFloat(string) * 10) / 10;
}

function getDevices(unit) {
  var devices = [];
  for (var i in myAccessories) {
    // == is correct test, Acurite uses a numeric value
    if (myAccessories[i].id == unit) {
      devices.push(myAccessories[i]);
    }
  }
  if (devices.length === 0) {
    this.log.error("FYI: Message from unknown device ID", unit);
    this.log("Message", this.message.toString());
  }
  return devices;
}

function seconds(dateTime) {
  // "2018-10-01 20:52:33"
  var hms = dateTime.split(" ");
  // debug("TIME", hms[1]);
  var tt = hms[1].split(":");
  var sec = tt[0] * 3600 + tt[1] * 60 + tt[2] * 1;
  return (sec);
}

function duplicateMessage(last, current) {
  if (last) {
    // debug("Last %s, Current %s", JSON.stringify(last), JSON.stringify(current));
    if ((seconds(current.time) - seconds(last.time)) < 2) {
      var tCurrent = Object.assign({}, current);
      var tLast = Object.assign({}, last);
      delete tCurrent.time;
      delete tLast.time;
      // debug("LAST %s, CURRENT %s, isEqual %s", JSON.stringify(tLast), JSON.stringify(tCurrent),_.isEqual(tLast, tCurrent));
      if (_.isEqual(tLast, tCurrent)) {
        return true;
      }
    }
  }
  return false;
}
