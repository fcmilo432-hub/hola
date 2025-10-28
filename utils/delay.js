// utils/delay.js

/**
 * Función para generar retrasos aleatorios entre mensajes
 * @param {number} min - Mínimo de milisegundos
 * @param {number} max - Máximo de milisegundos  
 * @returns {Promise}
 */
export function randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Retraso específico para comandos que envían múltiples mensajes
 */
export function commandDelay() {
    return randomDelay(1500, 4000);
}

/**
 * Retraso para reportes y reenvíos (más corto)
 */
export function reportDelay() {
    return randomDelay(800, 2000);
}

/**
 * Retraso para respuestas simples
 */
export function responseDelay() {
    return randomDelay(500, 1500);
}