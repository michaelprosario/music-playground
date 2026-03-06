### JZZ MIDI Engine Initialization

Source: https://github.com/jazz-soft/jzz/blob/master/test.html

Initializes the JZZ MIDI engine with specific options (sysex enabled, degradation enabled) and displays information about the running engine. Handles potential errors during engine startup.

```javascript
document.getElementById("jzzVersion").innerHTML = JZZ.info().ver;
var output = [];
JZZ({sysex:true, degrade:true})
  .or(function(){
    document.getElementById("midiEngineStatus").innerHTML = "Cannot start MIDI Engine!";
  })
  .and(function(){
    var info = this.info();
    console.log(info);
    document.getElementById("midiEngineStatus").innerHTML = "MIDI Engine is running: " + info.engine + " v." + info.version + "; sysex: " + info.sysex;
  });
```

--------------------------------

### Web MIDI API Usage Example

Source: https://github.com/jazz-soft/jzz/blob/master/web-midi-api/README.md

Demonstrates how to use the Web MIDI API in Node.js. It covers requesting MIDI access, handling success and failure, testing MIDI output ports by sending notes, and testing MIDI input ports by listening for messages. It also shows how to properly close the MIDI access.

```javascript
var navigator = require('web-midi-api');
// consider using var navigator = require('jzz');

var midi;
var inputs;
var outputs;

function onMIDIFailure(msg) {
  console.log('Failed to get MIDI access - ' + msg);
  process.exit(1);
}

function onMIDISuccess(midiAccess) {
  midi = midiAccess;
  inputs = midi.inputs;
  outputs = midi.outputs;
  setTimeout(testOutputs, 500);
}

function testOutputs() {
  console.log('Testing MIDI-Out ports...');
  outputs.forEach(function(port) {
    console.log('id:', port.id, 'manufacturer:', port.manufacturer, 'name:', port.name, 'version:', port.version);
    port.open();
    port.send([0x90, 60, 0x7f]);
  });
  setTimeout(stopOutputs, 1000);
}

function stopOutputs() {
  outputs.forEach(function(port) {
    port.send([0x80, 60, 0]);
  });
  testInputs();
}

function onMidiIn(ev) {
  var arr = [];
  for(var i = 0; i < ev.data.length; i++) {
    arr.push((ev.data[i] < 16 ? '0' : '') + ev.data[i].toString(16));
  }
  console.log('MIDI:', arr.join(' '));
}

function testInputs() {
  console.log('Testing MIDI-In ports...');
  inputs.forEach(function(port) {
    console.log('id:', port.id, 'manufacturer:', port.manufacturer, 'name:', port.name, 'version:', port.version);
    port.onmidimessage = onMidiIn;
  });
  setTimeout(stopInputs, 5000);
}

function stopInputs() {
  console.log('Thank you!');
  navigator.close(); // This will close MIDI inputs, otherwise Node.js will wait for MIDI input forever.
  process.exit(0);
}

avigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
```

--------------------------------

### Receive MIDI In Messages

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Demonstrates opening a MIDI input port, logging the port name, and connecting a callback function to process incoming MIDI messages. The example includes a timeout to close the input.

```javascript
JZZ().openMidiIn().or('Cannot open MIDI In port!')
     .and(function() { console.log('MIDI-In: ', this.name()); })
     .connect(function(msg) { console.log(msg.toString()); })
     .wait(10000).close();
```

--------------------------------

### Install JZZ via npm or yarn

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Installs the JZZ library for use in your Node.js or browser project. It can be added as a project dependency using either npm or yarn package managers.

```bash
npm install jzz --save
```

```bash
yarn add jzz
```

--------------------------------

### JZZ MIDI Output Control

Source: https://github.com/jazz-soft/jzz/blob/master/test.html

Functions for managing MIDI output devices. Includes opening a connection, sending MIDI note events, changing MIDI programs, and closing the connection. Requires the JZZ library.

```javascript
var midi_out;

function open_midi_out() {
  midi_out = JZZ().openMidiOut()
    .or(function(){
      document.getElementById("midiOutName").innerHTML = "Cannot open!";
    })
    .and(function(){
      document.getElementById("midiOutName").innerHTML = this.name();
      console.log(this.info());
    });
}

function test_midi_out() {
  if (midi_out) {
    midi_out.send([0x90, 60, 127])
      .wait(500)
      .send([0x90, 60, 0]);
  }
}

function change_midi_out(x) {
  if (midi_out) {
    midi_out.program(0, x);
  }
}

function close_midi_out() {
  if (midi_out) {
    midi_out.close();
    midi_out = undefined;
    document.getElementById("midiOutName").innerHTML = "closed";
  }
}
```

