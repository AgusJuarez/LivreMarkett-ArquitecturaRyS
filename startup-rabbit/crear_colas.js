#!/usr/bin/env node
const amqp = require("amqplib");

async function crearColas() {
  try {
    const connection = await amqp.connect("amqp://arys:arys@rabbit");
    const channel = await connection.createChannel();

    const colas = [
      "cola_compras",
      "cola_pagos",
      "cola_envios",
      "cola_infracciones",
      "cola_publicaciones",
      "cola_web",
      //"cola_cqrs",
    ];

    for (const cola of colas) {
      await channel.assertQueue(cola, {
        durable: true,
        arguments: {
          "x-message-ttl": 5000,
          "x-dead-letter-exchange": "error_exchange",
        },
      });
      console.log("Cola creada: ", cola);
    }

    await channel.close();
    await connection.close();

    console.log("Todas las colas fueron creadas y la conexion fue cerrada");
  } catch (error) {
    console.log("Error al crear las colas: ", error);
  }
}

crearColas();
