const ruuvi = require('node-ruuvitag');

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
    this.name = config['name'];
    this.id = config['id'];

    this.tempService = new Service.TemperatureSensor(this.name);
    this.humidityService = new Service.HumiditySensor(this.name);
    this.batteryService = new Service.BatteryService(this.name);

    this.tempService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({ minValue: -200, maxValue: 200, minStep: 0.01 });

    this.humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .setProps({ minValue: 0, maxValue: 100, minStep: 0.5 });

    this.batteryService
      .getCharacteristic(Characteristic.ChargingState)
      .setValue(Characteristic.ChargingState.NOT_CHARGEABLE);

    const listenTo = (tag) => {
      tag.on('updated', (data) => {
        const { temperature, humidity, battery } = data;

        this.tempService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .updateValue(temperature);

        this.humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .updateValue(humidity);

        this.batteryService
        .getCharacteristic(Characteristic.BatteryLevel)
        .updateValue(Math.log10(10 * (battery - 2500) / 500) * 100);

        this.batteryService
        .getCharacteristic(Characteristic.StatusLowBattery)
        .updateValue((battery < 2700) ? 1 : 0);
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
    return [this.tempService, this.humidityService, this.batteryService];
  }
}