--------------------------------

### JZZ MIDI Input Handling

Source: https://github.com/jazz-soft/jzz/blob/master/test.html

Functions for managing MIDI input devices and processing incoming MIDI messages. Includes opening a connection, registering a callback for messages, and closing the connection. Messages are displayed in a list, limited to the last 20.

```javascript
var midi_in;
var output = [];

function open_midi_in() {
  midi_in = JZZ().openMidiIn()
    .or(function(){
      document.getElementById("midiInName").innerHTML = "Cannot open!";
    })
    .and(function(){
      document.getElementById("midiInName").innerHTML = this.name();
      console.log(this.info());
    })
    .connect(function(msg){
      output.push(msg.toString());
      if (output.length > 20) {
        output.splice(0, 1);
      }
      document.getElementById("midiIn").innerHTML = output.join("\n");
    });
}

function close_midi_in() {
  if (midi_in) {
    midi_in.close();
    midi_in = undefined;
    document.getElementById("midiInName").innerHTML = "closed";
  }
}
```

--------------------------------

### JZZ MIDI Frequency Conversion

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Provides examples of converting MIDI note numbers and names to frequencies (Hz) and vice versa using JZZ.MIDI functions.

```javascript
JZZ.MIDI.freq('A5'); // => 440
JZZ.MIDI.freq(69);   // => 440
JZZ.MIDI.freq(69.5); // => 452.8929841231365
// from frequency:
JZZ.MIDI.midi(440);  // => 69
JZZ.MIDI.midi(450);  // => 69.38905773230853
// or from name:
JZZ.MIDI.midi('A5'); // => 69
```

--------------------------------

### JZZ Asynchronous MIDI Operations

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Shows how to use async/await syntax with JZZ for handling MIDI operations, including opening ports, sending notes, waiting, and closing connections.

```javascript
// in the environments that support async/await:
async function playNote() {
  var midi = await JZZ();
  var port = await midi.openMidiOut();
  await port.noteOn(0, 'C5', 127);
  await port.wait(500);
  await port.noteOff(0, 'C5');
  await port.close();
  console.log('done!');
}
// or:
async function playAnotherNote() {
  var port = await JZZ().openMidiOut();
  await port.noteOn(0, 'C5', 127).wait(500).noteOff(0, 'C5').close();
  console.log('done!');
}
```

--------------------------------

### WebMIDI Initialization and Port Handling

Source: https://github.com/jazz-soft/jzz/blob/master/test-web-midi.html

Initializes the WebMIDI API, checks for available MIDI input and output ports, and sets up event listeners for MIDI messages. It also includes functions to send MIDI notes and refresh port status.

```javascript
var output = document.getElementById('output');
var midiin = document.getElementById('midiin');
var midilog = [];
var webmidi;
var _time = Date.now || function() { return new Date().getTime(); };
var _startTime = _time();
var _now = typeof performance != 'undefined' && performance.now ? function() { return performance.now(); } : function() { return _time() - _startTime; };

function printMidi(name) {
  return function(msg) {
    var s = name + ':';
    for (var i = 0; i < msg.data.length; i++)
      s += (msg.data[i] < 16 ? ' 0' : ' ') + msg.data[i].toString(16);
    midilog.push(s);
    if (midilog.length > 16)
      midilog.splice(0, 1);
    midiin.innerHTML = midilog.join('\n');
  }
}

function refresh() {
  output.innerHTML = 'WebMIDI is working!\n';
  if (webmidi.outputs.size) {
    output.innerHTML += '\nMIDI-Out ports available: ' + webmidi.outputs.size + '\n';
    var time = _now();
    webmidi.outputs.forEach(function(port) {
      output.innerHTML += ' ' + port.name + '; manufacturer: ' + port.manufacturer + '; version: ' + port.version + '; state: ' + port.state + '\n';
      port.send([0x90, 0x40, 0x7f], time);
      time += 200;
      port.send([0x80, 0x40, 0x00], time);
      time += 200;
    });
  } else {
    output.innerHTML += '\nNo MIDI-Out ports available.\n';
  }
  if (webmidi.inputs.size) {
    output.innerHTML += '\nMIDI-In ports available: ' + webmidi.inputs.size + '\n';
    webmidi.inputs.forEach(function(port) {
      port.onmidimessage = printMidi(port.name);
      output.innerHTML += ' ' + port.name + '; manufacturer: ' + port.manufacturer + '; version: ' + port.version + '; state: ' + port.state + '\n';
    });
  } else {
    output.innerHTML += '\nNo MIDI-In ports available.\n';
  }
}

function fail(err) {
  var s = 'Cannot start WebMIDI';
  if (err) s += ': ' + err;
  output.innerHTML = s;
}

function success(midiaccess) {
  webmidi = midiaccess;
  webmidi.onstatechange = refresh;
  refresh();
}

try {
  navigator.requestMIDIAccess().then(success, fail);
} catch (err) {
  output.innerHTML = 'Cannot start WebMIDI: ' + err;
}
```

