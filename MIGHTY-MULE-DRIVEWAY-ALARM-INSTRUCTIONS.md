# How to add MightyMule Wireless Driveway Alarm System - FM231

Using slightly modified version of the [MightMule-FM231.conf](https://github.com/merbanan/rtl_433/blob/master/conf/MightyMule-FM231.conf) you can add this driveway alarm as a device and have it show up as a motion sensor. For more info on the fm231 and rtl_433, [see here](https://github.com/merbanan/rtl_433/issues/1407).

Note one quirk is that this package was designed for 433 motion senors that constantly communicate and this one does not so eventually it wants to show that sensor has timed out (unresponsive status in homekit) if it hasn't triggered. You can however specify the timeout in homebridge conf so I set it to 7200 minutes so it doesn't use the 2 hour default. Even if sensor shows as "unresponsive" it will still trigger immediately when the driveway alarm transmits so it really does not matter if it shows unresponsive in homekit other than aesthetics.

### Add FM231 conf to rtl_433.conf
Put the below modified MightMule-FM231.conf into `rtl_433.conf` and make sure that file is placed in a location that rtl_433 looks on startup. ie I used `/usr/local/etc/rtl_433/rtl_433.conf`. This will cause rtl_433 to treat it like one of the supported devices and automatically look for its transmissions on startup.

#### /usr/local/etc/rtl_433/rtl_433.conf
```
# Decoder for the Mighty Mule FM231 Driveway alarm from GTO Inc
# FCC Test report, including RF waveforms is here:
#   https://fccid.io/I6HGTOFM231/Test-Report/Test-Report-1214140.pdf

# Use the Accurite and similar convention for reporting battery.
# The name is 'battery_ok' with values 1 (ok) and 0. (which are
# numerically reversed from what the FM231 reports)

# The DIP switches for setting a unique device ID are labeled 1-4
# from left to right, but appear in the # data stream in reverse
# order.

decoder {
    name=MightyMule-FM231,
    modulation=OOK_PWM,
    short=650,
    long=1200,
    sync=3800,
    reset=1100,
    rows=1,
    bits=9,
    get=@4:{1}:battery_ok:[0:1 1:0],
    get=@5:{4}:id,
    get=@0:{1}:motion:[0:true 1:true],
    unique
}
```

The modification I made to the original mule conf was just to add `get=@0:{1}:motion:[0:true 1:true]`, because that is what homebridge-rtl built in support for motion sensor device expects and it will return `motion: true` on any triggering which is what we want.

### Homebridge conf
Then in homebridge, once homebridge-rtl is installed, add the following platform to your homebridge config file. `id` is the ID that results from you dip switch settings on the driveway alarm. You can get this just by running `rtl_433` if you have already setup `rtl_433.conf` and trigger the alarm. You will see the ID listed.

Restart homebridge and now homekit should have a motion sensor that will trigger when a car is detected and automatically turn off after a few min.

#### homebridg conf
```
      {
            "platform": "rtl_433",
            "devices": [
                {
                    "id": "8",
                    "name": "Car Motion",
                    "type": "motion",
                    "timeout": 7200
                }
            ]
        }
```


