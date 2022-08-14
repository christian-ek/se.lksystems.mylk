'use strict';

const fetch = require('node-fetch');

function checkResponseStatus(res) {
  if (res.ok) {
    return res;
  }
  throw new Error(`Status of the reponse: ${res.status} (${res.statusText})`);
}

module.exports.getStatus = body => {
  const result = {};

  result.name = this.getAsciiFromHex(body.name);
  result.target_temperature = parseFloat(this.roundHalf(body.set_room_deg / 100).toFixed(1));
  result.measure_temperature = parseFloat(this.roundHalf(body.get_room_deg / 100).toFixed(1));
  result.battery = parseFloat(body.battery);

  return result;
};

module.exports.roundHalf = num => {
  return Math.round(num * 2) / 2;
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

module.exports.doRequest = async function doRequest(homey, url, method) {
  const password = homey.settings.get('password');
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
      homey.log(error);
      return Promise.reject(new Error(error));
    });
};
