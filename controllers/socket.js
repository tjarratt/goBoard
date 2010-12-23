var sys = require("sys"),
    redisClient = require(_appRoot + "/lib/redis-client").createClient(),
    io = require("socket.io");//installed from npm, should be in __appRoot/vendor
    
require(_appRoot + "/lib/underscore-min");

//message protocol handler obj
var handler = {}; 
//{type:"add", data: {room: %integer%, id: %int%, x: %int%, y: %int%}} 
handler.move = function(client, json) { //should we use an ID per piece? seems reasonable
  var socketId = client.sessionId,
      moveInfo = json.data,
      roomId = moveInfo.room,
      moveX = moveInfo.x,
      moveY = moveInfo.y,
      whichUser = moveInfo.who;
      
  //for now assume this is all valid
  redisClient.hget("room:" + roomId, "sockets", function(e, result) {
    //if(e || !result) {//argh}
    var usersList = jParse(result);
    usersList = usersList instanceof Array ? usersList : [];
    usersList = _.without(usersList, client.sessionId);
    
    client.broadcastOnly(jStringify({type: "move", who: whichUser, x: moveX, y: moveY}), usersList);
  });
}
//{type:"add", data: {room: %integer%, x: %int%, y: %int%}}
handler.add = function(client, json) {
  //console.log("called add, but it is not implemented yet");
  var socketId = client.sessionId,
      moveInfo = json.data,
      roomId = moveInfo.room,
      atX = moveInfo.x,
      atY = moveInfo.y,
      whichUser = moveInfo.who;
  
  redisClient.hget("room:" + roomId, "sockets", function(e, result) {
    var usersList = jParse(result);
    usersList = usersList instanceof Array ? usersList : [];
    usersList = _.without(usersList, client.sessionId);
    
    client.broadcastOnly(jStringify({type: "add", who: whichUser, x: atX, y: atY}), usersList);
  });
  
}
//{type:"chat", data: {room: %integer%, msg: %string%, type: [emote, chat]}}
handler.chat = function(client, json) {
  console.log("called chat, but it is not implemented yet");
}
//{type:"whisper", data: {msg: %string%, to: %string%}}
handler.whisper = function(client, json) {
  console.log("called whisper, but it is not implemented yet");
}
//{type:"forfeit", data: {room: %integer%, forfeit: true}}
handler.forfeit = function(client, json) {
  console.log("called forfeit, but it is not implemented yet");
} 

//{type:"join", data: {room: %integer%, name: %string%}}
                                        //probably safe to assume for now 
handler.join = function(client, json) { //that no one will play more than one game at once :(
  //assert json.type, "join"
  var socketId = client.sessionId,
      joinInfo = json.data,
      roomId = joinInfo.room,
      username = joinInfo.name;
  
  redisClient.hset("socket", socketId, username, function(e, result) {
    if (e || !result) {
      sys.puts("error when writing to socket hash for user: " + username);
      return client.broadcastOnly("err", [client.sessionId]);
    }
    
    redisClient.hget("room:" + roomId, "sockets", function(e, sockets) {
      var otherUsers = otherUsers instanceof Array? otherUsers : [];
      var joinMessage = {type: "join", "who": username};
      client.broadcastOnly(jStringify(joinMessage), otherUsers);
      
      otherUsers.push(socketId);
      redisClient.hset("room:" + roomId, "sockets", otherUsers, function(e, result) {
        if (e || !result) { sys.puts("error when updating web sockets for room:" + roomId); }
      });
    });
  });
}

handler.disconnect = function(client, roomId) {
  var socketId = client.sessionId;
  redisClient.hget("room:" + roomId, "sockets", function(e, sockets) {
    var socketsList = sockets? jParse(sockets) : [];
    
    var everyoneElse = _.without(socketsList, socketId);
    redisClient.hset("room:" + roomId, "sockets", everyoneElse, function(e, result) {
      if (e || !result) { sys.puts("whoops couldn't update socket list"); }
      
      redisClient.hget("socket", socketId, function(e, username) {
        var disconnectMsg = {"type": "disconnect", "who": username};
        client.broadcastOnly(jStringify(disconnectMsg), everyoneElse);
      });
    });
  });
}

//setup socket.io server on top of express _app
var buffer = [], jStringify = JSON.stringify, jParse = JSON.parse;
var startSocket = function() {
  console.log("starting socket.io server on port 8080?");
  
  var socket = io.listen(_app);
  socket.on("connection", function(client) {
    
    var errorJSON = {error: "bad json"};
    client.on("message", function(messageData) {
      //parse message, handle it
      try 
      {
        msg = jParse(messageData); //parse, look for invalid message type
        if (!msg || !msg.type || !msg.data || handler[msg.type]) {
          return this.send(jStringify(errorJSON));
        }
        else {
          return handler[msg.type](this, msg);
        }
        
      }
      catch (exception) {
        return this.send(jStringify(error));
      } //if this doesn't work try client.broadcastOnly(jStringify(error), [client.sessionId]);
    });
    
    client.on("disconnect", function() {
      //find roomId(s?) for this user
      //handler.disconnect(this, roomId);
    });
  });
}

var tryStart = function() {
  if (_app == null) {
    sys.log("express not started yet, waiting for nextTick to start socket server.");
    
    //would probably be more effective to just listen for an event
    return process.nextTick(tryStart);
  }
  else { startSocket(); }
}

tryStart();
