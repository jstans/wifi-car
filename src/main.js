import * as wifi from "Wifi";
import { createServer } from "ws";

const led = NodeMCU.D4;
let ledStatus = true;
let _timer;

const useState = initialValue => {
  let _value = initialValue;
  const getState = () => _value;
  const setState = nextValue => (state = nextValue);
  return [getState, setState];
};

const setLed = status => {
  ledStatus = !status;
  digitalWrite(led, ledStatus);
};

const startBlink = () => {
  let status = false;
  _timer = setInterval(() => {
    status = !status;
    digitalWrite(led, status);
  }, 500);
};

const stopBlink = () => {
  clearTimeout(_timer);
  _timer = null;
  digitalWrite(led, ledStatus);
};

const useBlink = (times, timeOn, timeOff) => {
  clearTimeout(_timer);
  let amount = times * 2;

  let status = false;

  const toggle = () => {
    status = !status;
    digitalWrite(led, status);
    if (amount > 0) {
      _timer = setTimeout(toggle, amount % 2 ? timeOff : timeOn);
    } else {
      clearInterval(_timer);
      digitalWrite(led, ledStatus);
    }
    amount--;
  };
  toggle();
};

const searchForWifi = () => {
  startBlink();
  wifi.connect(
    process.env.WIFI_SSID,
    { password: process.env.WIFI_PASS },
    err => {
      if (err) {
        //useBlink(3, 100);
        setTimeout(searchForWifi, 1000);
        return;
      }
      stopBlink();
      useBlink(2, 500, 100);
      init();
    }
  );
};

const init = () => {
  let clients = [];
  createServer((req, res) => {
    const page = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0">
        </head>
        <body>
          Hi!
          <script>
            var ws = new WebSocket("ws://" + location.host, "protocolOne");
            // ws.send(JSON.stringify({ type: "DRIVE", payload: true }))
          </script>
        </body>
      </html>
    `;
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(page);
  })
    .listen(8000)
    .on("websocket", ws => {
      setLed(true);
      useBlink(3, 100, 100);
      clients.push(ws);
      ws.on("message", evt => {
        // JSON.parse(evt);
      });
      ws.on("close", evt => {
        useBlink(2, 200, 500);
        const index = clients.indexOf(ws);
        if (index > -1) clients.splice(index, 1);
        if (!clients.length) setLed(false);
      });
    });
};

E.on("init", () => {
  if (process.env.WIFI_SSID) {
    searchForWifi();
  } else {
    init();
  }
});
