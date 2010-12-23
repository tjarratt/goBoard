function initSocket(socketObj) {
  _init.socket = true;
  
  socketObj.connect();
  console.log("connected socket, adding listeners for messages");
  socketObj.on("message", function(data){
    var obj = JSON.parse(data);
    console.log("got message : " + data);
    
    //pass this message to some other process
  });
}
function sendMessage(type, message) {
  if (!_init.socket || ! _socket) {
    console.log("called SendMessage with no active socket");
    return false; //raise error?
  }
  console.log("creating a " + type + " message with contents:");
  console.log(message);
  var socketMessage = {type: type, msg: message};
  
  _socket.send(JSON.stringify(socketMessage));
}