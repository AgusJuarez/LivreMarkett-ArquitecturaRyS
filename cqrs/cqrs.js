const express = require("express");
const axios = require("axios");
const app = express();
const port = 6000;
const amqp = require("amqplib/callback_api");
const EventEmitter = require("node:events");
const readline = require("readline");

let contadorRespuestas = 0;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

app.use(express.json());

//******************FLUJO POSITIVO***************************************************************************** */
const estadosCompras = [
  "producto_seleccionado",
  "pedido_generado",
  "forma_envio_solicitada",
  "forma_pago_solicitada",
  "compra_finalizada",
];
const estadosEnvios = ["envio_calculado", "producto_enviado"];
const estadosPagos = ["pagando", "producto_pagado"];
const estadosPublicaciones = ["producto_reservado", "reserva_confirmada"];
const estadosInfracciones = [
  "detectando_infracciones",
  "verificando_infraccion",
  "sin_infracciones",
];
const estadosWeb = [
  "forma_envio_enviada",
  "forma_pago_enviado",
  "compra_finalizada",
];
//*********************************************************************************************** */

//*****************************FLUJO NEGATIVO****************************************************************** */
const estadoCanceladoPago = ["compra_cancelada"];
const estadoCanceladoWeb = [
  "forma_envio_enviada",
  "forma_pago_enviado",
  "compra_cancelada",
];
const estadoCanceladoCompras = [
  "producto_seleccionado",
  "pedido_generado",
  "forma_envio_solicitada",
  "forma_pago_solicitada",
  "compra_cancelada",
];
const estadoCanceladoEnvio = ["envio_calculado", "envio_cancelado"];
const estadoCanceladoInfraccion = [
  "detectando_infracciones",
  "compra_cancelada",
];
const estadoCanceladoPublicacion = ["producto_reservado", "reserva_cancelada"];
//*********************************************************************************************** */

const EXCHANGE_NAME = "exchange_cqrs";
const QUEUES = [
  "cola_compras",
  "cola_pagos",
  "cola_infracciones",
  "cola_web",
  "cola_envios",
  "cola_publicaciones",
];

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

