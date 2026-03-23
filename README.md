# L5R Dice Roller (web)

Base inicial para un simulador de tiradas de **Leyenda de los 5 Anillos 4a edicion** (formato `XkY`, d10).

## Estado actual

- App web sin dependencias ni build.
- Inputs para definir:
  - cuantos dados lanzas (`X`)
  - cuantos dados guardas (`Y`)
- Soporte de dados explosivos (si sale `10`, vuelve a tirar y se suma).
- Seleccion automatica de los `Y` dados con mayor total.
- Reconocimiento de voz para comandos como: `lanza 7 dados guarda 4 dados` o `7k4`.
- Interfaz adaptada a movil (incluido iPhone).

## Estructura

- `index.html`: estructura de la app
- `styles.css`: estilos responsive
- `app.js`: logica de tiradas

## Ejecutar en local

Como no hay build, puedes abrir `index.html` directamente o levantar un servidor estatico.

Ejemplo con Python:

```bash
python -m http.server 8080
```

Luego abre `http://localhost:8080`.
