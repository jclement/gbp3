// HomeKit types required
var nconf = require("nconf");
nconf.argv().env().file({file: __filename + "on"}); // cheat and look for JSON with same name

var types = require("./types.js");
var exports = module.exports = {};
var mqtt = require('mqtt');
var client = mqtt.connect(nconf.get("mqtt:url"), {
  clientId: nconf.get("mqtt:clientid"),
  clean: true,
  username: nconf.get("mqtt:username"),
  password: nconf.get("mqtt:password"),
  will: {
    topic: nconf.get('mqtt:topics:presence'),
    payload: 'SIRI-OFFLINE'
  }
});

var state = undefined;
var currentStateMap = {
  'O': 0,
  'C': 1,
  'U': 2,
  'D': 3
};

var targetStateMap = {
  'O': 0,
  'C': 1,
  'U': 0,
  'D': 1
};

client.on('connect', function() {
  client.subscribe(nconf.get('mqtt:topics:state'));
  client.publish(nconf.get('mqtt:topics:presence'), 'SIRI-ONLINE');
});

client.on('message', function(topic, message) {
  if (topic === nconf.get('mqtt:topics:state')) {
    state = message.toString();
    console.log("New State Received: ", state);
  }
});

exports.accessory = {
  displayName: nconf.get('homekit:name'),
  username: nconf.get('homekit:username'),
  pincode: nconf.get('homekit:pincode'),
  services: [{
    sType: types.ACCESSORY_INFORMATION_STYPE, 
    characteristics: [{
      cType: types.NAME_CTYPE, 
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: nconf.get('homekit:name'),
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Name of the accessory",
      designedMaxLength: 255    
    },{
      cType: types.MANUFACTURER_CTYPE, 
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: "Oltica",
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Manufacturer",
      designedMaxLength: 255    
    },{
      cType: types.MODEL_CTYPE,
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: "Rev-1",
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Model",
      designedMaxLength: 255    
    },{
      cType: types.SERIAL_NUMBER_CTYPE, 
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: "A1S2NASF88EW",
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "SN",
      designedMaxLength: 255    
    },{
      cType: types.IDENTIFY_CTYPE, 
      onUpdate: null,
      perms: ["pw"],
      format: "bool",
      initialValue: false,
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Identify Accessory",
      designedMaxLength: 1    
    }]
  },{
    sType: types.GARAGE_DOOR_OPENER_STYPE, 
    characteristics: [{
      cType: types.NAME_CTYPE,
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: nconf.get('homekit:name') + " Control",
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "Name of service",
      designedMaxLength: 255   
    },{
      cType: types.CURRENT_DOOR_STATE_CTYPE,
      onUpdate: function(value) { 
      },
      onRead: function(callback) {
        callback(currentStateMap[state]); 
      },
      perms: ["pr","ev"],
      format: "int",
      initialValue: 0,
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "BlaBla",
      designedMinValue: 0,
      designedMaxValue: 4,
      designedMinStep: 1,
      designedMaxLength: 1    
    },{
      cType: types.TARGET_DOORSTATE_CTYPE,
      onUpdate: function(value) { 
        console.log("Change:",value); 
        if (value === 0) {
          client.publish(nconf.get('mqtt:topics:control'), 'O');
          console.log("Sending open command");
        }
        if (value === 1) {
          client.publish(nconf.get('mqtt:topics:control'), 'C');
          console.log("Sending close command");
        }
      },
      onRead: function(callback) {
        callback(targetStateMap[state]); 
      },
      perms: ["pr","pw","ev"],
      format: "int",
      initialValue: 0,
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "BlaBla",
      designedMinValue: 0,
      designedMaxValue: 1,
      designedMinStep: 1,
      designedMaxLength: 1    
    },{
      cType: types.OBSTRUCTION_DETECTED_CTYPE,
      onUpdate: function(value) { 
      },
      onRead: function(callback) {
        callback(undefined); // only testing, we have no physical device to read from
      },
      perms: ["pr","ev"],
      format: "bool",
      initialValue: false,
      supportEvents: false,
      supportBonjour: false,
      manfDescription: "BlaBla"
    }]
  }]
}
