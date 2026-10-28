# NEON//ARENA

Arena shooter 2D hecho con HTML5 Canvas y JavaScript, sin imágenes ni recursos externos.

## Archivos

- `index.html`: estructura de la página y elementos de interfaz.
- `styles.css`: estilos del menú, HUD y diseño adaptable.
- `game.js`: toda la lógica del juego, controles, entidades, efectos y dibujo en canvas.

Dentro de `game.js`, el código está organizado por bloques: estado y configuración, audio, interfaz, controles, creación de entidades, actualización de la partida, dibujo y bucle principal. La actualización separa jugador, oleadas, enemigos, proyectiles, mejoras y partículas para que cada mecánica se pueda localizar y modificar con facilidad.

## Cómo jugar

Abre `index.html` en un navegador moderno.

- **WASD** o flechas: mover
- **Ratón**: apuntar
- **Clic izquierdo** o **espacio**: disparar
- **Esc** o **P**: pausar

El menú permite ajustar dificultad, sonido, partículas y sacudida de cámara. El récord se guarda en el navegador.