--------------------------------

### JZZ Virtual MIDI Ports

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Illustrates how to create and use virtual MIDI output ports in JZZ, including logging messages and substituting the native Web MIDI API's MIDIAccess.

```javascript
var logger = JZZ.Widget({ _receive: function(msg) { console.log(msg.toString()); }});
JZZ.addMidiOut('Console Logger', logger);

// now it can be used as a port:
var port = JZZ().openMidiOut('Console Logger');
// ...

// substitute the native MIDIAccess
// to make virtual ports visible to the Web MIDI API code:
nativator.requestMIDIAccess = JZZ.requestMIDIAccess;
```

--------------------------------

### JZZ MIDI Message Shortcuts

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Demonstrates various shortcut methods in JZZ for sending MIDI messages, including arrays, comma-separated values, note names, and channel-specific operations.

```javascript
// All calls below will do the same job:
port.send([0x90, 61, 127]).wait(500).send([0x80, 61, 0]);   // arrays
port.send(0x90, 61, 127).wait(500).send(0x80, 61, 0);       // comma-separated
port.send(0x90, 'C#5', 127).wait(500).send(0x80, 'Db5', 0); // note names
port.noteOn(0, 'C#5', 127).wait(500).noteOff(0, 'B##4');    // helper functions
port.note(0, 'C#5', 127, 500);                              // another shortcut
port.ch(0).noteOn('C#5').wait(500).noteOff('C#5');          // using channels
port.ch(0).note('C#5', 127, 500);                           // using channels
```

--------------------------------

### Connect MIDI Nodes and Widgets

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Illustrates how to connect MIDI input and output ports with custom JZZ widgets. A 'delay' widget is created to process and re-emit messages after a specified delay, demonstrating signal flow.

```javascript
var input = JZZ().openMidiIn();
var output = JZZ().openMidiOut();
var delay = JZZ.Widget({ _receive: function(msg) { this.wait(500).emit(msg); }});
input.connect(delay);
delay.connect(output);
```

--------------------------------

### Request MIDI Access in Node.js

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Demonstrates how to request MIDI access using JZZ in a Node.js environment, mimicking the browser's Web MIDI API. It includes success and failure callbacks and a method to close the MIDI connection.

```javascript
var navigator = require('jzz');
navigator.requestMIDIAccess().then(onSuccess, onFail);
// ...
navigator.close(); // This will close MIDI inputs,
                   // otherwise Node.js will wait for MIDI input forever.
// In browsers the funcion is neither defined nor required.
```

--------------------------------

### Send MIDI Out Messages

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Shows how to open a MIDI output port and send MIDI messages, such as 'note on' and 'note off'. It uses chained methods for sequential operations with delays.

```javascript
JZZ().or('Cannot start MIDI engine!')
     .openMidiOut().or('Cannot open MIDI Out port!')
     .wait(500).send([0x90,60,127]) // note on
     .wait(500).send([0x80,60,0]);  // note off
```

--------------------------------

### Include JZZ in HTML via CDN

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Loads the JZZ library directly into an HTML page using Content Delivery Networks (CDNs) like jsDelivr or unpkg. This is useful for quick integration or development without a build process.

```html
<script src="https://cdn.jsdelivr.net/npm/jzz"></script>       // the latest version, or
<script src="https://cdn.jsdelivr.net/npm/jzz@1.9.3"></script> // any particular version
//...
```

```html
<script src="https://unpkg.com/jzz"></script>       // the latest version, or
<script src="https://unpkg.com/jzz@1.9.3"></script> // any particular version
//...
```

--------------------------------

### Import JZZ in AMD

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Loads the JZZ library using the Asynchronous Module Definition (AMD) pattern, commonly used with module loaders like RequireJS. This is suitable for browser environments that prefer AMD.

```javascript
require(['JZZ'], function(JZZ) {
  //...
});
```

--------------------------------

### JZZ MIDI 2.0 and UMP Operations

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Details the usage of MIDI 2.0 adapters (`MIDI2()`, `MIDI1()`) and helper functions for sending MIDI 2.0 messages, including UMP (Universal MIDI Packet) format. It covers group, channel, and SysEx ID settings.

