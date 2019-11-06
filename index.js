const ruuvi = require('@pakastin/node-ruuvitag');
const debug = require('debug')('homebridge-ruuvitag');
const pngjs = require('pngjs');

let hap;
let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;
let StreamController;

const waitingTags = {};
const waitingHistoryTags = {};
const tags = {};

const tagHistory = {};

ruuvi.on('found', tag => {
  tags[tag.id] = tag;
  waitingTags[tag.id] && waitingTags[tag.id](tag);
  waitingHistoryTags[tag.id] && waitingHistoryTags[tag.id](tag);
  delete waitingTags[tag.id];
  delete waitingHistoryTags[tag.id];
  debug('found', tag.id);
});

module.exports = (homebridge) => {
  hap = homebridge.hap;
  PlatformAccessory = homebridge.platformAccessory;
  Accessory = homebridge.hap.Accessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  StreamController = hap.StreamController;

  homebridge.registerPlatform('homebridge-ruuvitag', 'Ruuvitag-history', RuuvitagPlatform, true);
  homebridge.registerAccessory('homebridge-ruuvitag', 'Ruuvitag', Ruuvitag, true);
};

class RuuvitagPlatform {
  constructor (log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;

    api.on('didFinishLaunching', () => this.didFinishLaunching());
  }

  configureAccessory () {}

  didFinishLaunching () {
    const { log, config, api } = this;
    const accessories = [];

    if (!config) {
      return;
    }

    const interfaceName = config.interfaceName || '';

    config.cameras && config.cameras.forEach(cameraConfig => {
      const { name, id } = cameraConfig;

      if (!name || !id) {
        log('Missing parameters');
        return;
      }
      const uuid = UUIDGen.generate(name);
      const accessory = new PlatformAccessory(name, uuid, Accessory.Categories.CAMERA);
      this.cameraSource = new History(hap, config, log, interfaceName);
      accessory.configureCameraSource(this.cameraSource);
      accessories.push(accessory);

      const listenTo = (tag) => {
        if (!tagHistory[tag.id]) {
          tagHistory[tag.id] = [];
          tag.on('updated', (data) => {
            tagHistory[tag.id].push(data);
          });
        }

        tag.on('updated', (data) => {
          this.update(tagHistory[tag.id]);
        });
      };

      const tag = tags[this.id];

      if (tag) {
        listenTo(tag);
      } else {
        waitingTags[this.id] = (tag) => {
          listenTo(tag);
        };
      }
    });

    api.publishCameraAccessories('Ruuvitag-history', accessories);
  }

  update (history) {
    this.cameraSource.update(history);
  }
}

class Ruuvitag {
  constructor (log, config) {
    this.log = log;
    this.name = config.name;
    this.id = config.id;
    this.config = config;
    this.services = [];

    if (!config.disableTemp) {
      this.tempService = new Service.TemperatureSensor(this.name);
      this.tempService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({ minValue: -200, maxValue: 200, minStep: 0.01 });
      this.services.push(this.tempService);
    }
    if (!config.disableHumidity) {
      this.humidityService = new Service.HumiditySensor(this.name);
      this.humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .setProps({ minValue: 0, maxValue: 100, minStep: 0.5 });
      this.services.push(this.humidityService);
    }
    this.batteryService = new Service.BatteryService(this.name);
    this.batteryService
      .getCharacteristic(Characteristic.ChargingState)
      .setValue(Characteristic.ChargingState.NOT_CHARGEABLE);
    this.services.push(this.batteryService);

    if (config.heatTrigger) {
      this.heatTriggerService = new Service.ContactSensor(config.heatTrigger.name || this.name, 'heat');
      this.heatTriggerValue = Number(config.heatTrigger.value || 0);
      this.services.push(this.heatTriggerService);
    }

    if (config.coldTrigger) {
      this.coldTriggerService = new Service.ContactSensor(config.coldTrigger.name || this.name, 'cold');
      this.coldTriggerValue = Number(config.coldTrigger.value || 0);
      this.services.push(this.coldTriggerService);
    }

    if (config.motionTrigger) {
      this.motionTriggerService = new Service.MotionSensor(config.motionTrigger.name || this.name);
      this.motionTriggerValue = Number(config.motionTrigger.value || 0);
      this.services.push(this.motionTriggerService);
    }

    if (config.highHumidityTrigger) {
      this.highHumidityTriggerService = new Service.ContactSensor(config.highHumidityTrigger.name || this.name, 'highHumidity');
      this.highHumidityTriggerValue = Number(config.highHumidityTrigger.value || 0);
      this.services.push(this.highHumidityTriggerService);
    }

    if (config.lowHumidityTrigger) {
      this.lowHumidityTriggerService = new Service.ContactSensor(config.lowHumidityTrigger.name || this.name, 'lowHumidity');
      this.lowHumidityTriggerValue = Number(config.lowHumidityTrigger.value || 0);
      this.services.push(this.lowHumidityTriggerService);
    }

    const listenTo = (tag) => {
      tag.on('updated', (data) => {
        this.update(tag, data);
      });
    };

    const tag = tags[this.id];

    if (tag) {
      listenTo(tag);
    } else {
      waitingTags[this.id] = (tag) => {
        listenTo(tag);
      };
    }
  }

