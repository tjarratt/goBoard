function User(name) {
  if ( !(this instanceof arguments.callee) ) 
      return new User();
  this.name = name;
}

exports.getUserByCookie = function(cookieValue) {
  
}

User.prototype.setActiveRoom = function(roomId) {
  
}

User.prototype.setSocketId = function(socketId) {
  
}