function enviarRequest(informacionCompra) {
  axios
    .post("http://wso2ei:8280/services/cqrsRequest", {
      compras: informacionCompra,
    })
    .then((response) => {
      console.log("Respuesta:", response.data);
      const listaCompras = response.data.compras.listaCompras;
      for (const compra of listaCompras) {
        const servicio = compra[0];
        const datos = compra[1];
        const estadosActuales = datos.estados || [];

        let estadosEsperados = [];
        let nombreServicio = "";

        if (datos.estado == "No existe compra") {
          console.log(
            `⚠️ Servicio ${servicio} todavia no tiene datos de la compra ${datos.compraId}`
          );
        } else {
          switch (servicio) {
            case "COMPRAS":
              if (
                datos.motivo == "Detectada infracción" ||
                datos.motivo == "Pago rechazado" ||
                datos.motivo == "timeout"
              ) {
                estadosEsperados = estadoCanceladoCompras;
              } else {
                estadosEsperados = estadosCompras;
              }
              nombreServicio = "COMPRAS";
              break;
            case "WEB":
              if (
                datos.motivo == "Detectada infracción" ||
                datos.motivo == "Pago rechazado" ||
                datos.motivo == "timeout"
              ) {
                estadosEsperados = estadoCanceladoWeb;
              } else {
                estadosEsperados = estadosWeb;
              }
              nombreServicio = "WEB";
              break;
            case "ENVIOS":
              if (
                datos.motivo == "Detectada infracción" ||
                datos.motivo == "Pago rechazado" ||
                datos.motivo == "timeout"
              ) {
                estadosEsperados = estadoCanceladoEnvio;
              } else {
                estadosEsperados = estadosEnvios;
              }
              nombreServicio = "ENVIOS";
              break;
            case "PUBLICACIONES":
              if (
                datos.motivo == "Detectada infracción" ||
                datos.motivo == "Pago rechazado" ||
                datos.motivo == "timeout"
              ) {
                estadosEsperados = estadoCanceladoPublicacion;
              } else {
                estadosEsperados = estadosPublicaciones;
              }
              nombreServicio = "PUBLICACIONES";
              break;
            case "PAGOS":
              if (
                datos.motivo == "Detectada infracción" ||
                datos.motivo == "Pago rechazado" ||
                datos.motivo == "timeout"
              ) {
                estadosEsperados = estadoCanceladoPago;
              } else {
                estadosEsperados = estadosPagos;
              }
              nombreServicio = "PAGOS";
              break;
            case "INFRACCIONES":
              if (
                datos.motivo == "Detectada infracción" ||
                datos.motivo == "Pago rechazado" ||
                datos.motivo == "timeout"
              ) {
                estadosEsperados = estadoCanceladoInfraccion;
              } else {
                estadosEsperados = estadosInfracciones;
              }
              nombreServicio = "INFRACCIONES";
              break;
            default:
              console.log(`⚠️ Servicio desconocido: ${servicio}`);
              return;
          }

          const faltantes = estadosEsperados.filter(
            (estado) => !estadosActuales.includes(estado)
          );

          if (faltantes.length === 0) {
            console.log(
              `✅ Compra ${
                datos.compraId
              } en ${nombreServicio} está CONSISTENTE. Ultimo estado: ${
                datos.estados[datos.estados.length - 1]
              }`
            );
          } else {
            console.log(
              `❌ Compra ${datos.compraId} en ${nombreServicio} está INCONSISTENTE.`
            );
            console.log(
              `Faltan los siguientes estados: ${faltantes.join(", ")}`
            );
          }
        }
        contadorRespuestas = contadorRespuestas + 1;

        if (contadorRespuestas == QUEUES.length - 1) {
          setTimeout(() => {
            const resumen =
              `Compra ${datos.compraId || "desconocida"}:\n` +
              `- Producto: ${datos.producto || "no especificado"}\n` +
              `- Medio de pago: ${datos.medioPago || "no definido"}\n` +
              `- Forma de entrega: ${datos.formaDeEntrega || "no definida"}\n` +
              `- Costo: ${datos.costo ?? "no calculado"}\n` +
              `- Motivo: ${datos.motivo || "sin motivo"}`;

            console.log(resumen);
            console.log(`
                   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                   ░░░░░░░░░░▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄░░░░░░░░░
                   ░░░░░░░░▄▀░░░░░░░░░░░░▄░░░░░░░▀▄░░░░░░░
                   ░░░░░░░░█░░▄░░░░▄░░░░░░░░░░░░░░█░░░░░░░
                   ░░░░░░░░█░░░░░░░░░░░░▄█▄▄░░▄░░░█░▄▄▄░░░
                   ░▄▄▄▄▄░░█░░░░░░▀░░░░▀█░░▀▄░░░░░█▀▀░██░░
                   ░██▄▀██▄█░░░▄░░░░░░░██░░░░▀▀▀▀▀░░░░██░░
                   ░░▀██▄▀██░░░░░░░░▀░██▀░░░░░░░░░░░░░▀██░
                   ░░░░▀████░▀░░░░▄░░░██░░░▄█░░░░▄░▄█░░██░
                   ░░░░░░░▀█░░░░▄░░░░░██░░░░▄░░░▄░░▄░░░██░
                   ░░░░░░░▄█▄░░░░░░░░░░░▀▄░░▀▀▀▀▀▀▀▀░░▄▀░░
                   ░░░░░░█▀▀█████████▀▀▀▀████████████▀░░░░
                   ░░░░░░████▀░░███▀░░░░░░▀███░░▀██▀░░░░░░
                   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
      `);

            contadorRespuestas = 0;
          }, Math.random() * 1e3);
        }
      }
    })
    .catch((error) => {
      console.error("Error:", error.message);
    });
}

