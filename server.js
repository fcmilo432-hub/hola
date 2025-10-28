import express from "express";
import http from "http";

const app = express();

// Ruta principal
app.get("/", (req, res) => {
  res.send("✅ Bot activo 24/7 en Replit");
});

// Servidor HTTP
const server = http.createServer(app);

// Escucha en el puerto que Replit asigne
server.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Servidor en línea");
});
