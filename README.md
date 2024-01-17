# homebridge-ruuvitag

With this [Homebridge](https://github.com/nfarina/homebridge) plugin you can use [RuuviTags](https://tag.ruuvi.com/) with [Apple HomeKit](https://www.apple.com/ios/home/).

## Updates
- 5.0.0: Added ruuvitag version 5 support
- 2.3.0: Updated ruuvitag support
- 1.8.0: Fixed flooding issue and added `frequency` (update frequency) parameter
- 1.7.0: Added support for latest Node.js versions!
- 1.5.0: [Humidity triggers!](https://github.com/pakastin/homebridge-ruuvitag/releases/tag/v1.5.0)
- 1.4.0: [Disable temp/humidity](https://github.com/pakastin/homebridge-ruuvitag/releases/tag/v1.4.0)
- 1.3.1: [Enhanced movement formula](https://github.com/pakastin/homebridge-ruuvitag/releases/tag/v1.3.1)
- 1.3.0: [Motion triggers!](https://github.com/pakastin/homebridge-ruuvitag/releases/tag/v1.3.0)
- 1.2.0: [You can now set up heat and cold triggers](https://github.com/pakastin/homebridge-ruuvitag/releases/tag/v1.2.0)
- 1.1.0: [Show battery level + low battery warning](https://github.com/pakastin/homebridge-ruuvitag/releases/tag/v1.1.0)

## Installation
First, install [Node.js](https://nodejs.org/) [Avahi](https://www.avahi.org/) (Homebridge needs this), [Homebridge](https://github.com/nfarina/homebridge) and this plugin:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - &&\
sudo apt-get install -y nodejs
sudo apt-get install libavahi-compat-libdnssd-dev
sudo npm i -g homebridge
sudo npm i -g homebridge-ruuvitag
```

## Find out Ruuvitag ID's
You can find out Ruuvitag ID's by installing and running [`ruuvitag-debug`](https://github.com/pakastin/ruuvitag-debug):
```bash
npx ruuvitag-debug
```

## Config

Create a [`~/.homebridge/config.json`](https://github.com/nfarina/homebridge/blob/master/config-sample.json) file
(change ID's and add/remove tags as necessary):

```json
{
  "bridge": {
    "name": "Ruuvi",
    "username": "CC:22:3D:E3:CE:30",
    "port": 51826,
    "pin": "031-45-154"
  },

  "description": "RuuviTag bridge",

  "accessories": [
    {
      "accessory": "Ruuvitag",
      "name": "Ruuvi 1",
      "id": "ca67bf52ca12"
    },
    {
      "accessory": "Ruuvitag",
      "name": "Ruuvi 2",
      "id": "fa81b4c6a891"
    },
    {
      "accessory": "Ruuvitag",
      "name": "Ruuvi 3",
      "id": "ac67df12bb34"
    }
  ]
}
```

### Socket option

You can listen to RuuviTag update events emitted from a [socket server](https://github.com/klaalo/ifData/tree/master/tagSocket) instead of using Bluetooth. This is signalled by adding a configuration parameter for the accessory.

```json
"socket": "http://raspberrypi.local:8787"
```

## Run

Now you can run Homebridge:
```bash
homebridge
```

## Start on startup

Install pm2:
```bash
npm -g i pm2
```

Start with pm2 and save as daemon:
```
pm2 start homebridge
pm2 save
pm2 startup
```
## Supported features
- temperature
- humidity
- battery level
- battery level alert
- heat alert
- cold alert
- high humidity alert
- low humidity alert
- motion alert
