"use strict";

// Coverts int to a hex value with length 2
function tohex(value) {return ((value < 16) ? "0" : "") + value.toString(16)}

function writeString(buffer, value) {
  const len = value.length;
  writeVarInt(buffer, len);

  for (let i=0;i<len;i++) {
    buffer.push(value.charCodeAt(i));
  }
}

function readString(buffer) {
  const length = readVarInt(buffer);
  let ret = "";
  for (let i=0;i<length;i++) {
    ret += String.fromCharCode( buffer.shift() );
  }
  return ret;
}

function writeUShort(buffer, value) {
  if (value > 65535) {
    console.log("ERROR: Value (" + value + ") is greater than max (65535)");
    value = value % 65535;
  }
  buffer.push((value>>8) & 0xff);
  buffer.push(value & 0xff);
}

function readUShort(buffer) {
  let b1 = buffer.shift();
  let b2 = buffer.shift();
  return (b1 << 8) | b2;
}

function testUShort() {
  let successful = true;
  let buffer = [];
  for (let i=0;i<65535;i++) {
    writeUShort(buffer, i);
    if (readUShort(buffer) != i) {
      console.log("ERROR: " + i);
      successful = false;
    }
  }
  return successful;
}

function readVarInt(buffer) {
  let numRead = 0;
  let result = 0;
  let read = 0;
  do {
    read = buffer.shift();
    let value = (read & 0x7f);
    result |= (value << (7 * numRead));
    numRead++;
    if (numRead > 5) {
      console.log("VarInt is too big");
    }
  } while ((read & 0x80) != 0);

  return result;
}

function writeVarInt(buffer, value) {
  value |= 0;
  while (true) {
    const byte = value & 0x7f;
    value >>= 7;
    if (
      (value === 0 && (byte & 0x40) === 0) ||
      (value === -1 && (byte & 0x40) !== 0)
    ) {
      buffer.push(byte);
      return buffer;
    }
    buffer.push(byte);
  }
}

export { writeString, readString, writeUShort, readUShort, readVarInt, writeVarInt };