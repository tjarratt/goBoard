var sys = require("sys"),
    redisClient = require(_appRoot + "/lib/redis-client").createClient(),
    io = require("socket.io");//installed from npm, should be in __appRoot/vendor
    
require(_appRoot + "/lib/underscore-min");

//need a controller prototype obj that handles this natively
function hashResultMaybe(hash, key) {
  //short circuit, but be becareful if value is a bool false value like zero
  if (!hash || (!key && typeof key != "number")) {return false;}
  
  var maybeValue = hash[key];
  maybeValue = maybeValue? maybeValue.toString('utf8') : false;
  return maybeValue;
}
function isValidReturn(e, result) {
  return (e || (!result && typeof result != "number") ) ? false : true;
}

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
    client.send(jStringify({id: json.id, result: true})); //TODO: make sure this only targets one client
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
      whichUser = moveInfo.who,
      src = moveInfo.src;
  
  redisClient.hget("room:" + roomId, "sockets", function(e, result) {
    var usersList = jParse(result);
    usersList = usersList instanceof Array ? usersList : [];
    usersList = _.without(usersList, client.sessionId);
    
    client.broadcastOnly(jStringify({type: "add", who: whichUser, x: atX, y: atY, image: src}), usersList);
    client.send(jStringify({id: json.id, result: true})); //TODO: make sure this only targets one client
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
      username = joinInfo.name, 
      joinAsColor = joinInfo.color;
  
  sys.puts("in handler.join");
  redisClient.hset("socket", socketId, username, function(e, result) {
    if (e || !result) {
      sys.puts("error when writing to socket hash for user: " + username);
      return client.broadcastOnly("err", [client.sessionId]);
    }
    
    redisClient.hmget("room:" + roomId, "sockets", "users", function(e, roomInfo) {
      sys.puts("info for room:" + roomId, "     " + roomInfo);
      
      var sockets = hashResultMaybe(roomInfo, 0),
          users = hashResultMaybe(roomInfo, 1);
          
      sys.puts("got users for room:" + roomId, users);

      users = jParse(users)
      sockets = jParse(sockets);
      var otherUsers = users? users: {},
          allSockets = sockets && sockets instanceof Array ? sockets : [];
      
      var joinMessage = {type: "join", "who": username};
      sys.puts("sending join message: " + jStringify(joinMessage) + " to users : " + jStringify(allSockets));
      client.broadcastOnly(jStringify(joinMessage), allSockets);
      
      otherUsers[username] = {color: joinAsColor};
      sys.puts(otherUsers[username].toString());
      
      allSockets.push(socketId);
      sys.puts("updating users to : " + jStringify(otherUsers));
      sys.puts("updating sockets to : " + jStringify(allSockets));
      
      redisClient.hmset("room:" + roomId, "sockets", jStringify(allSockets), "users", jStringify(otherUsers), function(e, result) {
        if (! isValidReturn(e, result)) {
         sys.puts("error when updating web sockets for room:" + roomId);
        }
        client.send(jStringify({id: json.id, result: true}));
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
        if (!msg || !msg.type || !msg.data || !handler[msg.type]) {
          sys.puts("parsed a message with no type, no data, or no handler for this type");
          return this.send(jStringify(errorJSON));
        }
        else {
          sys.puts("handling a " + msg.type + " websocket message");
          return handler[msg.type](this, msg);
        }
        
      }
      catch (exception) {
        sys.puts("caught an error when parsing a message: " + messageData);
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
