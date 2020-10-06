"use strict";

const yggdrasil_url = "yggdrasilmirror.19uv.repl.co";

function http_post(path, data, callback) {
    if (typeof(data) == "object") { data = JSON.stringify(data); }
    
    let request = new XMLHttpRequest();
    request.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            callback(request.responseText);
        }
    }
    request.open("POST", "http://" + yggdrasil_url + path, true);
    request.send(data);
}

function mcHexDigest(str) {
  var sha1 = CryptoJS.algo.SHA1.create();
  sha1.update(str);
  var hash = sha1.finalize();
  var negative = hash.words[0]<0;
  if (negative) {
    performTwosCompliment(hash);
  }
  var digest = hash.toString(CryptoJS.enc.Hex);
  digest = digest.replace(/^0+/g, '');
  if (negative) digest = '-' + digest;
  return digest;
}

export function mc_hash_hex_digest(cyp) {
    var hash = cyp.finalize();
    var negative = hash.words[0]<0;
    if (negative) performTwosCompliment(hash);
    var digest = hash.toString(CryptoJS.enc.Hex);
    digest = digest.replace(/^0+/g, "");
    if (negative) digest = "-" + digest;
    return digest;
}

function performTwosCompliment(buffer) {
  var carry = true;
  var i, newByte, value;
  for (i = buffer.words.length - 1; i >= 0; --i) {
    value = buffer.words[i];
    newByte = ~value & 0xffffffff;
    if (carry) {
      carry = newByte === 0xffffffff;
      buffer.words[i] = carry ? 0 : newByte + 1;
    } else {
      buffer.words[i] = newByte;
    }
  }
}

export function mcPubKeyToPem(mcPubKeyBuffer) {
    var pem = "-----BEGIN PUBLIC KEY-----\n";
    // mcPubKeyBuffer.toString('base64');
    var base64_pub_key = btoa(String.fromCharCode.apply(null, mcPubKeyBuffer));
    const MAX_LINE_LENGTH = 65;
    while (base64_pub_key.length > 0) {
        pem += base64_pub_key.substring(0, MAX_LINE_LENGTH) + "\n";
        base64_pub_key= base64_pub_key.substring(MAX_LINE_LENGTH);
    }
    pem += "-----END PUBLIC KEY-----\n";
    return pem;
}

export function auth_login(username, password, callback) {
    let params = JSON.stringify({
        "agent" : {
            "name" : "Minecraft",
            "version" : 1
        },
        "username" : username,
        "password" : password
    });
    
    http_post("/authenticate", params, (data) => callback(JSON.parse(data)));
}