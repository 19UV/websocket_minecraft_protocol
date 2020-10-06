import * as dt from "./data_types.js";

/* // Potential More Expandable Packet System
const BOOLEAN = 0;
const BYTE    = 1;
const UBYTE   = 2;
const SHORT   = 3;
const USHORT  = 4;
const INT     = 5;
const LONG    = 6;
const FLOAT   = 7;
const DOUBLE  = 8;
const STRING  = 9;
const VARINT  = 10;
const VARLONG = 11;
*/

function p_buildHandshake(buffer, protocol_version, server_address, server_port, next_state) {
    var body = [];
    dt.writeVarInt(body, 0x00);
    dt.writeVarInt(body, protocol_version);
    dt.writeString(body, server_address);
    dt.writeUShort(body, server_port);
    dt.writeVarInt(body, next_state);
    
    var header = [];
    dt.writeVarInt(header, body.length);
    body = header.concat(body);
    
    buffer = buffer.concat(body);
}

function p_buildLoginStart(buffer, player_username) {
    var body = [];
    dt.writeVarInt(body, 0x00);
    dt.writeString(body, player_username);
    
    var header = [];
    dt.writeVarInt(header, body.length);
    body = header.concat(body);
    
    buffer = buffer.concat(body);
}

function p_buildEncryptionResponse(buffer, shared_secret, verify_token) {
    var body = [];
    dt.writeVarInt(body, 0x01);
    
    const shared_secret_len = shared_secret.length;
    const verify_len = verify_token.length;
    
    dt.writeVarInt(body, shared_secret_len);
    for (var i=0;i<shared_secret_len;i++) body.push(shared_secret.charCodeAt(i));
    dt.writeVarInt(body, verify_len);
    for (var i=0;i<verify_len;i++) body.push(verify_token.charCodeAt(i));
    
    var header = [];
    dt.writeVarInt(header, body.length);
    body = header.concat(body);
    
    body.forEach((e) => buffer.push(e));
    
    // buffer = buffer.concat(body); // FIX
}

function p_parseEncryptionRequest(buffer, _this) {
    _this.crypto.server_id = dt.readString(buffer);
    var public_key_len = dt.readVarInt(buffer);
    var public_key = [];
    for (var i=0;i<public_key_len;i++) public_key.push(buffer.shift());
    var verify_token_length = dt.readVarInt(buffer);
    var verify_token = [];
    for (var i=0;i<verify_token_length;i++) verify_token.push(buffer.shift());
    
    _this.crypto.client_secret = [...new Uint8Array(16).map((e) => Math.floor(Math.random() * 256))]; // Secret Key Generation
    _this.crypto.public_key = public_key;
    _this.crypto.verify_token = verify_token;
    
    console.log("PUBLIC KEY LENGTH:   " + public_key_len);
    console.log("VERIFY TOKEN LENGTH: " + verify_token_length);
}

export { p_buildHandshake, p_buildLoginStart, p_buildEncryptionResponse, p_parseEncryptionRequest };