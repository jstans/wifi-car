import * as wifi from "Wifi";
import { createServer } from "ws";

const pin = {
  forward: NodeMCU.D1,
  reverse: NodeMCU.D5,
  left: NodeMCU.D2,
  right: NodeMCU.D3,
  led: NodeMCU.D4
};

const ap = {
  ssid: process.env.WIFI_SSID,
  pass: process.env.WIFI_PASS
};

let ledStatus = true;
let _timer = null;
let _forward = null;
let _reverse = null;

const car = {
  init: () => {
    pinMode(pin.left, "output");
    pinMode(pin.right, "output");
    pinMode(pin.forward, "output");
    pinMode(pin.reverse, "output");
    analogWrite(pin.forward, 0);
    analogWrite(pin.reverse, 0);
    digitalWrite(pin.left, 0);
    digitalWrite(pin.right, 0);
  },
  left: () => {
    digitalWrite(pin.right, 0);
    digitalWrite(pin.left, 1);
  },
  right: () => {
    digitalWrite(pin.left, 0);
    digitalWrite(pin.right, 1);
  },
  straight: () => {
    digitalWrite(pin.left, 0);
    digitalWrite(pin.right, 0);
  },
  forward: (speed = 1) => {
    if (!_forward) {
      analogWrite(pin.reverse, 0);
      analogWrite(pin.forward, speed);
      clearTimeout(_reverse);
      _reverse = null;
    }
    clearTimeout(_forward);
    _forward = null;
    _forward = setTimeout(() => {
      analogWrite(pin.forward, 0);
    }, 200);
  },
  reverse: (speed = 1) => {
    if (!_reverse) {
      analogWrite(pin.forward, 0);
      analogWrite(pin.reverse, speed);
      clearTimeout(_forward);
      _forward = null;
    }
    clearTimeout(_reverse);
    _reverse = null;
    _reverse = setTimeout(() => {
      analogWrite(pin.reverse, 0);
    }, 200);
  },
  stop: () => {
    analogWrite(pin.forward, 0);
    analogWrite(pin.reverse, 0);
    clearTimeout(_forward);
    _forward = null;
    clearTimeout(_reverse);
    _reverse = null;
  }
};

const setLed = status => {
  ledStatus = !status;
  digitalWrite(pin.led, ledStatus);
};

const startBlink = (rate = 500) => {
  let status = false;
  _timer = setInterval(() => {
    status = !status;
    digitalWrite(pin.led, status);
  }, rate);
};

const stopBlink = () => {
  clearTimeout(_timer);
  _timer = null;
  digitalWrite(pin.led, ledStatus);
};

const useBlink = (times, timeOn, timeOff) => {
  clearTimeout(_timer);

  let amount = times * 2;
  let status = false;

  const toggle = () => {
    status = !status;
    digitalWrite(pin.led, status);
    if (amount > 0) {
      _timer = setTimeout(toggle, amount % 2 ? timeOff : timeOn);
    } else {
      clearInterval(_timer);
      digitalWrite(pin.led, ledStatus);
    }
    amount--;
  };
  toggle();
};

const searchForWifi = () => {
  startBlink();
  wifi.connect(ap.ssid, { password: ap.pass }, err => {
    if (err) {
      setTimeout(searchForWifi, 1000);
      return;
    }
    stopBlink();
    useBlink(2, 500, 100);
    wifi.stopAP();
    wifi.save();
    init();
  });
};

const createAP = () => {
  wifi.disconnect();
  wifi.startAP("wifi-car", { password: "slateapps", authMode: "wpa_wpa2" });
};

const servePage = (res, data) => {
  let i = 0;
  const process = () => {
    const buf = data.substr(i, 200);
    i += 200;
    i >= data.length ? res.end(buf) : res.write(buf);
  };
  res.on("drain", process);
  process();
};

// <link rel="stylesheet" href="app.css"></link>

const appHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0">
    <style>
      html, body {
        height: 100%;
        margin: 0;
      }
      body {
        display: flex;
        flex-wrap: wrap;
        flex-direction: row;
      }
      button {
        margin: 10px;
        display: flex;
        flex-basis: calc(50% - 20px);
        justify-content: center;
        flex-direction: column;
      }
    </style>
  </head>
  <body>
    <button id="left">Left</button>
    <button id="forward">Forward</button>
    <button id="right">Right</button>
    <button id="reverse">Reverse</button>
    <script>
      var ws = new WebSocket("ws://" + location.host, "protocolOne");
    
      var _timer = null;
    
      var forward = function() { ws.send(JSON.stringify({ type: "CAR", payload: "forward" })) };
      var reverse = function() { ws.send(JSON.stringify({ type: "CAR", payload: "reverse" })) };
      var stop = function() { ws.send(JSON.stringify({ type: "CAR", payload: "stop" })) };
      var left = function() { ws.send(JSON.stringify({ type: "CAR", payload: "left" })) };
      var right = function() { ws.send(JSON.stringify({ type: "CAR", payload: "right" })) };
      var straight = function() { ws.send(JSON.stringify({ type: "CAR", payload: "straight" })) };
    
      var driveStart = function(e,func) {
        e.preventDefault();
        clearInterval(_timer);
        _timer = setInterval(func, 100);
        func();
      }
      var driveEnd = function(e) {
        e.preventDefault();
        clearInterval(_timer);
        stop();
      }
      var turn = function(e, func) {
        e.preventDefault();
        func();
        document.addEventListener("mouseup", straight);
        document.addEventListener("touchend", straight);
      }

      document.getElementById("forward").addEventListener("mousedown", e => driveStart(e,forward));
      document.getElementById("forward").addEventListener("touchstart", e => driveStart(e,forward));
      document.getElementById("forward").addEventListener("mouseup", driveEnd);
      document.getElementById("forward").addEventListener("touchend", driveEnd);
    
      document.getElementById("reverse").addEventListener("mousedown", e => driveStart(e,reverse));
      document.getElementById("reverse").addEventListener("touchstart", e => driveStart(e,reverse));
      document.getElementById("reverse").addEventListener("mouseup", driveEnd);
      document.getElementById("reverse").addEventListener("touchend", driveEnd);
    
      document.getElementById("left").addEventListener("mousedown", e => turn(e, left));
      document.getElementById("left").addEventListener("touchstart", e => turn(e, left));
      
      document.getElementById("right").addEventListener("mousedown", e => turn(e, right));
      document.getElementById("right").addEventListener("touchstart", e => turn(e, right));
    </script>
  </body>
</html>
`;

const init = () => {
  let clients = [];
  createServer((req, res) => {
    const request = url.parse(req.url, true);
    // if (request.pathname == "/app.js") {
    //   res.writeHead(200, { "Content-Type": "text/javascript" });
    //   servePage(res, appJs);
    //   return;
    // }
    // if (request.pathname == "/app.css") {
    //   res.writeHead(200, { "Content-Type": "text/css" });
    //   servePage(res, appCss);
    //   return;
    // }
    if (request.pathname == "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      servePage(res, appHtml);
    } else {
      res.writeHead(404);
      res.end();
    }
  })
    .listen(8000)
    .on("websocket", ws => {
      setLed(true);
      useBlink(3, 100, 100);
      clients.push(ws);
      ws.on("message", evt => {
        const event = JSON.parse(evt);
        switch (event.type) {
          case "AP":
            wifi.connect(
              event.payload && event.payload.ssid,
              { password: event.payload && event.payload.pass },
              err => {
                if (!err) {
                  wifi.stopAP();
                  wifi.setHostname("wifi-car");
                  wifi.save();
                }
              }
            );
            break;
          case "CAR":
            car[event.payload] && car[event.payload]();
            break;
        }
      });
      ws.on("close", evt => {
        useBlink(2, 200, 500);
        const index = clients.indexOf(ws);
        if (index > -1) clients.splice(index, 1);
        if (!clients.length) setLed(false);
      });
    });
  car.init();
};

E.on("init", () => {
  setLed(false);
  if (wifi.getDetails().status === "connected" || wifi.getDetails().savedSsid) {
    wifi.stopAP();
    init();
    return;
  }
  if (ap.ssid) {
    // createAP();
    searchForWifi();
    return;
  }
  init();
});