  update (tag, data) {
    const { config } = this;
    const { temperature, humidity, battery, accelerationX, accelerationY, accelerationZ } = data;
    const previous = tag.previousValues;

    tag.previousValues = data;

    if (!config.disableTemp) {
      this.tempService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .updateValue(temperature);
    }

    if (!config.disableHumidity) {
      this.humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .updateValue(humidity);
    }

    this.batteryService
      .getCharacteristic(Characteristic.BatteryLevel)
      .updateValue(Math.log10(10 * (battery - 2500) / 500) * 100);

    this.batteryService
      .getCharacteristic(Characteristic.StatusLowBattery)
      .updateValue((battery < 2700) ? 1 : 0);

    if (config.heatTrigger) {
      this.heatTriggerService
        .getCharacteristic(Characteristic.ContactSensorState)
        .updateValue((temperature > this.heatTriggerValue) ? 1 : 0);
    }

    if (config.coldTrigger) {
      this.coldTriggerService
        .getCharacteristic(Characteristic.ContactSensorState)
        .updateValue((temperature < this.coldTriggerValue) ? 1 : 0);
    }

    if (config.highHumidityTrigger) {
      this.highHumidityTriggerService
        .getCharacteristic(Characteristic.ContactSensorState)
        .updateValue((humidity > this.highHumidityTriggerValue) ? 1 : 0);
    }

    if (config.lowHumidityTrigger) {
      this.lowHumidityTriggerService
        .getCharacteristic(Characteristic.ContactSensorState)
        .updateValue((humidity < this.lowHumidityTriggerValue) ? 1 : 0);
    }

    if (config.motionTrigger) {
      const deltaX = previous ? (previous.accelerationX - accelerationX) : 0;
      const deltaY = previous ? (previous.accelerationY - accelerationY) : 0;
      const deltaZ = previous ? (previous.accelerationZ - accelerationZ) : 0;

      const movement = previous ? (hypotenuse(deltaX, deltaY, deltaZ) / 1000) : 0;

      this.motionTriggerService
        .getCharacteristic(Characteristic.MotionDetected)
        .updateValue(movement > this.motionTriggerValue);
    }
    debug(data);
  }

  getServices () {
    return this.services;
  }
}

const streamOptions = {
  proxy: false,
  srtp: true,
  video: {
    resolutions: [
      [1920, 1080, 1]
    ],
    codec: {
      profiles: [0, 1, 2],
      levels: [0, 1, 2]
    }
  },
  audio: {
    codecs: [
      {
        type: 'OPUS',
        samplerate: 24
      },
      {
        type: 'AAC-eld',
        samplerate: 16
      }
    ]
  }
};

class History {
  constructor (hap, config, log, interfaceName) {
    this.history = [];
    this.hap = hap;
    this.config = config;
    this.log = log;
    this.interfaceName = interfaceName;
    this.controlService = new Service.CameraControl();
    this.services = [this.controlService];
    this.maxWidth = 1920;
    this.maxHeight = 1080;
    this.streamControllers = [];

    for (let i = 0; i < 2; i++) {
      const streamController = new StreamController(i, streamOptions, this);

      this.services.push(streamController.service);
      this.streamControllers.push(streamController);
    }
  }

  update (history) {
    this.history = history;
  }

  handleCloseConnection (connectionID) {
    this.log('Closing connection', connectionID);
  }

  handleSnapshotRequest (request, callback) {
    this.log('snapshot request', request);
    callback();
  }

  prepareStream (request, callback) {
    this.log('prepare stream', request);

    callback();
  }

  handleStreamRequest (request) {
    this.log('handle stream request', request);
  }
}

function hypotenuse (a, b, c = 0) {
  return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2) + Math.pow(c, 2));
}
