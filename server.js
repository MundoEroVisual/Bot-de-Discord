
import express from 'express';
import { spawn } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

// Endpoint básico para ping
app.get('/', (req, res) => res.send('Servidor en funcionamiento ✅'));

// Mantener el bot principal siempre encendido
function keepBotAlive() {
    const lanzar = () => {
        const proceso = spawn('node', ['bot.js'], { stdio: 'inherit' });
        proceso.on('close', (code) => {
            setTimeout(lanzar, 5000);
        });
        proceso.on('error', () => {
            setTimeout(lanzar, 5000);
        });
    };
    lanzar();
}

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
    keepBotAlive();
    setInterval(() => {
        fetch(`http://localhost:${PORT}/`).catch(() => {});
    }, 3 * 60 * 1000);
});
