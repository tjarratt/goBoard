function Game(roomId) {
  if ( !(this instanceof arguments.callee) ) 
      return new Game();
  this.room = roomId;
}

Game.prototype.getAvailableColor = function() {
  
}

Game.prototype.getActiveUsers = function() {
  
}

Game.prototype.setAvailableColor = function() {
  
}

Game.prototype.setActiveUserInfo = function(name, info) {
  
}