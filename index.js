const ruuvi = require('@pakastin/node-ruuvitag');

let Service;
let Characteristic;

const waitingTags = {};
const tags = {};

ruuvi.on('found', tag => {
  tags[tag.id] = tag;
  waitingTags[tag.id] && waitingTags[tag.id](tag);
  delete waitingTags[tag.id];
});

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-ruuvitag', 'Ruuvitag', Ruuvitag, true);
};

class Ruuvitag {
  constructor (log, config) {
    this.log = log;
    this.name = config.name;
    this.id = config.id;

    if (!config.disableTemp) {
      this.tempService = new Service.TemperatureSensor(this.name);
      this.tempService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({ minValue: -200, maxValue: 200, minStep: 0.01 });
    }
    if (!config.disableHumidity) {
      this.humidityService = new Service.HumiditySensor(this.name);
      this.humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .setProps({ minValue: 0, maxValue: 100, minStep: 0.5 });
    }
    this.batteryService = new Service.BatteryService(this.name);
    this.batteryService
      .getCharacteristic(Characteristic.ChargingState)
      .setValue(Characteristic.ChargingState.NOT_CHARGEABLE);

    if (config.heatTrigger) {
      this.heatTriggerService = new Service.ContactSensor(config.heatTrigger.name || this.name, 'heat');
      this.heatTriggerValue = Number(config.heatTrigger.value || 0);
    }

    if (config.coldTrigger) {
      this.coldTriggerService = new Service.ContactSensor(config.coldTrigger.name || this.name, 'cold');
      this.coldTriggerValue = Number(config.coldTrigger.value || 0);
    }

    if (config.motionTrigger) {
      this.motionTriggerService = new Service.MotionSensor(config.motionTrigger.name || this.name);
      this.motionTriggerValue = Number(config.motionTrigger.value || 0);
    }

    if (config.highHumidityTrigger) {
      this.highHumidityTriggerService = new Service.ContactSensor(config.highHumidityTrigger.name || this.name, 'highHumidity');
      this.highHumidityTriggerValue = Number(config.highHumidityTrigger.value || 0);
    }

    if (config.lowHumidityTrigger) {
      this.lowHumidityTriggerService = new Service.ContactSensor(config.lowHumidityTrigger.name || this.name, 'lowHumidity');
      this.lowHumidityTriggerValue = Number(config.lowHumidityTrigger.value || 0);
    }

    const listenTo = (tag) => {
      tag.on('updated', (data) => {
        const { temperature, humidity, battery, accelerationX, accelerationY, accelerationZ } = data;
        const previous = tag.previousValues;

        const deltaX = previous ? (previous.accelerationX - accelerationX) : 0;
        const deltaY = previous ? (previous.accelerationY - accelerationY) : 0;
        const deltaZ = previous ? (previous.accelerationZ - accelerationZ) : 0;

        const movement = previous ? (Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2) + Math.pow(deltaZ, 2)) / 1000) : 0;

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
          this.motionTriggerService
            .getCharacteristic(Characteristic.MotionDetected)
            .updateValue(movement > this.motionTriggerValue);
        }
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
  getServices () {
    const services = [];

    if (this.tempService) {
      services.push(this.tempService);
    }

    if (this.humidityService) {
      services.push(this.humidityService);
    }

    services.push(this.batteryService);

    if (this.heatTriggerService) {
      services.push(this.heatTriggerService);
    }

    if (this.coldTriggerService) {
      services.push(this.coldTriggerService);
    }

    if (this.highHumidityTriggerService) {
      services.push(this.highHumidityTriggerService);
    }

    if (this.lowHumidityTriggerService) {
      services.push(this.lowHumidityTriggerService);
    }

    if (this.motionTriggerService) {
      services.push(this.motionTriggerService);
    }

    return services;
  }
}
