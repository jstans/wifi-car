import * as wifi from "Wifi";
import { createServer } from "ws";
import * as files from "files.json";

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
  wifi.startAP("wifi-car", {
    password: process.env.AP_PASS,
    authMode: "wpa_wpa2"
  });
};

const servePage = (res, data) => {
  let i = 0;
  const process = () => {
    const buf = data.substr(i, 100);
    i += 100;
    i >= data.length ? res.end(buf) : res.write(buf);
  };
  res.on("drain", process);
  process();
};

const init = () => {
  let clients = [];
  const http = new WebServer({
    port: 80,
    default_type: "text/html",
    default_index: "index.html",
    memory: files
  }).createServer();
  createServer((req, res) => {
    const request = url.parse(req.url, true);
    const file =
      files["/" + request.pathname === "/" ? "index.html" : request.pathname];
    if (file) {
      res.writeHead(200, { "Content-Type": file.type });
      servePage(res, file.contents);
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
        if (evt === "PING") {
          ws.send("PONG");
          return;
        }
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
