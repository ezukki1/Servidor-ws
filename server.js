// --- LÓGICA MÍNIMA DEL SERVIDOR WEBSOCKET (Para ejecutar en tu Railway) ---
// Requiere: npm install ws
const WebSocket = require('ws');

// **IMPORTANTE:** Railway establece la variable de entorno PORT. DEBES usarla.
const PORT = process.env.PORT || 8080;

// Inicializa el servidor WebSocket
// Nota: Si usas un servidor HTTP/Express, deberías adjuntar WSS al servidor HTTP. 
// Para un servidor puro WS en Railway, esta configuración simple funciona.
const wss = new WebSocket.Server({ port: PORT }, () => {
    console.log(`WebSocket Server running on port ${PORT}`);
});

// Mapa para rastrear las IDs de usuario y sus conexiones
const clients = new Map();

/**
 * Envía un mensaje a todos los clientes conectados.
 * @param {object} data - El objeto a serializar y enviar (e.g., { type: 'USER_COUNT', count: 5 })
 */
function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

/**
 * Envía la cuenta actual de usuarios a todos los clientes.
 */
function sendUserCount() {
    const count = clients.size;
    console.log(`Usuarios activos: ${count}`);
    broadcast({
        type: 'USER_COUNT',
        count: count,
    });
}

// Evento al recibir una nueva conexión
wss.on('connection', function connection(ws) {
    console.log('Cliente conectado.');

    // Envía el conteo inicial cuando un nuevo usuario se conecta (antes de que se identifique)
    sendUserCount();

    // Manejo de mensajes entrantes
    ws.on('message', function incoming(data) {
        try {
            const parsed = JSON.parse(data);

            switch (parsed.type) {
                case 'CONNECT':
                    // Un cliente se conecta y nos da su userId. Lo rastreamos.
                    const userId = parsed.userId;
                    // Solo si no existe ya para evitar errores
                    if (!clients.get(ws)) { 
                        clients.set(ws, userId);
                        console.log(`User ${userId} conectado.`);
                        sendUserCount(); // Notificamos a todos del nuevo conteo
                    }
                    break;

                case 'PING':
                    // Respuesta Keep-Alive.
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'PONG' }));
                    }
                    break;

                case 'SEND_MESSAGE':
                    // Lógica MÍNIMA: Reenviar el mensaje de chat a TODOS.
                    const message = parsed.message;
                    message.senderName = message.senderId.substring(0, 8); // Simulación de nombre
                    
                    // Reenviar el mensaje de chat a todos los clientes
                    broadcast({
                        type: 'CHAT_MESSAGE',
                        message: message,
                    });
                    break;
                
                // Nota: El tipo 'DISCONNECT' se maneja mejor en el evento 'close'
                // pero si el cliente lo envía, aquí lo procesamos.
                case 'DISCONNECT':
                    if (clients.delete(ws)) {
                        console.log(`User desconectado manualmente.`);
                        sendUserCount();
                    }
                    break;

                default:
                    console.log('Mensaje de tipo desconocido:', parsed);
            }
        } catch (e) {
            console.error('Error al procesar el mensaje:', e);
        }
    });

    // Evento al cerrar la conexión (mejor lugar para manejar la desconexión)
    ws.on('close', () => {
        const userId = clients.get(ws);
        if (userId) {
            console.log(`User ${userId} desconectado.`);
            clients.delete(ws);
            sendUserCount(); // Notificamos a todos
        }
    });
});
