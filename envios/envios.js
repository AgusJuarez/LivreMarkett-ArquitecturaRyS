#!/usr/bin/env node

// **Envíos**: Calcula costos de envío (dependiendo de si es retiro o envío por correo) y gestiona la logística del envío de productos.

const axios = require("axios");
const express = require("express");
const app = express();
const port = 7000;
app.use(express.json());
let enviosBD = [];

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.post("/cqrsRequest", (req, res) => {
  const compra = req.body.compras;
  try {
    let nuevaCompra = { ...compra };
    console.log(
      "El Servicio de CQRS pidio informacion de la compra: ",
      nuevaCompra.compraId
    );
    let resultCompra = findCompra(nuevaCompra.compraId);
    if (resultCompra == null) {
      resultCompra = {
        compraId: nuevaCompra.compraId,
        estado: "No existe compra",
      };
    }
    let result = ["ENVIOS", resultCompra];
    compra.listaCompras.push(result);
    res.status(200).send(compra);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
});

app.post("/calcularCostoEnvio", (req, res) => {
  const compra = req.body.compra;
  let nuevaCompra = { ...compra };
  try {
    enviosBD[nuevaCompra.compraId] = nuevaCompra;
    console.log(
      "Calculando costo de envio del producto: ",
      nuevaCompra.producto,
      " ID: ",
      nuevaCompra.compraId,
      " FORMA ENTREGA: ",
      nuevaCompra.formaDeEntrega
    );

    try {
      nuevaCompra = calcularEnvio(nuevaCompra);

      actualizarBaseDatos(nuevaCompra);
      nuevaCompra = findCompra(nuevaCompra.compraId);
      console.log(
        "Costo de envio del producto calculado: ",
        nuevaCompra.producto,
        " ID: ",
        nuevaCompra.compraId,
        " FORMA ENTREGA: ",
        nuevaCompra.formaDeEntrega,
        " COSTO DE ENVIO: ",
        nuevaCompra.costo
      );
    } catch (error) {
      console.error("Error al calcular el costo de envio:", error.message);
    }
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(nuevaCompra);
});

app.post("/enviarProducto", (req, res) => {
  const compra = req.body.compra;
  let nuevaCompra = {};
  nuevaCompra = compra;
  try {
    console.log(
      "Enviando producto: ",
      nuevaCompra.producto,
      " ID: ",
      nuevaCompra.compraId,
      " FORMA ENTREGA: ",
      nuevaCompra.formaDeEntrega
    );

    console.log("Enviando compra: " + nuevaCompra.compraId);
    nuevaCompra.estado = "producto_enviado";
    nuevaCompra.estados.push("producto_enviado");
    actualizarBaseDatos(nuevaCompra);
    nuevaCompra = findCompra(nuevaCompra.compraId);

    console.log(
      "COMPRA ENVIADA: ",
      nuevaCompra.producto,
      " ID: ",
      nuevaCompra.compraId,
      " FORMA ENTREGA: ",
      nuevaCompra.formaDeEntrega,
      " ESTADO: ",
      nuevaCompra.estado
    );
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(nuevaCompra);
});

app.post("/cancelarCompra", (req, res) => {
  const compra = req.body.compra;
  let nuevaCompra = { ...compra };
  try {
    nuevaCompra.estado = "envio_cancelado";
    nuevaCompra.estados.push("envio_cancelado");
    actualizarBaseDatos(nuevaCompra);
    console.log("Cancelacion de envio de la compra: ", nuevaCompra.compraId);
  } catch (error) {
    console.error("Error al procesar el mensaje", error);
  }
  res.status(200).send(nuevaCompra);
});

function calcularEnvio(nuevaCompra) {
  console.log("Calculando costo de envio de compra: " + nuevaCompra.compraId);
  nuevaCompra.estado = "envio_calculado";
  nuevaCompra.estados.push("envio_calculado");
  if (nuevaCompra.formaDeEntrega === "correo") {
    nuevaCompra.costo = Math.random() * 1e3;
  } else {
    nuevaCompra.costo = 0;
  }
  return nuevaCompra;
}

function findCompra(nuevaCompraID) {
  return enviosBD[nuevaCompraID];
}

async function actualizarBaseDatos(nuevaCompra) {
  let compraExistente = enviosBD[nuevaCompra.compraId];
  if (compraExistente) {
    let estadosCombinados = [
      ...compraExistente.estados,
      ...nuevaCompra.estados,
    ];
    estadosCombinados = Array.from(new Set(estadosCombinados));
    enviosBD[compraExistente.compraId] = {
      ...compraExistente,
      ...nuevaCompra,
      estados: estadosCombinados,
    };
  }
}
