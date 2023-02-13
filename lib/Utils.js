'use strict';

const fetch = require('node-fetch');

function checkResponseStatus(res) {
  if (res.ok) {
    return res;
  }
  throw new Error(`Status of the reponse: ${res.status} (${res.statusText})`);
}

module.exports.getThermostatStatus = body => {
  const result = {};

  result.name = this.getAsciiFromHex(body.name);
  result.target_temperature = parseFloat(this.roundHalf(body.set_room_deg / 100).toFixed(1));
  result.measure_temperature = parseFloat(this.roundHalf(body.get_room_deg / 100).toFixed(1));
  result.battery = parseFloat(body.battery);

  return result;
};

module.exports.getWaterStatus = body => {
  const result = {};

  result.name = this.getAsciiFromHex(body.name);
  result.pressure = parseFloat(this.convertPressure(body.pressure).toFixed(1));
  result.valve = !!Number(body.valve);

  if (result.name === '') {
    result.name = 'Cold water';
  }

  return result;
};

module.exports.getWaterDetectorStatus = body => {
  const result = {};

  result.name = this.getAsciiFromHex(body.name);
  result.temperature = parseFloat(this.roundHalf(body.temperature / 100).toFixed(1));
  result.alarm_battery = !!Number(body.low_battery);
  result.id = body.id;
  result.alarm_water = !!Number(body.water_alarm);

  if (result.name === '') {
    result.name = 'Water detector';
  }

  return result;
};

module.exports.roundHalf = num => {
  return Math.round(num * 2) / 2;
};

module.exports.convertPressure = pressure => {
  // convert the measured 4-20 mA (0-10 Bar) value into Bar
  // 4 mA is 186(=0,004A*150ohm/(3,3V/1023))
  // 20 mA is 930(=0,020A*150ohm/(3,3V/1023))
  if (pressure < 150) {
    return 0;
  }

  if (pressure < 186) {
    pressure = 186;
  }

  const a = (pressure - 186);
  const b = (930 - 186);
  const c = a / b;

  return (c * 10.0);
};

module.exports.getAsciiFromHex = hex => {
  if (hex == null) {
    return '';
  }
  let str = '';
  for (let n = 0; n < hex.length; n += 2) {
    str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
  }
  return str;
};

module.exports.doRequest = async function doRequest(password, url, method) {
  const auth = `Basic ${Buffer.from(`lk:${password}`).toString('base64')}`;

  const options = {
    method,
    headers: {
      Authorization: auth,
    },
  };

  return fetch(url, options)
    .then(checkResponseStatus)
    .then(res => {
      return res.json();
    })
    .then(data => {
      return data;
    })
    .catch(error => {
      throw new Error(error);
    });
};
