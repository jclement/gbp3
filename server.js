var mqtt = require("mqtt");
var debug = require("debug")("main");
var debugMessage = require("debug")("message");

var currentState = 'C'; // C=Closed, O=Open, M=Moving

var client = mqtt.connect('mqtt://iot.adipose', {
    clientId: 'garage-controller',
});

var publishState = function() {
  client.publish('garage/state', currentState, {retain: true});
};

var open = function() {
  debugMessage("Opening");
  currentState = 'U';
  publishState();
  setTimeout(function() {
    debugMessage("Opened");
    currentState = 'O';
    publishState();
  }, 5000);
};

var close = function() {
  debugMessage("Closing");
  currentState = 'D';
  publishState();
  setTimeout(function() {
    debugMessage("Closed");
    currentState = 'C';
    publishState();
  }, 5000);
};

client.on('connect', function() {
  client.subscribe('garage/control');
  client.publish('garage/state', currentState, {retain: true});
});

client.on('message', function(topic, message) {
  if (topic === 'garage/control') {
    var targetState = message.toString();
    debugMessage("Message Received [%s]", targetState);
    if (currentState === 'O' && targetState === 'C') {
      close();
    }
    if (currentState === 'C' && targetState === 'O') {
      open();
    }
  }
});

