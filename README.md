# homebridge-rtl

[![NPM Downloads](https://img.shields.io/npm/dm/homebridge-rtl.svg?style=flat)](https://npmjs.org/package/homebridge-rtl)

Homebridge plugin to display information from 433 Mhz sensors, like the `Skylink HA-434TL motion sensor` or the `AcuRite Digital Wireless Fridge and Freezer Thermometer` temperature sensor.  This plugin uses the [RTL_433](https://github.com/merbanan/rtl_433) package to listen to the sensor in-conjunction with a sdr device to receive the signals from the sensor.  In my setup I use this [RTL_SDR](https://www.amazon.ca/gp/product/B00PAGS0HO/ref=ppx_yo_dt_b_asin_title_o07_s00?ie=UTF8&psc=1) to receive the radio signal from the sensor.

## Supported Sensors
For sensors, I'm using these

* [Fridge Temperature](https://www.amazon.ca/gp/product/B004QJVU78/ref=ppx_yo_dt_b_asin_title_o01_s00?ie=UTF8&psc=1)
* [Motion](https://www.amazon.ca/gp/product/B003CWGDTK/ref=ppx_yo_dt_b_asin_title_o05_s00?ie=UTF8&psc=1)

Contributor added sensors:
* [Mighty Mule Driveway alarm](https://www.amazon.com/Mighty-Mule-Wireless-Driveway-FM231/dp/B003765W0W) see [instructions here](MIGHTY-MULE-DRIVEWAY-ALARM-INSTRUCTIONS.md)

## Features
* Supported sensors include Motion, Temperature and Humidity
* Also shows "not responding" if the sensor stops sending data
* For temperature and humidity sensors, has ability to create alarms if the current value exceeds a alarm value

I have tested this on both a Mac and a RPI3

## Installation
1.	Install Homebridge using
`sudo npm install -g homebridge`
2.	Install this plugin
`sudo npm install -g homebridge-rtl`
3.	Install [RTL_433](https://github.com/merbanan/rtl_433) following the instructions [here](https://github.com/merbanan/rtl_433#installation-instructions)
4. Configure homebridge

## Configuration
* `platform`: "rtl_433"
* `name`: "Front Porch" - Name of device for display in the Home App
* `id`: id number of device - To find the ID of your device, run homebridge in DEBUG mode, and it will log the message received from all rtl_433 devices.  See below for examples
* `type`: Type of sensor device.  Supported sensors are `motion`, `temperature`, `humidity`
* `alarm`: Optional, Create a fake contact sensor called name + Alarm.  Value is temperature in Celsius that if exceeded will trigger contact sensor.
* `humidity`: Optional, For devices of type `temperature` that emits also humidity set to `true` and humidity will shows in HomeKit/Eve app in the sensor.

Example configuration:

```
"platforms": [{
    "platform": "rtl_433",
    "devices": [
      {
      "id": "1e3e8",
      "name": "Front Porch",
      "type": "motion"
      }]
  }]
```

## Sample log file entries from homebridge in DEBUG mode to determine sensor ID

* To start homebridge in DEBUG mode please use this command

`DEBUG=* homebridge`

* Motion sensor log entries

```
Wed, 03 Apr 2019 13:43:05 GMT homebridge-rtl_433 Message {"time" : "2019-04-03 09:43:05", "model" : "Skylink HA-434TL motion sensor", "motion" : "false", "id" : "1e3e8", "raw" : "5e3e8"}

id is 1e3e8
```

* Temperature sensor log entries

```
Thu, 04 Apr 2019 01:07:48 GMT homebridge-rtl_433 Message {"time" : "2018-06-02 08:27:20", "model" : "Acurite 986 Sensor", "id" : 3929, "channel" : "2F", "temperature_F" : -11, "temperature_C" : -23.889, "battery" : "OK", "status" : 0}

id is 3929
```

If the device does not transmit an ID value, will default to channel

```
Thu, 04 Apr 2019 01:07:48 GMT homebridge-rtl_433{"time" : "2020-03-14 11:34:22", "model" : "Philips outdoor temperature sensor", "channel" : 1, "temperature_C" : 1.500, "battery" : "LOW"}

id is the channel 1
```

```
Sat, 14 Mar 2020 18:40:41 GMT homebridge-rtl_433 Message {"time" : "2020-03-14 14:40:41", "model" : "Acurite tower sensor", "id" : 15424, "sensor_id" : 15424, "channel" : "A", "temperature_C" : 3.600, "humidity" : 60, "battery_low" : 0}

id is 15424
```

## Credits
* merbanan - RTL_433 Sensor decoder
* simont77 - History Service
* matopeto - Humidity Sensor Support
