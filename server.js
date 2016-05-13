var mqtt = require("mqtt");
var debug = require("debug")("main");
var debugMessage = require("debug")("message");

var currentState = 'C'; // C=Closed, O=Open, M=Moving
var doorTravelTime = 5000;

var client = mqtt.connect('mqtt://iot.adipose', {
    clientId: 'garage-controller',
});

// push current state to MQTT
var publishState = function() {
  client.publish('garage/state', currentState, {retain: true});
};

// open the door
var open = function() {
  if (currentState !== 'C') return;
  debug("Opening");
  currentState = 'U';
  publishState();
  setTimeout(function() {
    debug("Opened");
    currentState = 'O';
    publishState();
  }, doorTravelTime);
};

// close the door
var close = function() {
  if (currentState !== 'O') return;
  debug("Closing");
  currentState = 'D';
  publishState();
  setTimeout(function() {
    debug("Closed");
    currentState = 'C';
    publishState();
  }, doorTravelTime);
};

client.on('connect', function() {
  client.subscribe('garage/control');
  publishState();
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