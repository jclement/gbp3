var mqtt = require("mqtt");
var debug = require("debug")("main");
var debugMessage = require("debug")("message");
var debugPoll = require("debug")("poll");
var Gpio = require('onoff').Gpio;
var path = require('path');

var nconf = require('nconf');
nconf.argv().env().file({file: path.join(__dirname, 'config.json')});

// PIN for reading state of door (true: open, false: closed)
PIN_STATUS = nconf.get('pins:status');
var gpioStatus = new Gpio(nconf.get('pins:status'), 'in', 'both');

// PIN for toggling opener.  
PIN_CONTROL = nconf.get('pins:control');
var gpioControl = new Gpio(nconf.get('pins:control'), 'out');

// time for door to travel up or down.  Don't read state
// during travel because it's misleading.
var doorTravelTime = nconf.get('traveltime') * 1000; 

// is door travelling?  If so, we skip periodic state reads
var working = false;

var readStateSync = function() {
  return gpioStatus.readSync() ? "O": "C";
};

var readStateAsync = function(callback) {
  gpioStatus.read(function(err, value) {
    callback(value ? "O" : "C");
  });
};

// starting state...
var currentState = readStateSync(); // C=Closed, O=Open

// periodically read current state so we catch manual door operations
setInterval(function() {
  if (!working) {
    readStateAsync(function(state) {
      if (state !== currentState) {
        debugPoll("Polled state changed from %s to %s", currentState, state);
        currentState = state;
        publishState();
      }
    });
  } else {
    debugPoll("Waiting...");
  }
}, 1000);

var client = mqtt.connect(nconf.get("mqtt:url"), {
  clientId: nconf.get('mqtt:clientid'),
  username: nconf.get('mqtt:username'),
  password: nconf.get('mqtt:password'),
  will: {
    topic: nconf.get("mqtt:topics:presence"),
    payload: 'GBP-OFFLINE'
  }
});

// push current state to MQTT
var publishState = function() {
  client.publish(nconf.get("mqtt:topics:state"), currentState, {retain: true});
};

// toggle door opener (up or down)
var toggleDoor = function() {
  gpioControl.writeSync(1);
  setTimeout(function() {
    gpioControl.writeSync(0);
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
  debugMessage("Connected to %s", nconf.get("mqtt:url"));
  client.subscribe(nconf.get("mqtt:topics:control"));
  client.publish(nconf.get("mqtt:topics:presence"), 'GBP-ONLINE');
  publishState();
});

client.on('message', function(topic, message) {
  if (topic === nconf.get("mqtt:topics:control")) {
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
