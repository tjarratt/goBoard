function SocketHandler() {
  if ( !(this instanceof arguments.callee) ) 
      return new SocketHandler(); 

  this.messages = {};
  this.socket = false;
  this.accepts = ["move", "add", "join", "disconnect"];
}

SocketHandler.prototype.handle = function(dataMessage) {
  try {
    var dataObj = typeof dataMessage == "object" ? dataMessage : JSON.parse(dataMessage);
  
    //look for a corresponding message in this.messages
    if (dataObj.id && dataObj.result) {
      console.log("got callback for a message");
      msgId = dataObj.id,
      result = dataObj.result ? true : false,
      callback = this.messages[msgId];
      
      //remove this from our list of messages to listen for
      delete this.messages[msgId];
      
      //got some code that needs executing
      if (callback && typeof callback == "function") {
        callback(result, dataObj);  //off with their head
      }
    }
    else if (dataObj && dataObj.type) {
      console.log("handling " + dataObj.type + " message.");
      console.log(dataMessage.toString());
      
      console.log("going to try to call this." + dataObj.type + "(" + dataMessage + ");");
      if (this[dataObj.type] && typeof this[dataObj.type] == "function") {
        console.log("I'm going to do it");
        this[dataObj.type](dataObj);
      }
    }
    else {
      console.log("got unknown socket.io message:");
      console.log(dataMessage);
    }
  }
  catch (e) {
    console.log("got unparseable message via socket.io: ");
    console.log(e);
    console.log(dataMessage);
  }
}

SocketHandler.prototype.move = function(moveMessage) {
  console.log("called move handler");
  
  var key = moveMessage.key,
      destination = moveMessage.to,
      who = moveMessage.who;
  
  moveObjectOnBoard(key, who, destination);
}
SocketHandler.prototype.add = function(addMessage) {
  console.log("called add handler");
  var $gameBoard = $("canvas#gameBoard"),
      imageSrc = addMessage.image,
      owner = addMessage.who,  // might need to update this at some point
      atX = addMessage.x,
      atY = addMessage.y;
      
  createNewImage(imageSrc, atX, atY, false);
}
SocketHandler.prototype.join = function(joinMessage) {
  console.log("joined " + joinMessage);
  console.log(joinMessage.who);
  alert(joinMessage.who + " has joined your game.");
  
  if (_init.maxUsers) {
    _players.push(joinMessage.who);
    //update list of participients
    $("div#allUsers").append("<p class='activeUser'>" + joinMessage.who + "</p>");
    return;
  }
  
  var otherUser = joinMessage.who;
  _players = [];
  _init.maxUsers = true;
  //go and setup some UI somewhere
  $("div#joinLink").remove();
  //and score board too
  var colors = ["black", "white"];
  $.each(colors, function(index, scoreColor) {
    if (_color == scoreColor && !_init[scoreColor]) {
      $("div#scoreContainer").append("<p id='" + scoreColor + "Score'>" + scoreColor + "(" + _username + "): 0</p>");
    }
    else if(_init[scoreColor] != true) {
      $("div#scoreContainer").append("<p id='" + scoreColor + "Score'>" + scoreColor + "(" + otherUser + "): 0</p>");
    }
    _init[scoreColor] = true;
  });
}
SocketHandler.prototype.disconnect = function(disconnectMsg) {
  var lostUser = disconnectMsg.who;
  console.log("called disconnect handler");
  $("div#allUsers").children(".ownedBy" + lostUser).addClass("inactive").removeClass("activeUser");
}

SocketHandler.prototype._sendMessage = function(id, message, callback) {
  this.messages[id] = callback;
  _socket.send(JSON.stringify(message));
}

function initSocket(socketObj) {
  _init.socket = true;
  
  socketObj.connect();
  console.log("connected socket, adding listeners for messages");
  _socketHandler = new SocketHandler();
  _socketHandler.socket = socketObj;
  
  _socketHandler.socket.on("message", function(data){
    //var obj = JSON.parse(data);
    console.log("got message : " + data);
    
    _socketHandler.handle(data);
  });
}
function sendMessage(type, message, callback) {
  if (!_init.socket || ! _socketHandler) {
    console.log("called SendMessage with no active socket");
    return false; //raise error?
  }
  
  var messageId = Math.uuid();
  console.log("creating a " + type + " message with contents:");
  console.log(message);
  var socketMessage = {type: type, data: message, id: messageId};
  
  _socketHandler._sendMessage(messageId, socketMessage, callback);
}