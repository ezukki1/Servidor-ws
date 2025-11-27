const WebSocket = require("ws");
const PORT = process.env.PORT || 8080; // Usa 8080 si Railway lo requiere, o déjalo en 3000 si funciona

const wss = new WebSocket.Server({ port: PORT });

// --- ESTADO DEL SERVIDOR ---
// Almacena las conexiones activas por su identificador (ws.id)
const activeUsers = new Map(); 
// Cola de espera para el emparejamiento
let matchmakingQueue = null; 

console.log(`Servidor WebSocket escuchando en puerto: ${PORT}`);

// Función para enviar un mensaje JSON seguro a un cliente
function sendToClient(client, payload) {
    if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
    }
}

// Genera un ID único para cada conexión
function generateUniqueId() {
    return Math.random().toString(36).substring(2, 9);
}

// --- LÓGICA DE EMPAREJAMIENTO (MATCHMAKING) ---
function attemptMatch(client) {
    if (matchmakingQueue && matchmakingQueue.id !== client.id) {
        // ¡Emparejamiento encontrado!
        const partner = matchmakingQueue;
        matchmakingQueue = null; // Vaciar la cola

        // Asignar compañeros mutuamente
        client.partnerId = partner.id;
        partner.partnerId = client.id;
        
        console.log(`MATCHED: ${client.user} <> ${partner.user}`);

        // Notificar a ambos clientes
        sendToClient(client, { type: 'matched', partner: partner.user });
        sendToClient(partner, { type: 'matched', partner: client.user });

    } else {
        // Poner en cola de espera
        matchmakingQueue = client;
        console.log(`QUEUED: ${client.user} - esperando...`);
        sendToClient(client, { type: 'waiting' });
    }
}

wss.on("connection", (ws) => {
    // Asignar un ID único a esta conexión
    ws.id = generateUniqueId();
    ws.user = null; // Nickname
    ws.partnerId = null; // ID del compañero

    console.log(`Cliente conectado con ID: ${ws.id}`);

    ws.on("message", (rawMessage) => {
        try {
            const data = JSON.parse(rawMessage.toString());
            
            // --- MANEJO DE REGISTRO ---
            if (data.type === 'register' && data.user) {
                // Si el nickname ya está en uso, se podría manejar un error,
                // pero por ahora, solo registramos la conexión.
                ws.user = data.user;
                activeUsers.set(ws.id, ws);
                console.log(`REGISTERED: ${ws.user} (ID: ${ws.id})`);
            }
            
            // --- MANEJO DE CHAT (P2P) ---
            else if (data.type === 'chat' && ws.partnerId) {
                const partnerWs = activeUsers.get(ws.partnerId);
                if (partnerWs) {
                    // Reenviar mensaje SOLAMENTE al compañero
                    sendToClient(partnerWs, { type: 'chat', user: ws.user, message: data.message });
                    console.log(`CHAT: ${ws.user} -> ${partnerWs.user}: ${data.message.substring(0, 20)}...`);
                }
            }
            
            // --- MANEJO DE MATCHMAKING ---
            else if (data.type === 'match' && ws.user) {
                // Cancelar si estaba emparejado
                if (ws.partnerId) {
                    handleDisconnect(ws, 'CANCEL'); // Forzar desconexión del chat anterior
                }
                attemptMatch(ws);
            }

            // --- MANEJO DE CANCELACIÓN DE BÚSQUEDA ---
            else if (data.type === 'cancel_match' && ws.user && matchmakingQueue && matchmakingQueue.id === ws.id) {
                 matchmakingQueue = null;
                 console.log(`CANCELLED: ${ws.user} salió de la cola.`);
            }

        } catch (e) {
            console.error(`Error procesando mensaje de ${ws.id}:`, e.message);
            sendToClient(ws, { type: 'server_error', message: 'Mensaje inválido.' });
        }
    });

    // --- MANEJO DE DESCONEXIÓN ---
    ws.on("close", () => {
        handleDisconnect(ws, 'CLOSE');
    });

    // Llamado cuando el cliente se desconecta o cuando se cancela una búsqueda con pareja
    function handleDisconnect(client, reason) {
        // 1. Si estaba en la cola de matchmaking, quitarlo
        if (matchmakingQueue && matchmakingQueue.id === client.id) {
            matchmakingQueue = null;
            console.log(`${client.user || client.id} removido de la cola.`);
        }
        
        // 2. Si estaba en un chat, notificar al compañero
        if (client.partnerId) {
            const partnerWs = activeUsers.get(client.partnerId);
            if (partnerWs) {
                partnerWs.partnerId = null; // Desvincular al compañero
                sendToClient(partnerWs, { type: 'partner_left' });
                console.log(`PARTNER LEFT: Notificado a ${partnerWs.user} que ${client.user} se fue.`);
            }
        }

        // 3. Eliminar de la lista de usuarios activos
        activeUsers.delete(client.id);
        console.log(`${client.user || client.id} desconectado (Razón: ${reason}). Clientes activos: ${activeUsers.size}`);
    }

    //ws.send(JSON.stringify({ type: 'server_info', message: 'Bienvenido al servidor P2P!' }));
});
