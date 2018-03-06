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
    const acc = this;

    this.log = log;
    this.name = config['name'];
    this.id = config['id'];

    this.temperature = null;
    this.humidity = null;

    this.tempService = new Service.TemperatureSensor(this.name);
    this.tempService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({ minValue: -200, maxValue: 200, minStep: 0.01 })
      .on('get', this.getTemperature.bind(this));

    this.humidityService = new Service.HumiditySensor(this.name);
    this.humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .setProps({ minValue: 0, maxValue: 100, minStep: 0.5 })
      .on('get', this.getHumidity.bind(this));

    const listenTo = (tag) => {
      tag.on('updated', (data) => {
        const { temperature, humidity } = data;
        acc.temperature = temperature;
        acc.humidity = humidity;
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
  getTemperature (callback) {
    callback(null, this.temperature);
  }
  getHumidity (callback) {
    callback(null, this.humidity);
  }
  getServices () {
    return [this.tempService, this.humidityService];
  }
}
