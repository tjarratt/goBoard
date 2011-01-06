function joinEventCallback(result) {
  if (!result) {return alert("uh oh");}
  
  console.log("successfully joined");
  
  var gamePiece = new Image;
  gamePiece.className = "myGamePiece";
  gamePiece.src = "/public/image/" + _color + ".png";
  
  $("div#gamePieces").append(gamePiece);
  
  initGameBoard("square", 19, 19);
  $("div#temp").remove();
  $("div#messages").html("");
  
  initDragDrop();
	$("div#gameContainer").css("visibility", "visible");
	$("div#gameContainer").children().css("visibility", "visible");
}

function initGame(roomId, color, known) {
  _roomId = roomId;
  _color = color;
  known = known && known != "false" ? true : false;
  io.setPath("/");
  
  _socket = new io.Socket(_url, {port: _port});
  initSocket(_socket);
  
  if (!color in  ["black", "white"]) {
    console.log("joined with an unknown color: " + color);
  }
  else {
    //var myGamePiece = "<img src='/public/image/" + color + ".png' />"
    //$("div#gamePieces").append(myGamePiece);
  }
  
  if (!known) {
    var $temp = $("div#temp");
    
    $temp.addClass("centerText").addClass("center");
    $temp.append("<p>What should we call you?</p>");
    $temp.append("<input id='nameInput' />");
    
    $temp.children("input").keypress(function(e) {
      if (e.which == 13) {
        $("div#temp>input").attr("disabled", true);
        _username = $(this).val();
        console.log("hello " + _username);
        var postData = {name: _username, room: _roomId, color: _color};
        //use websockets to send join event to server
        sendMessage("join", postData, joinEventCallback);
      }
    });
  }
  else {
    initGameBoard("square", 19, 19);
    $("canvas").css("visibility", "visible");
    $("div#gamePieces").css('visibility', "visible");
  }
  $("input#nameInput").focus();
}