```APIDOC
MIDI2()
  Enables MIDI 2.0 for all subsequent chained calls.
  Clears default group, channel, SysEx ID, and MPE settings.

MIDI1()
  Returns operation back to MIDI 1.0.
  Clears default group, channel, SysEx ID, and MPE settings.

connect(target)
  Connects the current JZZ widget to a target widget or function.

send(message)
  Sends a MIDI message. Accepts arrays, comma-separated values, or note names.

noteOn(group, note, velocity)
  Sends a MIDI 2.0 Note On message.
  Parameters:
    group (number): The MIDI 2.0 group (0-15).
    note (string|number): The note name (e.g., 'C5') or MIDI note number (0-127).
    velocity (number): The velocity (0-127).

noteOff(group, note)
  Sends a MIDI 2.0 Note Off message.
  Parameters:
    group (number): The MIDI 2.0 group (0-15).
    note (string|number): The note name (e.g., 'C5') or MIDI note number (0-127).

wait(milliseconds)
  Waits for a specified duration before proceeding.

close()
  Closes the MIDI port.

ch(channel)
  Sets the default MIDI channel (0-15) for subsequent calls.

gr(group)
  Sets the default MIDI 2.0 group (0-15) for subsequent calls.

sxId(sysExId)
  Sets the default SysEx ID for subsequent calls.

umpNoteOn(group, note, velocity)
  Sends a MIDI 2.0 Note On message specifically formatted as a UMP.
  Parameters:
    group (number): The MIDI 2.0 group (0-15).
    note (string|number): The note name (e.g., 'C5') or MIDI note number (0-127).
    velocity (number): The velocity (0-127).

Example Usage:
first
  .send([0x90, 0x3c, 0x7f])       // 90 3c 7f -- Note On (MIDI 1.0)
  .MIDI2()                        // enable MIDI 2.0
  .send([0x20, 0x90, 0x3c, 0x7f]) // 20903c7f -- Note On (MIDI 2.0 UMP)
  .MIDI1()                        // reset to MIDI 1.0
  .send([0x90, 0x3c, 0x7f])       // 90 3c 7f -- Note On (MIDI 1.0)

first
  .noteOn(5, 'C5', 127)           // 22953c7f -- Note On (MIDI 2.0, group 5)
  .ch(5).noteOn('C5', 127)        // 953c7f -- Note On (MIDI 1.0, channel 5)
  .MIDI2()
  .noteOn(2, 5, 'C5', 127)        // 22953c7f -- Note On (MIDI 2.0, group 2)
  .gr(2).noteOn(5, 'C5', 127)     // 22953c7f -- Note On (MIDI 2.0, group 2)
  .ch(5).noteOn('C5', 127)        // 22953c7f -- Note On (MIDI 2.0, group 2, channel 5)
  .MIDI2()
  .noteOn(2, 5, 'C5', 127)        // 22953c7f -- Note On (MIDI 2.0, group 2)
  .ch(5).noteOn(2, 'C5', 127)     // 22953c7f -- Note On (MIDI 2.0, group 2, channel 5)
  .MIDI2()
  .umpNoteOn(2, 5, 'C5', 127)     // 42953c00 007f0000 -- Note On (MIDI 2.0 UMP, group 2)
  .gr(2).umpNoteOn(5, 'C5', 127)  // 42953c00 007f0000 -- Note On (MIDI 2.0 UMP, group 2)
  .ch(5).umpNoteOn('C5', 127)     // 42953c00 007f0000 -- Note On (MIDI 2.0 UMP, group 2, channel 5)
```

--------------------------------

### Deprecated Module Export

Source: https://github.com/jazz-soft/jzz/blob/master/web-midi-api/README.md

This snippet shows the deprecated module export for the 'web-midi-api' package, which redirects to the 'jzz' package. It's intended for compatibility with older projects.

```javascript
// index.js:
module.exports = require('jzz');
```

--------------------------------

### Import JZZ in CommonJS (Node.js)

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Imports the JZZ library into a Node.js environment using the CommonJS module system. This is the standard way to include modules in Node.js applications.

```javascript
var JZZ = require('jzz');
//...
```

--------------------------------

### Import JZZ in TypeScript/ES6

Source: https://github.com/jazz-soft/jzz/blob/master/README.md

Imports the JZZ library using modern JavaScript module syntax (ES6 imports) or TypeScript. This allows for type checking and better code organization.

```typescript
import { JZZ } from 'jzz';
//...
```

=== COMPLETE CONTENT === This response contains all available snippets from this library. No additional content exists. Do not make further requests.

