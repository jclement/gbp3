var mqtt = require("mqtt");
var debug = require("debug")("main");
var debugMessage = require("debug")("message");
var debugPoll = require("debug")("poll");
var Gpio = require('onoff').Gpio;

// PIN for reading state of door (true: open, false: closed)
var gpioStatus = new Gpio(4, 'in', 'both');

// PIN for toggling opener.  
var gpioDoor = new Gpio(25, 'out');

// time for door to travel up or down
var doorTravelTime = 12 * 1000; 

// is door travelling?  If so, we skip periodic state reads
var working = false;

var readStateSync = function() {
  debug("Raw Value - %s", gpioStatus.readSync());
  return gpioStatus.readSync() ? "O": "C";
};

debug("Starting State - %s", readStateSync());

var readStateAsync = function(callback) {
  gpioStatus.read(function(err, value) {
    callback(value ? "O" : "C");
  });
};

// starting state...
var currentState = readStateSync(); // C=Closed, O=Open, M=Moving

// periodically read current state so we catch manual door operations
setInterval(function() {
  if (!working) {
    readStateAsync(function(state) {
      debugPoll("Polled state = %s", state);
      if (state !== currentState) {
        currentState = state;
        publishState();
      }
    });
  } else {
    debugPoll("Waiting...");
  }
}, 1000);


var client = mqtt.connect('mqtt://iot.adipose', {
    clientId: 'garage-controller',
});

// push current state to MQTT
var publishState = function() {
  client.publish('garage/state', currentState, {retain: true});
};

// toggle door opener (up or down)
var toggleDoor = function() {
  gpioDoor.writeSync(1);
  setTimeout(function() {
    gpioDoor.writeSync(0);
  }, 250);
};

// open the door
var open = function() {
  if (currentState !== 'C') return;
  working = true;
  debug("Opening");
  toggleDoor();
  currentState = 'U';
  publishState();
  setTimeout(function() {
    working = false;
  }, doorTravelTime);
};

// close the door
var close = function() {
  if (currentState !== 'O') return;
  working = true;
  debug("Closing");
  toggleDoor();
  currentState = 'D';
  publishState();
  setTimeout(function() {
    working = false;
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
