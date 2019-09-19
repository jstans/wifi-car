var ws;
var _pingTimeout;
var d = document;

function ping() {
  clearTimeout(_pingTimeout);
  _pingTimeout = setTimeout(connect, 5000);
  ws.send("PING");
}

function connect() {
  _pingTimeout = null;
  ws = new WebSocket("ws://" + location.host, "protocolOne");
  ws.onopen = () => {
    d.body.style.backgroundColor = "green";
    setTimeout(ping, 5000);
  };
  ws.onclose = () => {
    d.body.style.backgroundColor = "red";
    setTimeout(connect, 1000);
  };
  ws.onmessage = data => {
    if (data === "PONG") {
      clearTimeout(_pingTimeout);
      _pingTimeout = null;
      setTimeout(connect, 5000);
    }
  };
}

connect();

var _driveTimeout = null;

var forward = () => {
  ws.send(JSON.stringify({ type: "CAR", payload: "forward" }));
};
var reverse = () => {
  ws.send(JSON.stringify({ type: "CAR", payload: "reverse" }));
};
var stop = () => {
  ws.send(JSON.stringify({ type: "CAR", payload: "stop" }));
};
var left = () => {
  ws.send(JSON.stringify({ type: "CAR", payload: "left" }));
};
var right = () => {
  ws.send(JSON.stringify({ type: "CAR", payload: "right" }));
};
var straight = () => {
  ws.send(JSON.stringify({ type: "CAR", payload: "straight" }));
};

var driveStart = (e, func) => {
  e.preventDefault();
  clearInterval(_driveTimeout);
  _driveTimeout = setInterval(func, 100);
  func();
};

var driveEnd = e => {
  e.preventDefault();
  clearInterval(_driveTimeout);
  stop();
};

var turn = (e, func) => {
  e.preventDefault();
  func();
  var _mouseup = d.addEventListener("mouseup", () => {
    d.removeEventListener("mouseup", _mouseup);
    straight();
  });
  var _touchend = d.addEventListener("touchend", () => {
    d.removeEventListener("touchend", _touchend);
    straight();
  });
};

d.getElementById("forward").addEventListener("mousedown", e =>
  driveStart(e, forward)
);
d.getElementById("forward").addEventListener("mouseup", driveEnd);
d.getElementById("reverse").addEventListener("mousedown", e =>
  driveStart(e, reverse)
);
d.getElementById("reverse").addEventListener("mouseup", driveEnd);
d.getElementById("left").addEventListener("mousedown", e => turn(e, left));
d.getElementById("right").addEventListener("mousedown", e => turn(e, right));

d.getElementById("forward").addEventListener("touchstart", e =>
  driveStart(e, forward)
);
d.getElementById("forward").addEventListener("touchend", driveEnd);
d.getElementById("reverse").addEventListener("touchstart", e =>
  driveStart(e, reverse)
);
d.getElementById("reverse").addEventListener("touchend", driveEnd);
d.getElementById("left").addEventListener("touchstart", e => turn(e, left));
d.getElementById("right").addEventListener("touchstart", e => turn(e, right));

d.addEventListener(
  "keydown",
  e => [38, 87].indexOf(e.keyCode) > -1 && driveStart(e, forward)
);
d.addEventListener(
  "keydown",
  e => [40, 83].indexOf(e.keyCode) > -1 && driveStart(e, reverse)
);
d.addEventListener(
  "keyup",
  e => [38, 40, 87, 83].indexOf(e.keyCode) > -1 && driveEnd()
);
d.addEventListener("keydown", e => [37, 65].indexOf(e.keyCode) > -1 && left());
d.addEventListener("keydown", e => [39, 68].indexOf(e.keyCode) > -1 && right());
d.addEventListener(
  "keyup",
  e => [37, 39, 65, 68].indexOf(e.keyCode) > -1 && straight()
);
