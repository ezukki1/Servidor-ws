import { WebSocketServer } from "ws";
import http from "http";

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Usuario conectado");

  ws.on("message", (msg) => {
    // retransmitir a todos
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(msg);
      }
    });
  });

  ws.on("close", () => {
    console.log("Usuario desconectado");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("WS server en puerto " + PORT));
