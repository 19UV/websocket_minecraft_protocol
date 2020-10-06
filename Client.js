"use strict";

import { VERSION_NUMS } from "./version_def.js";
import { mc_hash_hex_digest, auth_login, mcPubKeyToPem } from "./authentication.js";

import * as pkt from "./packet.js";

import * as dt from "./data_types.js";

class Client extends WebSocket {
    /*
    {
        "server_ip": "127.0.0.1",
        "server_port": 25565,
        "ws_port": 25566,
        "version": "1.8", // Can be either a version string or a version number
        "username": "username",
        "password": "password"
    }
    */
    constructor(settings) {
        super(`ws://${settings.server_ip}:${settings.ws_port}/`, "binary");
        this.server_port = settings.server_port || 25565;
        this.server_ip = settings.server_ip || "127.0.0.1";
        this.ws_port = settings.ws_port || 25566;
        this.version = (typeof(settings.version || "1.8") == "number") ? settings.version : VERSION_NUMS[settings.version];
        if (this.version == undefined) console.warn("Invalid/Unsupported Version");
        this.username = settings.username || "anonymous";
        this.password = settings.password || "";
        
        this.online_mode = this.password != "";
        
        this._events = {};
        
        this.crypto = {
            "public_key": "",
            "client_secret": "",
            "shared_secret": "",
            "cypher": "",
            "verify_token": "",
            "server_id": ""
        };
        
        /*
        STATES:
        0: AUTHENTICATING: Init if online mode is true (Connect with yggdrail)
        1: CONNECTING: Init if online mode is false (WS connect with server)
        2: LOGIN: 
        3: PLAY:
        4: DISCONNECT:
        */
        
        this._create_event("state_change");
        
        this.on("state_change", (current_state) => {
            switch(current_state) {
                case 0:
                    auth_login(this.username, this.password, (data) => {
                        console.log(data);
                        this._set_state(1);
                    });
                    break;
                case 1:
                    if (this.readyState == this.OPEN) {
                        this._join_server();
                    } else {
                        this.onopen = () => {
                            this._join_server();
                        }
                    }
            }
        });
        
        this.STATE = 0;
        this._set_state(this.online_mode ? 0 : 1);
        
        this.onmessage = (blob) => {
            blob.data.arrayBuffer().then(array_buffer => {
                var buffer = [...new Uint8Array(array_buffer)]; // Use array constructor?
                
                while (buffer.length > 0) {
                    var packet_length = dt.readVarInt(buffer);
                    var packet_id = dt.readVarInt(buffer);
                    switch(packet_id) {
                        case 0x01:
                            // [...new Uint8Array(16).map((e) => Math.floor(Math.random() * 256))].map((e) => ((e < 16) ? "0" : "") + e.toString(16)).join("");
                            pkt.p_parseEncryptionRequest(buffer, this);
                            
                            const pubKey = mcPubKeyToPem(this.crypto.public_key);
                            
                            var cypher = new JSEncrypt();
                            cypher.setPublicKey(pubKey);
                            
                            
                            const enc_SharedSecret = cypher.encrypt(String.fromCharCode.apply(null, this.crypto.client_secret));
                            const enc_VerifyToken = cypher.encrypt(String.fromCharCode.apply(null, this.crypto.verify_token));
                            
                            var auth_hash = CryptoJS.algo.SHA1.create();
                            auth_hash.update(this.crypto.server_id);
                            auth_hash.update( String.fromCharCode.apply(null, this.crypto.client_secret) );
                            auth_hash.update( String.fromCharCode.apply(null, this.crypto.public_key) );
                            var hsh = mc_hash_hex_digest(auth_hash);
                            
                            var session_server_payload = JSON.stringify({
                                "accessToken": "<accessToken>",
                                "selectedProfile": "<uuid>",
                                "serverId": this.crypto.server_id
                            });
                            
                            var temp_buffer = [];
                            pkt.p_buildEncryptionResponse(temp_buffer, enc_SharedSecret, enc_VerifyToken);
                            console.log(temp_buffer);
                            break;
                        default:
                            console.log(packet_id);
                            break;
                    }
                }
            });
        }
    }
    
    on(event, callback) {
        if (this._events[event] == undefined) { throw `The Event ${event} Doesn't Exist`; return -1; }
        this._events[event].push(callback);
    }
    
    _create_event(event) { // Will Do Nothing If Event Already Exists
        if (this._events[event] != undefined) return -1;
        this._events[event] = [];
        return 0;
    }
    
    _call_event() {
        var function_args = [];
        for (let i=1;i<arguments.length;i++) function_args.push(arguments[i]);
        this._events[arguments[0]].forEach((f) => f(...function_args));
        return 0;
    }
    
    _set_state(state) {
        const STATES = {
            "AUTHENTICATING": 0,
            "CONNECTING": 1,
            "LOGIN": 2,
            "PLAY": 3,
            "DISCONNECT": 4
        }
        this.STATE = (typeof(state) == "string") ? STATES[state] : state;
        this._call_event("state_change", this.STATE);
    }
    
    _join_server() {
        var body = [];
        dt.writeVarInt(body, 0x00);
        dt.writeVarInt(body, this.version);
        dt.writeVarInt(body, this.server_ip);
        dt.writeUShort(body, this.server_port);
        dt.writeVarInt(body, 2);
        var head = [];
        dt.writeVarInt(head, body.length);
        
        this.send(new Uint8Array([...head, ...body]));
        
        body = [];
        head = [];
        dt.writeVarInt(body, 0x00);
        dt.writeString(body, this.username);
        dt.writeVarInt(head, body.length);
        
        this.send(new Uint8Array([...head, ...body]));
    }
    
    pingServer(callback, callback2) {
        var target_ip = (typeof(callback) == "function") ? `${this.server_ip}:${this.ws_port}` : callback;
        if (typeof(callback) != "function") callback = callback2;
        var temp_ws = new WebSocket(`ws://${target_ip}/`, "binary");
        temp_ws.onopen = () => {
            var body = [];
            dt.writeVarInt(body, 0x00);             // Packet ID
            dt.writeVarInt(body, this.version);     // Protocol Version Int
            dt.writeString(body, this.server_ip);   // Server Address
            dt.writeUShort(body, this.server_port); // Server Port
            dt.writeVarInt(body, 1);                // Ping Request
            
            var head = [];
            dt.writeVarInt(head, body.length);
            
            temp_ws.send(new Uint8Array([...head, ...body]));
            temp_ws.send(new Uint8Array([1, 0])); // Request Packet
        }
        
        temp_ws.onmessage = (blob) => {
            blob.data.arrayBuffer().then(array_buffer => { // Potentially add error handling if more then one packet
                var buffer = [...new Uint8Array(array_buffer)];
                var packet_length = dt.readVarInt(buffer);
                var packet_id = dt.readVarInt(buffer);
                if (packet_id != 0x00) throw ("Packet Error: Expected Packet ID 0, Got Packet ID " + packet_id);
                var handshake_object = JSON.parse(dt.readString(buffer));
                
                callback(handshake_object);
            });
            temp_ws.close(1000);
        }
    }
}

export { Client };