/*
function analizarEstados(informacionCompra) {
  const servicio = informacionCompra[0];
  const datos = informacionCompra[1];
  const estadosActuales = datos.estados || [];

  let estadosEsperados = [];
  let nombreServicio = "";

  if (datos.estado == "No existe compra") {
    console.log(
      `⚠️ Servicio ${servicio} todavia no tiene datos de la compra ${datos.compraId}`
    );
  } else {
    switch (servicio) {
      case "COMPRAS":
        if (
          datos.motivo == "Detectada infracción" ||
          datos.motivo == "Pago rechazado" ||
          datos.motivo == "timeout"
        ) {
          estadosEsperados = estadoCanceladoCompras;
        } else {
          estadosEsperados = estadosCompras;
        }
        nombreServicio = "COMPRAS";
        break;
      case "WEB":
        if (
          datos.motivo == "Detectada infracción" ||
          datos.motivo == "Pago rechazado" ||
          datos.motivo == "timeout"
        ) {
          estadosEsperados = estadoCanceladoWeb;
        } else {
          estadosEsperados = estadosWeb;
        }
        nombreServicio = "WEB";
        break;
      case "ENVIOS":
        if (
          datos.motivo == "Detectada infracción" ||
          datos.motivo == "Pago rechazado" ||
          datos.motivo == "timeout"
        ) {
          estadosEsperados = estadoCanceladoEnvio;
        } else {
          estadosEsperados = estadosEnvios;
        }
        nombreServicio = "ENVIOS";
        break;
      case "PUBLICACIONES":
        if (
          datos.motivo == "Detectada infracción" ||
          datos.motivo == "Pago rechazado" ||
          datos.motivo == "timeout"
        ) {
          estadosEsperados = estadoCanceladoPublicacion;
        } else {
          estadosEsperados = estadosPublicaciones;
        }
        nombreServicio = "PUBLICACIONES";
        break;
      case "PAGOS":
        if (
          datos.motivo == "Detectada infracción" ||
          datos.motivo == "Pago rechazado" ||
          datos.motivo == "timeout"
        ) {
          estadosEsperados = estadoCanceladoPago;
        } else {
          estadosEsperados = estadosPagos;
        }
        nombreServicio = "PAGOS";
        break;
      case "INFRACCIONES":
        if (
          datos.motivo == "Detectada infracción" ||
          datos.motivo == "Pago rechazado" ||
          datos.motivo == "timeout"
        ) {
          estadosEsperados = estadoCanceladoInfraccion;
        } else {
          estadosEsperados = estadosInfracciones;
        }
        nombreServicio = "INFRACCIONES";
        break;
      default:
        console.log(`⚠️ Servicio desconocido: ${servicio}`);
        return;
    }

    const faltantes = estadosEsperados.filter(
      (estado) => !estadosActuales.includes(estado)
    );

    if (faltantes.length === 0) {
      console.log(
        `✅ Compra ${
          datos.compraId
        } en ${nombreServicio} está CONSISTENTE. Ultimo estado: ${
          datos.estados[datos.estados.length - 1]
        }`
      );
    } else {
      console.log(
        `❌ Compra ${datos.compraId} en ${nombreServicio} está INCONSISTENTE.`
      );
      console.log(`Faltan los siguientes estados: ${faltantes.join(", ")}`);
    }
  }
  contadorRespuestas = contadorRespuestas + 1;

  if (contadorRespuestas == QUEUES.length - 1) {
    setTimeout(() => {
      const resumen =
        `Compra ${datos.compraId || "desconocida"}:\n` +
        `- Producto: ${datos.producto || "no especificado"}\n` +
        `- Medio de pago: ${datos.medioPago || "no definido"}\n` +
        `- Forma de entrega: ${datos.formaDeEntrega || "no definida"}\n` +
        `- Costo: ${datos.costo ?? "no calculado"}\n` +
        `- Motivo: ${datos.motivo || "sin motivo"}`;

      console.log(resumen);
      console.log(`
                   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                   ░░░░░░░░░░▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄░░░░░░░░░
                   ░░░░░░░░▄▀░░░░░░░░░░░░▄░░░░░░░▀▄░░░░░░░
                   ░░░░░░░░█░░▄░░░░▄░░░░░░░░░░░░░░█░░░░░░░
                   ░░░░░░░░█░░░░░░░░░░░░▄█▄▄░░▄░░░█░▄▄▄░░░
                   ░▄▄▄▄▄░░█░░░░░░▀░░░░▀█░░▀▄░░░░░█▀▀░██░░
                   ░██▄▀██▄█░░░▄░░░░░░░██░░░░▀▀▀▀▀░░░░██░░
                   ░░▀██▄▀██░░░░░░░░▀░██▀░░░░░░░░░░░░░▀██░
                   ░░░░▀████░▀░░░░▄░░░██░░░▄█░░░░▄░▄█░░██░
                   ░░░░░░░▀█░░░░▄░░░░░██░░░░▄░░░▄░░▄░░░██░
                   ░░░░░░░▄█▄░░░░░░░░░░░▀▄░░▀▀▀▀▀▀▀▀░░▄▀░░
                   ░░░░░░█▀▀█████████▀▀▀▀████████████▀░░░░
                   ░░░░░░████▀░░███▀░░░░░░▀███░░▀██▀░░░░░░
                   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
      `);

      contadorRespuestas = 0;
    }, Math.random() * 1e3);
  }
}
*/

// Enviar mensaje a exchange fanout
function enviarFanout(exchange, mensaje) {
  amqp.connect("amqp://arys:arys@rabbit", function (error0, connection) {
    if (error0) {
      throw error0;
    }

    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1;
      }

      channel.assertExchange(exchange, "fanout", {
        durable: false,
      });

      const msg = mensaje;
      channel.publish(exchange, "", Buffer.from(JSON.stringify(msg)));
      console.log(" [x] Mensaje enviado a exchange:", exchange);
    });

    setTimeout(function () {
      connection.close();
    }, 500);
  });
}

// Solicitar ID de compra y enviar mensaje fanout

rl.question("Coloque numero de ID de la compra: ", function (compraId) {
  console.log("ID ingresado:", compraId);
  let compraRequest = {
    compraId: compraId,
    listaCompras: [],
  };

  enviarRequest(compraRequest);
  //enviarFanout(EXCHANGE_NAME, compraRequest);
  rl.close();
});
