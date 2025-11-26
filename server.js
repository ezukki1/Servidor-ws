const WebSocket = require("ws");
const PORT = process.env.PORT || 3000;

const wss = new WebSocket.Server({ port: PORT });

console.log("Servidor WebSocket escuchando en puerto:", PORT);

wss.on("connection", (ws) => {
    console.log("Cliente conectado");

    ws.on("message", (message) => {
        console.log("Mensaje recibido:", message);

        // Reenviar el mensaje a todos los clientes
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.send("Bienvenido al servidor WebSocket!");
});
