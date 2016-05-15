var debugMessage = require("debug")("sendMessage");
var debugTrigger = require("debug")("trigger");
var path = require("path");
var _ = require("underscore");
var mqtt = require("mqtt");

var nconf = require('nconf');
nconf.argv().env().file({file: path.join(__dirname, 'config.json')});

var smsSend = function(msg) {};
(function() {
  if (nconf.get("twilio:enable")) {
    var twilio = require('twilio')(nconf.get('twilio:sid'), nconf.get('twilio:token'));
    smsSend = function(msg) {
      _.each(nconf.get('twilio:numbers'), function(number) {
        debugMessage("Sending SMS to %s - %s", number, msg)
        twilio.sendMessage({
          to: number,
          from: nconf.get('twilio:from'),
          body: msg
        });
      });
    };
  }
})();

var isOpen = false;
var openTime = null;
var triggers = [];

var addTrigger = function(expectedDuration, func) {
  debugTrigger("Creating trigger at %d seconds", expectedDuration);
  var triggered = false;
  var trigger = {
    process: function(currentDuration) {
      if (triggered) return;
      if (currentDuration > expectedDuration) {
        debugTrigger("Tripped trigger at %d seconds", expectedDuration);
        triggered = true;
        func(expectedDuration);
      }
    },
    reset: function() {
      triggered = false;
    }
  }
  triggers.push(trigger);
};

var reset = function() {
  isOpen = false;
  openTime = null;
};

var start = function() {
  if (isOpen) {
    return;
  }

  isOpen = true;
  openTime = new Date();
  _.each(triggers, function(t) {t.reset();});
  debugTrigger("Resetting triggers");
};

var formatMessage = function(duration) {
  if (duration > 60) {
    return 'Door has been open for ' + Math.round(duration / 60) + ' minutes.';
  } else {
    return 'Door has been open for ' + Math.round(duration) + ' seconds.';
  }

};

var client = mqtt.connect(nconf.get("mqtt:url"), {
  clientId: nconf.get('mqtt:clientid'),
    username: nconf.get('mqtt:username'),
    password: nconf.get('mqtt:password'),
    will: {
      topic: nconf.get("mqtt:topics:presence"),
      payload: 'NOTIFY-OFFLINE'
    }
});

client.on('connect', function() {
  client.subscribe(nconf.get("mqtt:topics:state"));
  client.publish(nconf.get("mqtt:topics:presence"), 'NOTIFY-ONLINE');
});

client.on('message', function(topic, message) {
  if (topic === nconf.get('mqtt:topics:state')) {
    state = message.toString();
    console.log("New State Received: ", state);
    if (state === "O") {
      start();
    } else {
      reset();
    }
  }
});

_.each(nconf.get('twilio:triggers'), function(timeMinutes) {
  addTrigger(60 * timeMinutes, function(t) {smsSend(formatMessage(t));});
})

setInterval(function() {
  if (isOpen) {
    var currentDuration = (new Date().getTime() - openTime.getTime()) / 1000;
    _.each(triggers, function(t) {t.process(currentDuration);});
  }
}, 1000);